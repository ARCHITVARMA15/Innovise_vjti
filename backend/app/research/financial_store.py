import hashlib
import json
import re
from decimal import Context, Decimal
from uuid import uuid4

from fastapi import HTTPException

from app.research.financial_models import FactInput, FactUpdate
from app.research.store import ResearchStore, now

WORKER_ID = str(uuid4())


def normalize_whitespace(text: str) -> str:
    """Only collapse Unicode whitespace runs and strip leading/trailing whitespace."""
    return re.sub(r"\s+", " ", text).strip()


def validate_excerpt(text: str, excerpt: str):
    normalized = normalize_whitespace(excerpt)
    if not normalized or normalized not in normalize_whitespace(text):
        raise HTTPException(422, "Supporting excerpt does not match the saved source (only whitespace normalization is allowed).")


def invalidate_receipts(db, fact_id: str, reason: str):
    rows = db.execute("SELECT r.id, r.payload FROM calculation_receipts r JOIN calculation_inputs i ON i.receipt_id=r.id WHERE i.fact_id=?", (fact_id,)).fetchall()
    for row in rows:
        payload = json.loads(row["payload"])
        if payload["status"] != "stale":
            payload.update(status="stale", invalidated_at=now(), invalidation_reason=reason)
            db.execute("UPDATE calculation_receipts SET payload=? WHERE id=?", (json.dumps(payload), row["id"]))
    row = db.execute("SELECT case_id FROM financial_facts WHERE id=?", (fact_id,)).fetchone()
    if row:
        from app.research.analysis_store import invalidate_analyses
        invalidate_analyses(db, row["case_id"])


def invalidate_document(db, case_id: str, document_id: str):
    rows = db.execute("SELECT id, payload FROM financial_facts WHERE case_id=? AND document_id=?", (case_id, document_id)).fetchall()
    for row in rows:
        fact = json.loads(row["payload"])
        fact.update(source_available=False, updated_at=now())
        db.execute("UPDATE financial_facts SET payload=? WHERE id=?", (json.dumps(fact), row["id"]))
        invalidate_receipts(db, row["id"], "Source document removed. Historical excerpts are retained, but the source is unavailable.")


