"""Extract source data only. Never evaluate text, follow URLs, or run PDF actions."""
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException
from pypdf import PdfReader

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 300
MAX_EXTRACTED_CHARS = 2_000_000


def validate_size(data: bytes) -> None:
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Documents must be 10 MiB or smaller.")
    if not data:
        raise HTTPException(422, "The document is empty. Add source text and try again.")


def extract_text(data: bytes) -> list[dict]:
    validate_size(data)
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(422, "TXT files must use UTF-8 encoding.") from None
    if "\x00" in text:
        raise HTTPException(422, "This appears to be binary data, not a UTF-8 text file.")
    if not text.strip():
        raise HTTPException(422, "The document contains no text. Add source text and try again.")
    if len(text) > MAX_EXTRACTED_CHARS:
        raise HTTPException(413, "Extracted text exceeds the 2 million character limit.")
    return [{"position": 1, "page_number": None, "label": "Text section", "text": text,
             "extraction_status": "extracted"}]


def extract_upload(filename: str, data: bytes) -> tuple[str, list[dict]]:
    validate_size(data)
    extension = Path(filename).suffix.lower()
    if extension == ".txt":
        return "txt", extract_text(data)
    if extension != ".pdf":
        raise HTTPException(415, "Only text-based .pdf and UTF-8 .txt files are supported.")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(422, "The file is not a valid PDF. Upload a text PDF or paste its text.")
    try:
        reader = PdfReader(BytesIO(data), strict=True)
        if reader.is_encrypted:
            raise HTTPException(422, "Encrypted PDFs are unsupported. Upload an unencrypted text PDF or paste its text.")
        if not 0 < len(reader.pages) <= MAX_PDF_PAGES:
            raise HTTPException(422, "PDFs must contain between 1 and 300 pages.")
        sections = []
        characters = 0
        for number, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            characters += len(text)
            if characters > MAX_EXTRACTED_CHARS:
                raise HTTPException(413, "Extracted text exceeds the 2 million character limit.")
            sections.append({"position": number, "page_number": number, "label": f"Page {number}",
                             "text": text, "extraction_status": "extracted" if text.strip() else "no_text"})
        if not any(section["text"].strip() for section in sections):
            raise HTTPException(422, "No extractable text found. Scanned/image-only PDFs are unsupported. Paste the document text instead.")
        return "pdf", sections
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422, "The PDF is malformed or its text could not be extracted. Try another text PDF or paste its text.") from None
