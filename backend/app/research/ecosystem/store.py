"""Additive, case-scoped storage in Research Lab's existing SQLite database."""
import json
from uuid import uuid4

from fastapi import HTTPException

from app.research.store import ResearchStore, now
from .models import Event, InvestigationStart, Review, ReviewInput, Run, Scenario


def migrate(db):
    db.executescript('''
        CREATE TABLE IF NOT EXISTS ecosystem_runs (
            id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES research_cases(id),
            status TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ecosystem_case ON ecosystem_runs(case_id);
        CREATE TABLE IF NOT EXISTS ecosystem_objects (
            run_id TEXT NOT NULL REFERENCES ecosystem_runs(id), id TEXT NOT NULL,
            kind TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(run_id, kind, id)
        );
        CREATE TABLE IF NOT EXISTS ecosystem_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES ecosystem_runs(id),
            payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ecosystem_reviews (
            id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES ecosystem_runs(id), payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ecosystem_scenarios (
            id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES ecosystem_runs(id), payload TEXT NOT NULL
        );
        INSERT OR IGNORE INTO research_migrations(version) VALUES (6);
    ''')


class EcosystemStore:
    def __init__(self, research: ResearchStore):
        self.research = research
        with research.connection() as db:
            migrate(db)

    def _read(self, db, case_id, run_id):
        self.research._case(db, case_id)
        row = db.execute('SELECT payload FROM ecosystem_runs WHERE case_id=? AND id=?', (case_id, run_id)).fetchone()
        if row is None:
            raise HTTPException(404, 'Ecosystem investigation not found in this case.')
        run = Run.model_validate_json(row['payload'])
        run.events = [Event(id=r['id'], **json.loads(r['payload'])) for r in db.execute('SELECT * FROM ecosystem_events WHERE run_id=? ORDER BY id', (run_id,))]
        run.reviews = [Review.model_validate_json(r['payload']) for r in db.execute('SELECT payload FROM ecosystem_reviews WHERE run_id=? ORDER BY rowid', (run_id,))]
        run.scenarios = [Scenario.model_validate_json(r['payload']) for r in db.execute('SELECT payload FROM ecosystem_scenarios WHERE run_id=? ORDER BY rowid', (run_id,))]
        # An immutable snapshot remains readable after a source is removed/revised,
        # but human approval must not silently certify stale case evidence.
        for source in run.sources:
            if source.case_document_id:
                found = db.execute('SELECT 1 FROM documents WHERE case_id=? AND id=?', (case_id, source.case_document_id)).fetchone()
                if not found:
                    run.source_state = 'stale'
        for metric in run.metrics:
            if metric.source_fact_id:
                row = db.execute('SELECT payload FROM financial_facts WHERE case_id=? AND id=?', (case_id, metric.source_fact_id)).fetchone()
                fact = json.loads(row['payload']) if row else None
                if not fact or fact['revision'] != metric.source_fact_revision or fact['removed_at'] or not fact['source_available'] or fact['status'] != 'confirmed':
                    run.source_state = 'stale'
        return run

    def get(self, case_id, run_id):
        with self.research.connection() as db:
            return self._read(db, case_id, run_id)

    def list(self, case_id):
        with self.research.connection() as db:
            self.research._case(db, case_id)
            return [self._read(db, case_id, row['id']) for row in db.execute('SELECT id FROM ecosystem_runs WHERE case_id=? ORDER BY rowid DESC LIMIT 50', (case_id,))]

    def create(self, case_id, request: InvestigationStart, mode):
        run = Run(id=str(uuid4()), case_id=case_id, request=request, mode=mode, status='queued', created_at=now(),
                  limitations=['One-hop curated investigation; no live monitoring, trades or loss prediction.',
                               'Reviewer labels are not authenticated accounts.',
                               'No model or network tools are enabled in this workflow.'])
        with self.research.connection() as db:
            self.research._case(db, case_id)
            db.execute('INSERT INTO ecosystem_runs VALUES (?, ?, ?, ?, ?)', (run.id, case_id, run.status, run.revision, run.model_dump_json(exclude={'events', 'reviews', 'scenarios'})))
        self.event(case_id, run.id, 'supervisor', 'queued', 'Optional ecosystem investigation queued.')
        return self.get(case_id, run.id)

    def event(self, case_id, run_id, stage, transition, message):
        with self.research.connection() as db:
            if not db.execute('SELECT 1 FROM ecosystem_runs WHERE id=? AND case_id=?', (run_id, case_id)).fetchone():
                raise HTTPException(404, 'Investigation not found in this case.')
            db.execute('INSERT INTO ecosystem_events(run_id,payload) VALUES (?,?)', (run_id, json.dumps({'stage': stage, 'transition': transition, 'message': message, 'created_at': now()})))

    def save(self, run: Run):
        run = Run.model_validate(run.model_dump())
        with self.research.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            old = self._read(db, run.case_id, run.id)
            if old.status in ('completed', 'partial', 'needs_input', 'failed', 'interrupted'):
                raise HTTPException(409, 'A finished investigation is immutable. Start a new run.')
            run.revision = old.revision + 1
            db.execute('UPDATE ecosystem_runs SET status=?,revision=?,payload=? WHERE id=? AND case_id=?',
                       (run.status, run.revision, run.model_dump_json(exclude={'events', 'reviews', 'scenarios'}), run.id, run.case_id))
            for kind in ('entities', 'sources', 'relationships', 'metrics', 'exposures', 'assessments', 'findings'):
                for value in getattr(run, kind):
                    key = getattr(value, 'id', None) or getattr(value, 'relationship_id', None) or value.entity_id
                    db.execute('INSERT OR REPLACE INTO ecosystem_objects VALUES (?,?,?,?)', (run.id, key, kind, value.model_dump_json()))

    def review(self, case_id, run_id, payload: ReviewInput):
        with self.research.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            run = self._read(db, case_id, run_id)
            if run.revision != payload.expected_revision:
                raise HTTPException(409, 'Investigation changed. Refresh before reviewing.')
            if run.status not in ('completed', 'partial'):
                raise HTTPException(409, 'Only completed or partial investigations can be reviewed.')
            if payload.decision == 'APPROVE' and (run.source_state == 'stale' or not payload.acknowledge_limitations):
                raise HTTPException(409, 'Approval requires current case evidence and explicit acknowledgement of limitations.')
            review = Review(**payload.model_dump(), id=str(uuid4()), created_at=now())
            run.review_state = {'APPROVE': 'APPROVED', 'REJECT': 'REJECTED', 'REQUEST_CHANGES': 'CHANGES_REQUESTED'}[payload.decision]
            run.revision += 1
            db.execute('INSERT INTO ecosystem_reviews VALUES (?,?,?)', (review.id, run_id, review.model_dump_json()))
            db.execute('UPDATE ecosystem_runs SET revision=?,payload=? WHERE id=? AND case_id=?',
                       (run.revision, run.model_dump_json(exclude={'events', 'reviews', 'scenarios'}), run_id, case_id))
            db.execute('INSERT INTO ecosystem_events(run_id,payload) VALUES (?,?)', (run_id, json.dumps({'stage': 'human_review', 'transition': payload.decision, 'message': 'Human disposition recorded; machine evidence verdicts are unchanged.', 'created_at': now()})))
        return self.get(case_id, run_id)

    def add_scenario(self, case_id, run_id, result: Scenario):
        with self.research.connection() as db:
            db.execute('BEGIN IMMEDIATE')
            run = self._read(db, case_id, run_id)
            if run.status not in ('completed', 'partial'):
                raise HTTPException(409, 'Wait for the investigation to finish.')
            if run.source_state == 'stale':
                raise HTTPException(409, 'Case evidence changed. Start a new investigation.')
            db.execute('INSERT INTO ecosystem_scenarios VALUES (?,?,?)', (result.id, run_id, result.model_dump_json()))
            # Scenario edits are new report inputs: any earlier disposition remains
            # in history, but the current report must return to human review.
            run.review_state = 'NEEDS_REVIEW'
            run.revision += 1
            db.execute('UPDATE ecosystem_runs SET revision=?,payload=? WHERE id=? AND case_id=?',
                       (run.revision, run.model_dump_json(exclude={'events', 'reviews', 'scenarios'}), run_id, case_id))
            db.execute('INSERT INTO ecosystem_events(run_id,payload) VALUES (?,?)', (run_id, json.dumps({'stage': 'scenario', 'transition': result.status, 'message': 'User-defined scenario inputs saved; current report returned to review.', 'created_at': now()})))
        return self.get(case_id, run_id)

    def interrupt_active(self):
        with self.research.connection() as db:
            for row in db.execute("SELECT * FROM ecosystem_runs WHERE status IN ('queued','running')").fetchall():
                run = Run.model_validate_json(row['payload'])
                run.status = 'interrupted'
                run.finished_at = now()
                run.errors.append('Worker stopped before completion. Start a new run; no completion is inferred.')
                run.revision += 1
                db.execute('UPDATE ecosystem_runs SET status=?,revision=?,payload=? WHERE id=?', (run.status, run.revision, run.model_dump_json(exclude={'events', 'reviews', 'scenarios'}), run.id))
                db.execute('INSERT INTO ecosystem_events(run_id,payload) VALUES (?,?)', (run.id, json.dumps({'stage': 'execution', 'transition': 'interrupted', 'message': 'Previous worker stopped before completion; a new run is required.', 'created_at': now()})))