class FinancialStore:
    def __init__(self, store: ResearchStore):
        self.store = store

    def source(self, db, case_id: str, values: FactInput) -> dict:
        row = db.execute("""SELECT d.payload AS document, p.payload AS section FROM documents d
            JOIN pages p ON p.document_id=d.id WHERE d.case_id=? AND d.id=? AND p.id=?""",
            (case_id, values.document_id, values.section_id)).fetchone()
        if row is None:
            raise HTTPException(422, "Document/section reference is unavailable or does not belong to this case.")
        document, section = json.loads(row["document"]), json.loads(row["section"])
        validate_excerpt(section["text"], values.excerpt)
        if values.span_id:
            if (values.span_start is None or values.span_end is None or values.span_start < 0
                    or values.span_end <= values.span_start or values.span_end > len(section['text'])
                    or section['text'][values.span_start:values.span_end] != values.excerpt
                    or values.span_id != f"{values.section_id}:{values.span_start}:{values.span_end}"):
                raise HTTPException(422,'Extraction span ID/offsets must match exact saved text.')
        contexts=[]
        for span_id in values.context_span_ids:
            try:
                section_id,start,end=span_id.rsplit(':',2)
                start,end=int(start),int(end)
            except (ValueError,AttributeError):
                raise HTTPException(422,'Invalid context span ID.') from None
            if section_id!=values.section_id or not 0<=start<end<=len(section['text']) or end-start>4000:
                raise HTTPException(422,'Context span must be a bounded exact slice of the saved section.')
            contexts.append({'id':span_id,'section_id':section_id,'start_offset':start,'end_offset':end,'excerpt':section['text'][start:end]})
        from app.research.automation.sources import validate_structured_context
        structured = validate_structured_context(db, case_id, values)
        return {"structured_provenance":structured,"context_spans":contexts,"document_id": document["id"], "section_id": section["id"], "document_title": document["title"],
                "label": section["label"], "page_number": section["page_number"],
                "source_url": document["source_url"], "excerpt": values.excerpt}

    def _fact(self, db, case_id: str, fact_id: str) -> dict:
        row = db.execute("SELECT payload FROM financial_facts WHERE case_id=? AND id=?", (case_id, fact_id)).fetchone()
        if row is None:
            raise HTTPException(404, "Fact not found in this case.")
        fact = json.loads(row["payload"])
        fact["history"] = [json.loads(item["payload"]) for item in db.execute(
            "SELECT payload FROM fact_revisions WHERE fact_id=? ORDER BY revision", (fact_id,)).fetchall()]
        return fact

    def list_facts(self, case_id: str) -> list[dict]:
        with self.store.connection() as db:
            self.store._case(db, case_id)
            rows = db.execute("SELECT id FROM financial_facts WHERE case_id=? ORDER BY rowid DESC", (case_id,)).fetchall()
            return [self._fact(db, case_id, row["id"]) for row in rows]

    def add_fact(self, case_id: str, values: FactInput, origin="manual", extraction=False) -> tuple[dict, bool]:
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            self.store._case(db, case_id)
            snapshot = self.source(db, case_id, values)
            original = values.model_dump(mode="json")
            # Deduplicate the original proposal, never overwrite analyst revisions or merge conflicts.
            identity = {**original, "excerpt": normalize_whitespace(values.excerpt)}
            identity.pop("ambiguity_note", None)
            for field in ('span_id','span_start','span_end','context_span_ids'):
                identity.pop(field,None)
            identity.pop("excerpt", None)
            identity["value"] = str(Decimal(values.value).normalize(context=Context(prec=80)))
            dedup = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
            existing = db.execute("SELECT id FROM financial_facts WHERE case_id=? AND dedup_key=?", (case_id, dedup)).fetchone()
            if existing:
                return self._fact(db, case_id, existing["id"]), False
            timestamp, fact_id = now(), str(uuid4())
            missing = not all((values.entity, values.currency, values.scale, values.accounting_scope,
                               values.period_end, values.period_type != "unknown"))
            if values.period_type == "duration" and not values.period_start:
                missing = True
            status = "needs_review" if values.ambiguity_note or (extraction and missing) else "candidate"
            fact = {**original, "id": fact_id, "case_id": case_id, "status": status,
                    "origin": origin, "created_at": timestamp, "updated_at": timestamp,
                    "revision": 1, "source_available": True, "source_snapshot": snapshot,
                    "original_values": original, "removed_at": None}
            db.execute("INSERT INTO financial_facts VALUES (?, ?, ?, ?, ?, ?)",
                       (fact_id, case_id, values.document_id, values.section_id, dedup, json.dumps(fact)))
            history = {"revision": 1, "timestamp": timestamp, "action": "created", "reason": origin,
                       "values": {**original, "status": status, "source_snapshot": snapshot}}
            db.execute("INSERT INTO fact_revisions VALUES (?, ?, ?)", (fact_id, 1, json.dumps(history)))
            db.execute("UPDATE research_cases SET updated_at=? WHERE id=?", (timestamp, case_id))
            from app.research.analysis_store import invalidate_analyses
            invalidate_analyses(db, case_id)
            return self._fact(db, case_id, fact_id), True

    def update_fact(self, case_id: str, fact_id: str, update: FactUpdate) -> dict:
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            return self.update_fact_in_transaction(db, case_id, fact_id, update)

    def update_fact_in_transaction(self, db, case_id: str, fact_id: str, update: FactUpdate) -> dict:
        fact = self._fact(db, case_id, fact_id)
        if fact["revision"] != update.expected_revision:
            raise HTTPException(409, "Fact changed since it was loaded. Reload before reviewing.")
        if fact["removed_at"]:
            raise HTTPException(409, "This fact was removed and cannot be edited.")
        snapshot = self.source(db, case_id, update.values)
        if update.status == "confirmed" and update.values.ambiguity_note:
            raise HTTPException(422, "Resolve and clear the ambiguity note before confirming this fact.")
        timestamp = now()
        fact.pop("history", None)
        fact.update(**update.values.model_dump(mode="json"), status=update.status, revision=fact["revision"] + 1,
                    updated_at=timestamp, source_snapshot=snapshot, source_available=True)
        db.execute("UPDATE financial_facts SET document_id=?, section_id=?, payload=? WHERE id=? AND case_id=?",
                   (fact["document_id"], fact["section_id"], json.dumps(fact), fact_id, case_id))
        history = {"revision": fact["revision"], "timestamp": timestamp, "action": "analyst_review",
                   "reason": update.reason, "values": {**update.values.model_dump(mode="json"),
                   "status": update.status, "source_snapshot": snapshot}}
        db.execute("INSERT INTO fact_revisions VALUES (?, ?, ?)", (fact_id, fact["revision"], json.dumps(history)))
        invalidate_receipts(db, fact_id, f"Input fact revised to revision {fact['revision']} ({update.status}).")
        if update.status == "confirmed":
            from app.research.calculations import financial_identity, normalized_value
            for row in db.execute("SELECT id, payload FROM financial_facts WHERE case_id=? AND id<>?", (case_id, fact_id)).fetchall():
                other = json.loads(row["payload"])
                if (other["status"] == "confirmed" and not other["removed_at"] and other["source_available"]
                        and financial_identity(other) == financial_identity(fact) and other["scale"] and fact["scale"]
                        and normalized_value(other["value"], other["scale"]) != normalized_value(fact["value"], fact["scale"])):
                    invalidate_receipts(db, other["id"], "A competing confirmed value was introduced. Recalculate with explicit conflict resolution.")
        db.execute("UPDATE research_cases SET updated_at=? WHERE id=?", (timestamp, case_id))
        return self._fact(db, case_id, fact_id)

    def remove_fact(self, case_id: str, fact_id: str, revision: int):
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            fact = self._fact(db, case_id, fact_id)
            if fact["revision"] != revision:
                raise HTTPException(409, "Fact changed. Reload before removing.")
            fact.pop("history", None)
            timestamp = now()
            fact.update(removed_at=timestamp, updated_at=timestamp, revision=revision + 1)
            db.execute("UPDATE financial_facts SET payload=? WHERE id=?", (json.dumps(fact), fact_id))
            db.execute("INSERT INTO fact_revisions VALUES (?, ?, ?)", (fact_id, revision + 1, json.dumps({
                "revision": revision + 1, "timestamp": timestamp, "action": "removed", "reason": "Analyst removed fact",
                "values": fact})))
            invalidate_receipts(db, fact_id, "Input fact removed by analyst.")

    def save_run(self, run: dict):
        with self.store.connection() as db:
            db.execute("INSERT INTO extraction_runs VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
                       (run["id"], run["case_id"], json.dumps({**run, "worker_id": WORKER_ID})))

    def list_runs(self, case_id: str) -> list[dict]:
        with self.store.connection() as db:
            self.store._case(db, case_id)
            runs = []
            for row in db.execute("SELECT payload FROM extraction_runs WHERE case_id=? ORDER BY rowid DESC", (case_id,)).fetchall():
                run = json.loads(row["payload"])
                if run["status"] == "running" and run.get("worker_id") != WORKER_ID:
                    run.update(status="failed", finished_at=now())
                    run["errors"].append("Extraction interrupted by backend restart. Previously saved facts are retained.")
                    for section in run["sections"]:
                        if section["status"] == "pending":
                            section.update(status="failed", message="Backend restarted before this section completed.")
                    db.execute("UPDATE extraction_runs SET payload=? WHERE id=?", (json.dumps(run), run["id"]))
                run.pop("worker_id", None)
                runs.append(run)
            return runs

    def list_receipts(self, case_id: str) -> list[dict]:
        with self.store.connection() as db:
            self.store._case(db, case_id)
            return [json.loads(row["payload"]) for row in db.execute(
                "SELECT payload FROM calculation_receipts WHERE case_id=? ORDER BY rowid DESC", (case_id,)).fetchall()]
