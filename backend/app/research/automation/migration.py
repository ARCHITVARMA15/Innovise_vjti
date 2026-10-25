def migrate(db):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES research_cases(id),
      request_id TEXT UNIQUE NOT NULL, status TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS automation_case ON automation_runs(case_id);
    CREATE TABLE IF NOT EXISTS automation_events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES automation_runs(id), payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS automation_sources (
      id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES research_cases(id), identity TEXT NOT NULL,
      content_hash TEXT NOT NULL, document_id TEXT NOT NULL, payload TEXT NOT NULL,
      UNIQUE(case_id,identity,content_hash));
    CREATE TABLE IF NOT EXISTS automation_contexts (
      section_id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES research_cases(id), payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS automation_reviews (
      request_id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES automation_runs(id), payload TEXT NOT NULL);
    INSERT OR IGNORE INTO research_migrations(version) VALUES(7);
    ''')
