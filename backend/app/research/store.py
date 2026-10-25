"""Isolated SQLite storage; source files stay outside the public/static tree."""
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException

from app.research.models import CaseCreate, DocumentMetadata
from app.research.migrations import migrate_financials, migrate_analysis, migrate_verification, migrate_reports


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def research_directory() -> Path:
    default = Path(__file__).resolve().parents[2] / "research_data"
    return Path(os.environ.get("VERITAS_RESEARCH_DIR", str(default)))


class ResearchStore:
    def __init__(self, directory: Path):
        self.directory = directory
        self.uploads = directory / "uploads"
        self.uploads.mkdir(parents=True, exist_ok=True)
        self.database = directory / "research.sqlite3"
        with self.connection() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS research_cases (
                    id TEXT PRIMARY KEY, payload TEXT NOT NULL,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES research_cases(id),
                    payload TEXT NOT NULL, stored_filename TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS documents_case ON documents(case_id);
                CREATE TABLE IF NOT EXISTS pages (
                    id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    position INTEGER NOT NULL, payload TEXT NOT NULL,
                    UNIQUE(document_id, position)
                );
            """)
            migrate_financials(db)
            migrate_analysis(db)
            migrate_verification(db)
            migrate_reports(db)
            from app.research.automation.migration import migrate as migrate_automation
            migrate_automation(db)

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.database, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def _case(self, db, case_id: str) -> dict:
        row = db.execute("SELECT * FROM research_cases WHERE id = ?", (case_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Research case not found.")
        count = db.execute("SELECT COUNT(*) FROM documents WHERE case_id = ?", (case_id,)).fetchone()[0]
        return {**json.loads(row["payload"]), "id": row["id"], "created_at": row["created_at"],
                "updated_at": row["updated_at"], "document_count": count}

    def get_case(self, case_id: str) -> dict:
        with self.connection() as db:
            return self._case(db, case_id)

    def list_cases(self) -> list[dict]:
        with self.connection() as db:
            ids = db.execute("SELECT id FROM research_cases ORDER BY updated_at DESC, id").fetchall()
            return [self._case(db, row["id"]) for row in ids]

    def create_case(self, payload: CaseCreate) -> dict:
        case_id, timestamp = str(uuid4()), now()
        with self.connection() as db:
            db.execute("INSERT INTO research_cases VALUES (?, ?, ?, ?)",
                       (case_id, payload.model_dump_json(), timestamp, timestamp))
            return self._case(db, case_id)

    def list_documents(self, case_id: str) -> list[dict]:
        with self.connection() as db:
            self._case(db, case_id)
            rows = db.execute("SELECT payload FROM documents WHERE case_id = ? ORDER BY rowid DESC", (case_id,)).fetchall()
            return [json.loads(row["payload"]) for row in rows]

    def get_document(self, case_id: str, document_id: str) -> dict:
        with self.connection() as db:
            self._case(db, case_id)
            row = db.execute("SELECT payload FROM documents WHERE case_id = ? AND id = ?", (case_id, document_id)).fetchone()
            if row is None:
                raise HTTPException(404, "Document not found in this case.")
            pages = db.execute("SELECT payload FROM pages WHERE document_id = ? ORDER BY position", (document_id,)).fetchall()
            return {**json.loads(row["payload"]), "pages": [json.loads(page["payload"]) for page in pages]}

    def add_document(self, case_id: str, metadata: DocumentMetadata, kind: str,
                     original_filename: str | None, data: bytes, pages: list[dict], *, retrieval: dict | None = None) -> dict:
        self.get_case(case_id)
        document_id = str(uuid4())
        # Generated name only: original filenames are display metadata, never paths.
        extension={"pdf":"pdf","html":"html","structured_json":"json"}.get(kind,"txt")
        stored_filename = f"{document_id}.{extension}"
        destination = self.uploads / stored_filename
        partial = any(page["extraction_status"] == "no_text" for page in pages)
        payload = {**metadata.model_dump(mode="json"), "id": document_id, "case_id": case_id,
                   "source_kind": kind, "original_filename": original_filename,
                   "uploaded_at": now(), "extraction_status": "partial" if partial else "extracted",
                   "extraction_message": "Some pages contain no extractable text. No OCR was performed; inspect every page before using this source." if partial else None,
                   "page_count": len(pages) if kind == "pdf" else None, "section_count": len(pages),
                   "size_bytes": len(data), "retrieval": retrieval}
        try:
            with destination.open("xb") as stream:
                stream.write(data)
            with self.connection() as db:
                db.execute("INSERT INTO documents VALUES (?, ?, ?, ?)",
                           (document_id, case_id, json.dumps(payload), stored_filename))
                for page in pages:
                    record = {**page, "id": str(uuid4()), "document_id": document_id}
                    db.execute("INSERT INTO pages VALUES (?, ?, ?, ?)",
                               (record["id"], document_id, record["position"], json.dumps(record)))
                db.execute("UPDATE research_cases SET updated_at = ? WHERE id = ?", (now(), case_id))
        except Exception:
            destination.unlink(missing_ok=True)
            raise
        return self.get_document(case_id, document_id)

    def remove_document(self, case_id: str, document_id: str) -> None:
        with self.connection() as db:
            self._case(db, case_id)
            row = db.execute("SELECT stored_filename FROM documents WHERE id = ? AND case_id = ?", (document_id, case_id)).fetchone()
            if row is None:
                raise HTTPException(404, "Document not found in this case.")
            # Keep deletion case-scoped, including its stable citation sections.
            from app.research.financial_store import invalidate_document
            invalidate_document(db, case_id, document_id)
            db.execute("DELETE FROM documents WHERE id = ? AND case_id = ?", (document_id, case_id))
            from app.research.analysis_store import invalidate_analyses
            invalidate_analyses(db, case_id)
            db.execute("UPDATE research_cases SET updated_at = ? WHERE id = ?", (now(), case_id))
        (self.uploads / row["stored_filename"]).unlink(missing_ok=True)
