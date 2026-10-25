import hashlib
import json
import sqlite3
from uuid import uuid4

from fastapi import HTTPException

from app.agent.config import PRIMARY_MODEL, MAX_RETRIES
from app.research.analysis_llm import model_configuration
from app.research.analysis_models import AnalysisSnapshot, AnalysisStart, SnapshotDocument
from app.research.calculations import financial_identity
from app.research.financial_models import FactSnapshot
from app.research.store import ResearchStore, now

MAX_SNAPSHOT_CHARS = 3_000_000
MAX_SNAPSHOT_FACTS = 1000


def content_hash(document: dict) -> str:
    return hashlib.sha256(json.dumps(document, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def fact_signature(fact: dict):
    return fact["id"], fact["revision"], fact["status"], fact["source_available"], fact["removed_at"]


def input_changes(db, run: dict) -> list[str]:
    snapshot = run["snapshot"]
    reasons = []
    case_row = db.execute("SELECT payload FROM research_cases WHERE id=?", (run["case_id"],)).fetchone()
    if case_row:
        current_case = json.loads(case_row["payload"])
        if any(current_case.get(field) != snapshot["case"].get(field) for field in
               ("title", "company_name", "ticker", "research_question", "reporting_period", "research_as_of_date")):
            reasons.append("Relevant saved case metadata changed after the run snapshot.")
    for saved in snapshot["documents"]:
        doc = saved["document"]
        row = db.execute("SELECT payload FROM documents WHERE id=? AND case_id=?", (doc["id"], run["case_id"])).fetchone()
        if not row:
            reasons.append(f"Selected source removed: {doc['id']} ({doc['title']}).")
            continue
        pages = [json.loads(p["payload"]) for p in db.execute("SELECT payload FROM pages WHERE document_id=? ORDER BY position", (doc["id"],)).fetchall()]
        if content_hash({**json.loads(row["payload"]), "pages": pages}) != saved["content_hash"]:
            reasons.append(f"Selected source content/metadata changed: {doc['id']}.")
    current = [json.loads(row["payload"]) for row in db.execute("SELECT payload FROM financial_facts WHERE case_id=?", (run["case_id"],)).fetchall()]
    included = {d["document"]["id"] for d in snapshot["documents"] if d["included"]}
    saved_ids = {f["id"] for f in snapshot["facts"]}
    if {fact_signature(f) for f in current if f["document_id"] in included} != {fact_signature(f) for f in snapshot["facts"]}:
        reasons.append("Selected-source fact catalog, revisions, review statuses, or availability changed.")
    identities = {financial_identity(f) for f in snapshot["facts"] if f["status"] == "confirmed"}
    if any(f["id"] not in saved_ids and f["status"] == "confirmed" and not f["removed_at"] and f["source_available"]
           and financial_identity(f) in identities for f in current):
        reasons.append("A new confirmed alternative for a snapshotted financial input exists; analyst resolution is required.")
    for selected in snapshot["selected_receipts"]:
        row = db.execute("SELECT payload FROM calculation_receipts WHERE case_id=? AND id=?", (run["case_id"], selected["id"])).fetchone()
        if row is None or json.loads(row["payload"])["status"] != "valid":
            reasons.append(f"Selected Financials receipt is no longer valid: {selected['id']}.")
    return reasons


def invalidate_analyses(db, case_id: str):
    for row in db.execute("SELECT id,payload FROM analysis_runs WHERE case_id=?", (case_id,)).fetchall():
        run = json.loads(row["payload"])
        changes = input_changes(db, run)
        if changes:
            run["stale"] = True
            run["stale_reasons"] = list(dict.fromkeys(run["stale_reasons"] + changes))
            db.execute("UPDATE analysis_runs SET payload=? WHERE id=?", (json.dumps(run), row["id"]))
    from app.research.verification_store import invalidate_verifications
    invalidate_verifications(db, case_id)


class AnalysisStore:
    def __init__(self, store: ResearchStore):
        self.store = store

    def _payload(self, db, case_id, run_id):
        row = db.execute("SELECT payload FROM analysis_runs WHERE id=? AND case_id=?", (run_id, case_id)).fetchone()
        if not row:
            raise HTTPException(404, "Analysis run not found in this case.")
        return json.loads(row["payload"])

    def create(self, case_id: str, request: AnalysisStart) -> dict:
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            case = self.store._case(db, case_id)
            if request.automation_run_id:
                if not db.execute('SELECT 1 FROM automation_runs WHERE id=? AND case_id=?',(request.automation_run_id,case_id)).fetchone():
                    raise HTTPException(422,'Automation origin does not belong to this case.')
                for previous in db.execute('SELECT id,payload FROM analysis_runs WHERE case_id=?',(case_id,)):
                    old=json.loads(previous['payload'])
                    if old.get('request',{}).get('automation_run_id')==request.automation_run_id:
                        if old['request']!=request.model_dump(mode='json'):
                            raise HTTPException(409,'Automation inputs changed after continuation. Start a new automation to preserve the original research snapshot.')
                        return self.get(case_id,previous['id'])
            if db.execute("SELECT id FROM analysis_runs WHERE case_id=? AND status IN ('queued','running')", (case_id,)).fetchone():
                raise HTTPException(409, "Dexter research is already queued or running for this case.")
            documents, characters = [], 0
            for document_id in dict.fromkeys(request.document_ids):
                row = db.execute("SELECT payload FROM documents WHERE id=? AND case_id=?", (document_id, case_id)).fetchone()
                if not row:
                    raise HTTPException(422, "A selected source does not belong to this case or is unavailable.")
                pages = [json.loads(p["payload"]) for p in db.execute("SELECT payload FROM pages WHERE document_id=? ORDER BY position", (document_id,)).fetchall()]
                doc = {**json.loads(row["payload"]), "pages": pages}
                characters += sum(len(p["text"]) for p in pages)
                if characters > MAX_SNAPSHOT_CHARS:
                    raise HTTPException(422, "Select fewer documents: analysis snapshots support at most 3 million source characters.")
                as_of, publication = str(request.research_as_of_date) if request.research_as_of_date else case.get("research_as_of_date"), doc.get("publication_date")
                included = not (as_of and publication and publication > as_of)
                documents.append(SnapshotDocument(document=doc, content_hash=content_hash(doc), included=included,
                    exclusion_reason=None if included else f"Published after research-as-of date {as_of}."))
            included_ids = {d.document.id for d in documents if d.included}
            facts = [json.loads(row["payload"]) for row in db.execute("SELECT payload FROM financial_facts WHERE case_id=?", (case_id,)).fetchall()]
            facts = [FactSnapshot.model_validate(f) for f in facts if f["document_id"] in included_ids]
            if request.fact_ids is not None:
                if set(request.fact_ids)-{f.id for f in facts}:
                    raise HTTPException(422,'Automation selected facts must belong to the included case documents.')
                facts=[f for f in facts if f.id in request.fact_ids]
            if len(facts) > MAX_SNAPSHOT_FACTS:
                raise HTTPException(422, "Select fewer sources: analysis snapshots support at most 1000 facts.")
            receipts = []
            for receipt_id in dict.fromkeys(request.receipt_ids):
                row = db.execute("SELECT payload FROM calculation_receipts WHERE case_id=? AND id=?", (case_id, receipt_id)).fetchone()
                if not row:
                    raise HTTPException(422, "Selected receipt does not belong to this case.")
                receipt = json.loads(row["payload"])
                if receipt["status"] != "valid" or any(f["document_id"] not in included_ids for f in receipt["inputs"].values()):
                    raise HTTPException(422, "Selected receipts must be valid and use only the included selected sources.")
                receipts.append(receipt)
            snapshot = AnalysisSnapshot(case=case, documents=documents, facts=facts, selected_receipts=receipts,
                research_as_of_date=request.research_as_of_date or case.get("research_as_of_date"))
            timestamp, run_id = now(), str(uuid4())
            primary_model, fallback_model = model_configuration()
            warnings = [f"Publication date unknown for {d.document.title}; temporal eligibility is uncertain." for d in documents if d.included and not d.document.publication_date]
            run = {"id": run_id, "case_id": case_id, "question": request.question_override or case["research_question"],
                "request": request.model_dump(mode="json"), "question_overridden": request.question_override is not None, "status": "queued", "stale": False,
                "stale_reasons": [], "created_at": timestamp, "started_at": None, "finished_at": None,
                "requested_model": {"primary": primary_model, "fallback": fallback_model, "temperature": 0.0,
                    "helper_max_attempts_per_call": MAX_RETRIES + 1, "max_output_tokens_per_call": 2400,
                    "provider_timeout_seconds": 35, "execution_budget_seconds": 100, "observed_serving_model": None},
                "snapshot": snapshot.model_dump(mode="json"), "plan": None, "retrieval": None, "financial": None, "brief": None,
                "receipt_ids": [], "warnings": warnings, "limitations": ["Local single-process execution; no automatic resume or distributed queue.",
                    "Selected inputs are snapshotted; new documents are not silently included.",
                    "Selected-document research only; no external filings/news, risk rating or trading action. Reviewer labels are unauthenticated."], "errors": []}
            try:
                db.execute("INSERT INTO analysis_runs VALUES (?,?,?,?)", (run_id, case_id, "queued", json.dumps(run)))
            except sqlite3.IntegrityError:
                raise HTTPException(409, "Dexter research is already active for this case.") from None
            self._event(db, run_id, "execution", "queued", "Research run saved and queued.")
        return self.get(case_id, run_id)

    def _event(self, db, run_id, stage, transition, message):
        sequence = db.execute("SELECT COALESCE(MAX(sequence),0)+1 FROM analysis_events WHERE run_id=?", (run_id,)).fetchone()[0]
        event = {"id": str(uuid4()), "sequence": sequence, "stage": stage, "transition": transition, "timestamp": now(), "message": message}
        db.execute("INSERT INTO analysis_events VALUES (?,?,?)", (run_id, sequence, json.dumps(event)))

    def update(self, case_id, run_id, *, changes=None, event=None, output=None):
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            run = self._payload(db, case_id, run_id)
            run.update(changes or {})
            if output:
                stage, value = output
                db.execute("INSERT INTO analysis_stage_outputs VALUES (?,?,?)", (run_id, stage, json.dumps(value)))
                field = {"scope_resolution": "scope", "risk_assessment": "risks", "report_composition": "report", "planning": "plan", "evidence_retrieval": "retrieval", "financial_analysis": "financial", "verification": "verification", "brief_assembly": "brief"}[stage]
                run[field] = value
                if stage == "evidence_retrieval":
                    for passage in value["passages"]:
                        db.execute("INSERT INTO analysis_evidence VALUES (?,?,?)", (passage["id"], run_id, json.dumps(passage)))
                if stage == "financial_analysis":
                    run["receipt_ids"] = value["receipt_ids"]
                if stage == "brief_assembly":
                    db.execute("INSERT INTO research_briefs VALUES (?,?,?)", (value["id"], run_id, json.dumps(value)))
            changed = input_changes(db, run)
            if changed:
                run["stale"] = True
                run["stale_reasons"] = list(dict.fromkeys(run["stale_reasons"] + changed))
            db.execute("UPDATE analysis_runs SET status=?,payload=? WHERE id=?", (run["status"], json.dumps(run), run_id))
            if event:
                self._event(db, run_id, *event)

    def get(self, case_id, run_id):
        with self.store.connection() as db:
            run = self._payload(db, case_id, run_id)
            changes = input_changes(db, run)
            if changes:
                run["stale"] = True
                run["stale_reasons"] = list(dict.fromkeys(run["stale_reasons"] + changes))
                db.execute("UPDATE analysis_runs SET payload=? WHERE id=?", (json.dumps(run), run_id))
            run["events"] = [json.loads(row["payload"]) for row in db.execute("SELECT payload FROM analysis_events WHERE run_id=? ORDER BY sequence", (run_id,)).fetchall()]
            run["stage_outputs"] = {row["stage"]: json.loads(row["payload"]) for row in db.execute("SELECT stage,payload FROM analysis_stage_outputs WHERE run_id=?", (run_id,)).fetchall()}
            run["excluded_document_ids"] = [d["document"]["id"] for d in run["snapshot"]["documents"] if not d["included"]]
            current = {row["id"] for row in db.execute("SELECT id FROM documents WHERE case_id=?", (case_id,)).fetchall()}
            selected = {d["document"]["id"] for d in run["snapshot"]["documents"]}
            run["source_availability"] = {doc_id: doc_id in current for doc_id in selected}
            run["not_included_document_ids"] = sorted(current - selected)
            return run

    def list(self, case_id):
        self.store.get_case(case_id)
        with self.store.connection() as db:
            ids = [row["id"] for row in db.execute("SELECT id FROM analysis_runs WHERE case_id=? ORDER BY rowid DESC", (case_id,)).fetchall()]
        return [self.get(case_id, run_id) for run_id in ids]

    def interrupt_active(self):
        # Called once by app lifespan at startup, not by read requests or token guesses.
        with self.store.connection() as db:
            for row in db.execute("SELECT id,payload FROM analysis_runs WHERE status IN ('queued','running')").fetchall():
                run = json.loads(row["payload"])
                run.update(status="interrupted", finished_at=now())
                run["errors"].append("Backend restarted before completion. Run was interrupted; no automatic resume.")
                db.execute("UPDATE analysis_runs SET status='interrupted',payload=? WHERE id=?", (json.dumps(run), row["id"]))
                self._event(db, row["id"], "execution", "interrupted", run["errors"][-1])
