"""Bounded live stages on temporary synthetic data only. No raw output or credentials."""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))

from app.agent.config import _get_groq_api_key
from app.research.analysis_manager import AnalysisManager
from app.research.analysis_models import AnalysisStart
from app.research.fact_extraction import extract_facts
from app.research.claim_intake import extract_claims
from app.research.verification_store import VerificationStore
from app.research.verification_engine import execute_verification
from app.research.verification_models import ClaimInput,ClaimMapping,VerificationStart
from app.research.models import DocumentMetadata
import test_financials as fixtures


async def main():
    if not _get_groq_api_key():
        print('NOT ATTEMPTED: Research credentials missing.',flush=True);return
    fixture=fixtures.FinancialTests();fixture.setUp()
    manager=AnalysisManager(fixture.store);manager.startup()
    verifier=VerificationStore(fixture.store)
    try:
        async with asyncio.timeout(180):
            # Extraction goes to a separate temporary case. Extracted proposals are never auto-confirmed.
            source=fixture.store.add_document(fixture.other['id'],DocumentMetadata(title='SYNTHETIC extraction fixture'),'pasted_text',None,
                fixtures.FIXTURE.encode(),[{'position':1,'page_number':None,'label':'Text section','text':fixtures.FIXTURE,'extraction_status':'extracted'}])
            extracted=await extract_facts(fixture.financials,fixture.other['id'],[source['id']])
            print('LIVE FACT EXTRACTION:',extracted['status'],'fact references:',len(extracted['fact_ids']),flush=True)
            if extracted['errors']:print('Extraction errors:',extracted['errors'],flush=True)
            for year in (2024,2025):
                for metric in fixtures.METRICS:fixture.fact(metric,year)
            run=manager.start(fixture.case['id'],AnalysisStart(document_ids=[fixture.doc['id']],
                question_override='Compare FY2024 and FY2025 revenue growth and FY2025 net profit margin; describe document content qualitatively without financial quantities.'))
            await asyncio.gather(*list(manager.tasks.values()))
            saved=manager.store.get(fixture.case['id'],run['id'])
            print('LIVE PLANNING:','succeeded' if saved['plan'] else 'failed',flush=True)
            print('LIVE SYNTHESIS:',(saved.get('brief') or {}).get('qualitative_status','not reached'),'run:',saved['status'],flush=True)
            print('NUMERICAL OUTPUTS:',[f['text'] for f in (saved.get('financial') or {}).get('findings',[])],flush=True)
            if (saved.get('brief') or {}).get('synthesis_error'):print('Synthesis diagnostics:',saved['brief']['synthesis_error'],flush=True)
            if saved['errors']:print('Analysis errors:',saved['errors'],flush=True)
            note=(Path(__file__).parent/'fixtures/research_note_synthetic.txt').read_text()
            note_doc=fixture.store.add_document(fixture.case['id'],DocumentMetadata(title='SYNTHETIC disputed note'),'pasted_text',None,note.encode(),
                [{'position':1,'page_number':None,'label':'Text section','text':note,'extraction_status':'extracted'}])
            proposals=await extract_claims(verifier,fixture.case['id'],note_doc['id'])
            print('LIVE NOTE CLAIM EXTRACTION:',proposals['status'],'proposals:',len(proposals['claim_ids']),flush=True)
            claim=verifier.add(fixture.case['id'],ClaimInput(text='Synthetic Fixture Co has confirmed a major acquisition.',mapping_reviewed=True,
                mapping=ClaimMapping(assertion_type='qualitative',entity='Synthetic Fixture Co',temporal_scope='current')))
            check=verifier.create_run(fixture.case['id'],claim['id'],VerificationStart(supporting_document_ids=[fixture.doc['id']]))
            result=await execute_verification(verifier,check)
            print('LIVE QUALITATIVE VERIFICATION:',result['status'],'verdict:',(result['result'] or {}).get('status','none'),
                  'method:',(result['result'] or {}).get('method','none'),'retrieval passes:',len(result['attempts']),flush=True)
            if result['errors']:print('Verification errors:',result['errors'],flush=True)
    except TimeoutError:
        print('LIVE PROBE OVERALL BUDGET REACHED: unreported stages are not verified.',flush=True)
    finally:
        await manager.shutdown();fixture.tearDown()


if __name__=='__main__':asyncio.run(main())
