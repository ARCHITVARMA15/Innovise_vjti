"""Local lexical retrieval with exact Python Unicode-character source offsets."""
import math
import re
from collections import Counter
from uuid import uuid4

from app.research.analysis_models import AnalysisSnapshot, ResearchPlan, RetrievalOutput, EvidencePassage

CHUNK_CHARS = 1400
CHUNK_OVERLAP = 200
MAX_CHUNKS = 4000
MAX_PASSAGES = 8
STOP_WORDS = {"the", "and", "for", "with", "from", "that", "this", "are", "what", "how", "does", "was", "were", "of", "a", "to", "in", "is", "on"}


def chunks(text: str):
    for start in range(0, len(text), CHUNK_CHARS - CHUNK_OVERLAP):
        end = min(start + CHUNK_CHARS, len(text))
        yield start, end, text[start:end]
        if end == len(text):
            break


def tokens(text):
    return [word for word in re.findall(r"\w+", text.casefold()) if word not in STOP_WORDS]


def retrieve(snapshot: AnalysisSnapshot, plan: ResearchPlan) -> RetrievalOutput:
    candidates, total, sections = [], 0, 0
    queries = [tokens(query) for query in plan.evidence_queries]
    for selected in snapshot.documents:
        if not selected.included:
            continue
        doc = selected.document
        for page in doc.pages:
            sections += 1
            for start, end, text in chunks(page.text):
                total += 1
                if len(candidates) >= MAX_CHUNKS:
                    continue
                candidates.append((doc, page, start, end, text, Counter(tokens(text))))
    ranked = []
    for doc, page, start, end, text, counts in candidates:
        scores = [sum(min(counts[word], 3) for word in set(query)) / math.sqrt(max(1, len(counts))) for query in queries]
        score = max(scores, default=0)
        if score > 0 and text.strip():
            index = scores.index(score)
            ranked.append((score, doc, page, start, end, text, plan.evidence_queries[index]))
    ranked.sort(key=lambda item: -item[0])
    passages = []
    for score, doc, page, start, end, text, query in ranked:
        if any(p.section_id == page.id and max(0, min(end, p.end_offset) - max(start, p.start_offset)) > CHUNK_OVERLAP for p in passages):
            continue
        passages.append(EvidencePassage(id=str(uuid4()), document_id=doc.id, section_id=page.id,
            document_title=doc.title, page_number=page.page_number, label=page.label, start_offset=start, end_offset=end,
            excerpt=text, query=query, reason="Local lexical term overlap; relevance is not a truth or trust score.",
            publication_date=doc.publication_date, reporting_period=doc.reporting_period,
            unknown_publication_date=doc.publication_date is None))
        if len(passages) == MAX_PASSAGES:
            break
    limitations = [f"Local lexical search only: {CHUNK_CHARS}-character chunks, {CHUNK_OVERLAP}-character overlap, at most {MAX_CHUNKS} scanned chunks and {MAX_PASSAGES} passages.",
                   "Offsets refer to saved extracted text, not PDF visual coordinates. All retrieved excerpts are exact source slices.",
                   "No web search, URL fetching, OCR, embeddings or independent verification. Retrieval may miss relevant passages."]
    if total > len(candidates):
        limitations.append(f"Chunk scan cap reached: {total - len(candidates)} chunks omitted; this is not exhaustive document coverage.")
    if not passages:
        limitations.append("No passages matched the plan's lexical queries.")
    return RetrievalOutput(passages=passages, scanned_sections=sections, scanned_chunks=len(candidates), total_chunks=total,
                           omitted_chunks=total-len(candidates), limitations=limitations)
