"""Bounded diagnosis of prior note schema vs ID-only span selection; synthetic only."""
import asyncio
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import test_financials as fixtures
from app.research.analysis_llm import structured_call,ModelCallError,StructuredOutputError
from app.research.verification_models import ExtractedClaims
from app.research.verification_store import VerificationStore
from app.research.claim_intake import extract_claims
from app.research.models import DocumentMetadata
from app.agent.config import _get_groq_api_key


async def main():
    if not _get_groq_api_key():
        print('NOT ATTEMPTED: missing credentials');return
    fixture=fixtures.FinancialTests();fixture.setUp()
    try:
        async with asyncio.timeout(75):
            text=(Path(__file__).parent/'fixtures/research_note_synthetic.txt').read_text()
            doc=fixture.store.add_document(fixture.case['id'],DocumentMetadata(title='SYNTHETIC note diagnosis'),'pasted_text',None,text.encode(),
                [{'position':1,'page_number':None,'label':'Text section','text':text,'extraction_status':'extracted'}])
            try:
                result=await structured_call(ExtractedClaims,'Extract at most eight checkable claims. Copy exact excerpts and supplied section_id. Unknown mapping fields remain null/unknown; do not invent dates or units.',
                    {'sections':[{'section_id':doc['pages'][0]['id'],'text':text}]},max_tokens=2400)
                print('PRIOR FULL MAPPING SCHEMA: returned',len(result.claims),'proposals; prior failure not reproduced.',flush=True)
            except (ModelCallError,StructuredOutputError) as error:
                print('PRIOR FULL MAPPING SCHEMA:',error.category,str(error),flush=True)
            result=await extract_claims(VerificationStore(fixture.store),fixture.case['id'],doc['id'])
            print('SPAN-ID SCHEMA:',result['status'],'proposals:',len(result['claim_ids']),'errors:',result['errors'],flush=True)
    except TimeoutError:
        print('NOTE DIAGNOSTIC 75 SECOND BUDGET EXHAUSTED',flush=True)
    finally:
        fixture.tearDown()


if __name__=='__main__':asyncio.run(main())
