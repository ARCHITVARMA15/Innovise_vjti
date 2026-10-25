"""Offline intake contract tests. All records/uploads live in temporary directories."""
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen.canvas import Canvas

from app.research.extraction import MAX_UPLOAD_BYTES
from app.research.limits import MAX_REQUEST_BYTES, ResearchIntakeLimit
from app.research.router import get_store, router
from app.research.store import ResearchStore


def text_pdf(*pages: str) -> bytes:
    stream = io.BytesIO()
    canvas = Canvas(stream)
    for text in pages:
        canvas.drawString(40, 750, text)
        canvas.showPage()
    canvas.save()
    return stream.getvalue()


class ResearchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.store = ResearchStore(self.directory)
        self.app = FastAPI()
        self.app.include_router(router)
        self.app.add_middleware(ResearchIntakeLimit)
        self.app.dependency_overrides[get_store] = lambda: self.store
        self.client = TestClient(self.app)
        self.case = self.create_case("Primary")
        self.other = self.create_case("Other")

    def tearDown(self):
        self.client.close()
        self.temp.cleanup()

    def create_case(self, title):
        response = self.client.post("/research/cases", json={"title": title, "company_name": "Example Co",
            "research_question": "How is cash generation changing?", "research_as_of_date": "2026-10-24"})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def path(self, case=None):
        return f"/research/cases/{(case or self.case)['id']}/documents"

    def paste(self, case=None, text="Source text\n<script>alert('untrusted')</script>"):
        return self.client.post(self.path(case) + "/text", json={"title": "Management notes", "text": text,
            "publication_date": "2025-03-31", "reporting_period": "FY25", "source_url": "https://example.com/filing",
            "document_type": "Transcript"})

    def upload(self, name, data, case=None, metadata=None):
        return self.client.post(self.path(case) + "/upload", files={"file": (name, data)},
            data={"metadata": json.dumps(metadata or {"title": "Source document"})})

    def test_case_and_text_survive_new_store_and_process(self):
        response = self.paste()
        self.assertEqual(response.status_code, 201, response.text)
        doc = response.json()
        page = doc["pages"][0]
        self.assertIsNone(doc["page_count"])
        self.assertIsNone(page["page_number"])
        self.assertEqual(page["label"], "Text section")
        self.assertIn("<script>", page["text"])
        self.assertEqual(doc["publication_date"], "2025-03-31")
        self.assertNotEqual(doc["uploaded_at"][:10], doc["publication_date"])
        reopened = ResearchStore(self.directory)
        self.assertEqual(reopened.get_document(self.case["id"], doc["id"]), doc)
        self.assertEqual(reopened.get_case(self.case["id"])["document_count"], 1)
        # A completely new interpreter opens the same DB and stable citation IDs.
        code = "from pathlib import Path; from app.research.store import ResearchStore; import json,sys; print(json.dumps(ResearchStore(Path(sys.argv[1])).get_document(sys.argv[2],sys.argv[3])))"
        output = subprocess.check_output([sys.executable, "-c", code, str(self.directory), self.case["id"], doc["id"]], text=True)
        self.assertEqual(json.loads(output), doc)
        self.assertEqual(self.client.get(f"/research/cases/{self.case['id']}").json()["created_at"], self.case["created_at"])
        self.assertEqual(len(self.client.get("/research/cases").json()), 2)

    def test_txt_preserves_utf8_text_without_pdf_page_numbers(self):
        text = "  Revenue ₹100\n\nProfit €20\n"
        response = self.upload("../../unsafe.txt", text.encode())
        self.assertEqual(response.status_code, 201, response.text)
        doc = response.json()
        self.assertEqual(doc["pages"][0]["text"], text)
        self.assertIsNone(doc["pages"][0]["page_number"])
        self.assertEqual(doc["original_filename"], "unsafe.txt")
        files = list(self.store.uploads.iterdir())
        self.assertEqual(files[0].name, doc["id"] + ".txt")
        self.assertEqual(files[0].read_bytes(), text.encode())

    def test_pdf_has_stable_original_page_positions_including_blank(self):
        response = self.upload("report.PDF", text_pdf("First page revenue", "", "Third page cash"))
        self.assertEqual(response.status_code, 201, response.text)
        doc = response.json()
        self.assertEqual(doc["page_count"], 3)
        self.assertEqual(doc["extraction_status"], "partial")
        self.assertEqual([page["page_number"] for page in doc["pages"]], [1, 2, 3])
        self.assertEqual(doc["pages"][1]["extraction_status"], "no_text")
        self.assertIn("Third page cash", doc["pages"][2]["text"])
        self.assertEqual(len({page["id"] for page in doc["pages"]}), 3)
        self.assertEqual(self.client.get(self.path() + "/" + doc["id"]).json(), doc)

    def test_delete_is_scoped_and_removes_file_and_pages(self):
        first = self.paste().json()
        second = self.paste(self.other).json()
        self.assertEqual(self.client.get(self.path(self.other) + "/" + first["id"]).status_code, 404)
        self.assertEqual(self.client.delete(self.path(self.other) + "/" + first["id"]).status_code, 404)
        self.assertEqual(self.client.delete(self.path() + "/" + first["id"]).status_code, 200)
        self.assertEqual(self.client.get(self.path() + "/" + first["id"]).status_code, 404)
        self.assertEqual(self.client.get(self.path(self.other) + "/" + second["id"]).json(), second)
        self.assertFalse((self.store.uploads / (first["id"] + ".txt")).exists())
        with self.store.connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM pages WHERE document_id = ?", (first["id"],)).fetchone()[0], 0)

    def test_empty_invalid_metadata_and_unsupported_files(self):
        for patch in ({"title": " "}, {"company_name": " "}, {"research_question": " "}, {"research_as_of_date": "bad-date"}):
            response = self.client.post("/research/cases", json={"title": "Case", "company_name": "Company", "research_question": "Question", **patch})
            self.assertEqual(response.status_code, 422)
        for name, data, status in [("empty.txt", b"", 422), ("space.txt", b" \n", 422),
                ("binary.txt", b"a\x00b", 422), ("encoding.txt", b"\xff", 422),
                ("script.exe", b"source", 415), ("fake.pdf", b"not PDF", 422),
                ("broken.pdf", b"%PDF-1.4\nbroken", 422)]:
            with self.subTest(name=name):
                self.assertEqual(self.upload(name, data).status_code, status)
        for payload in ({"title": " ", "text": "content"}, {"title": "Valid", "text": " "},
                        {"title": "Valid", "text": "content", "source_url": "javascript:alert(1)"},
                        {"title": "Valid", "text": "content", "publication_date": "invented"}):
            self.assertEqual(self.client.post(self.path() + "/text", json=payload).status_code, 422)
        self.assertEqual(self.upload("valid.txt", b"text", metadata={"title": " "}).status_code, 422)
        self.assertEqual(self.client.post(self.path() + "/upload", files={"file": ("x.txt", b"text")}, data={"metadata": "{"}).status_code, 422)
        self.assertEqual(self.client.get(self.path()).json(), [])
        self.assertEqual(list(self.store.uploads.iterdir()), [])

    def test_encrypted_and_image_only_pdfs_are_not_success(self):
        writer = PdfWriter()
        writer.add_page(PdfReader(io.BytesIO(text_pdf("Secret"))).pages[0])
        writer.encrypt("password")
        output = io.BytesIO()
        writer.write(output)
        encrypted = self.upload("locked.pdf", output.getvalue())
        self.assertEqual(encrypted.status_code, 422)
        self.assertIn("Encrypted", encrypted.json()["detail"])
        # Actual image-only PDF (not merely a blank file).
        from PIL import Image
        from reportlab.lib.utils import ImageReader
        output = io.BytesIO()
        canvas = Canvas(output)
        canvas.drawImage(ImageReader(Image.new("RGB", (20, 20), "white")), 40, 700, 100, 100)
        canvas.save()
        scanned = self.upload("scan.pdf", output.getvalue())
        self.assertEqual(scanned.status_code, 422)
        self.assertIn("Paste", scanned.json()["detail"])
        self.assertEqual(self.client.get(self.path()).json(), [])

    def test_size_limits_and_missing_case(self):
        response = self.upload("big.txt", b"a" * (MAX_UPLOAD_BYTES + 1))
        self.assertEqual(response.status_code, 413)
        response = self.client.post(self.path() + "/text", content=b"a" * (MAX_REQUEST_BYTES + 1), headers={"Content-Type": "application/json"})
        self.assertEqual(response.status_code, 413)
        self.assertEqual(self.client.post(self.path() + "/text", json={"title": "Large", "text": "a" * 2_000_001}).status_code, 413)
        self.assertEqual(self.client.get("/research/cases/missing").status_code, 404)
        self.assertEqual(self.paste({"id": "missing"}).status_code, 404)
        self.assertEqual(self.client.get(self.path()).json(), [])
        self.assertEqual(list(self.store.uploads.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
