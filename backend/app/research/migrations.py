"""Additive schema v2. Existing case/document/page tables and IDs are untouched."""


def migrate_financials(db):
    db.executescript("""
        CREATE TABLE IF NOT EXISTS research_migrations (
            version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS financial_facts (
            id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES research_cases(id),
            document_id TEXT NOT NULL, section_id TEXT NOT NULL,
            dedup_key TEXT NOT NULL, payload TEXT NOT NULL,
            UNIQUE(case_id, dedup_key)
        );
        CREATE INDEX IF NOT EXISTS facts_case ON financial_facts(case_id);
        CREATE INDEX IF NOT EXISTS facts_document ON financial_facts(document_id);
        CREATE TABLE IF NOT EXISTS fact_revisions (
            fact_id TEXT NOT NULL REFERENCES financial_facts(id),
            revision INTEGER NOT NULL, payload TEXT NOT NULL,
            PRIMARY KEY(fact_id, revision)
        );
        CREATE TABLE IF NOT EXISTS calculation_receipts (
            id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES research_cases(id),
            payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS receipts_case ON calculation_receipts(case_id);
        CREATE TABLE IF NOT EXISTS calculation_inputs (
            receipt_id TEXT NOT NULL REFERENCES calculation_receipts(id),
            fact_id TEXT NOT NULL REFERENCES financial_facts(id), revision INTEGER NOT NULL,
            PRIMARY KEY(receipt_id, fact_id)
        );
        CREATE INDEX IF NOT EXISTS inputs_fact ON calculation_inputs(fact_id);
        CREATE TABLE IF NOT EXISTS extraction_runs (
            id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES research_cases(id),
            payload TEXT NOT NULL
        );
        INSERT OR IGNORE INTO research_migrations(version) VALUES (1), (2);
    """)


def migrate_analysis(db):
    db.executescript("""
        CREATE TABLE IF NOT EXISTS analysis_runs (
            id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES research_cases(id),
            status TEXT NOT NULL, payload TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS analysis_one_active_case ON analysis_runs(case_id)
            WHERE status IN ('queued','running');
        CREATE TABLE IF NOT EXISTS analysis_events (
            run_id TEXT NOT NULL REFERENCES analysis_runs(id), sequence INTEGER NOT NULL,
            payload TEXT NOT NULL, PRIMARY KEY(run_id,sequence)
        );
        CREATE TABLE IF NOT EXISTS analysis_stage_outputs (
            run_id TEXT NOT NULL REFERENCES analysis_runs(id), stage TEXT NOT NULL,
            payload TEXT NOT NULL, PRIMARY KEY(run_id,stage)
        );
        CREATE TABLE IF NOT EXISTS analysis_evidence (
            id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES analysis_runs(id), payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS research_briefs (
            id TEXT PRIMARY KEY, run_id TEXT NOT NULL UNIQUE REFERENCES analysis_runs(id), payload TEXT NOT NULL
        );
        INSERT OR IGNORE INTO research_migrations(version) VALUES (3);
    """)


def migrate_verification(db):
    db.executescript("""
        CREATE TABLE IF NOT EXISTS research_claims (
            id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES research_cases(id),
            origin_key TEXT, payload TEXT NOT NULL, UNIQUE(case_id,origin_key)
        );
        CREATE TABLE IF NOT EXISTS claim_revisions (
            claim_id TEXT NOT NULL REFERENCES research_claims(id), revision INTEGER NOT NULL,
            payload TEXT NOT NULL, PRIMARY KEY(claim_id,revision)
        );
        CREATE TABLE IF NOT EXISTS verification_runs (
            id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES research_cases(id),
            claim_id TEXT NOT NULL REFERENCES research_claims(id), status TEXT NOT NULL, payload TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS verification_one_active_claim ON verification_runs(claim_id)
            WHERE status IN ('queued','running');
        CREATE TABLE IF NOT EXISTS claim_extractions (
            id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES research_cases(id), payload TEXT NOT NULL
        );
        INSERT OR IGNORE INTO research_migrations(version) VALUES (4);
    """)


def migrate_reports(db):
    db.executescript("""
        CREATE TABLE IF NOT EXISTS research_reports (
            id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES research_cases(id),
            version INTEGER NOT NULL, payload TEXT NOT NULL, UNIQUE(case_id, version)
        );
        CREATE TABLE IF NOT EXISTS report_reviews (
            report_id TEXT NOT NULL REFERENCES research_reports(id), revision INTEGER NOT NULL,
            payload TEXT NOT NULL, PRIMARY KEY(report_id, revision)
        );
        INSERT OR IGNORE INTO research_migrations(version) VALUES (5);
    """)
