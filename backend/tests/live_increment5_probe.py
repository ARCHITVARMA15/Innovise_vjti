"""One bounded live synthetic probe; candidates never auto-confirm. No user DB writes."""
import asyncio
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import test_financials as fixtures
from app.agent.config import _get_groq_api_key
from app.research.analysis_models import AnalysisStart
from app.research.analysis_manager import AnalysisManager
from app.research.fact_extraction import extract_facts
from app.research.claim_intake import extract_claims
from app.research.models import DocumentMetadata
from app.research.verification_models import ClaimInput,ClaimMapping,VerificationStart
from app.research.verification_store import VerificationStore
from app.research.verification_engine import execute_verification
from app.research.reports import ReportStore,ReviewRequest


async def main():
    if not _get_groq_api_key():
        print('NOT ATTEMPTED: credentials missing.',flush=True);return
    fixture=fixtures.FinancialTests();fixture.setUp()
    manager=AnalysisManager(fixture.store);manager.startup()
    verifier=VerificationStore(fixture.store)
    try:
        async with asyncio.timeout(210):
            source=fixture.store.add_document(fixture.other['id'],DocumentMetadata(title='SYNTHETIC extraction only'),
                'pasted_text',None,fixtures.FIXTURE.encode(),[{'position':1,'page_number':None,'label':'Text section','text':fixtures.FIXTURE,'extraction_status':'extracted'}])
            extracted=await extract_facts(fixture.financials,fixture.other['id'],[source['id']])
            print('LIVE FACT EXTRACTION:',extracted['status'],'candidates:',len(extracted['fact_ids']),'errors:',extracted['errors'],flush=True)
            print('FINANCIAL INPUT ORIGIN: manually entered and explicitly reviewed synthetic facts, separate from extraction candidates.',flush=True)
            facts={(metric,year):fixture.fact(metric,year) for year in (2024,2025) for metric in fixtures.METRICS}
            note=(Path(__file__).parent/'fixtures/research_note_synthetic.txt').read_text()
            note_doc=fixture.store.add_document(fixture.case['id'],DocumentMetadata(title='SYNTHETIC misleading note'),
                'pasted_text',None,note.encode(),[{'position':1,'page_number':None,'label':'Text section','text':note,'extraction_status':'extracted'}])
            extracted_claims=await extract_claims(verifier,fixture.case['id'],note_doc['id'])
            print('LIVE NOTE EXTRACTION:',extracted_claims['status'],'proposals:',len(extracted_claims['claim_ids']),'errors:',extracted_claims['errors'],flush=True)
            growth=verifier.add(fixture.case['id'],ClaimInput(text='Revenue growth was 25% in FY2025.',mapping_reviewed=True,
                mapping=ClaimMapping(assertion_type='numerical',target='revenue_growth',entity='Synthetic Fixture Co',asserted_value='25',
                    unit='percent',currency='INR',periods=['FY2024','FY2025'],accounting_scope='consolidated / synthetic GAAP',rounding_places=0,temporal_scope='historical')))
            check=await execute_verification(verifier,verifier.create_run(fixture.case['id'],growth['id'],VerificationStart(supporting_document_ids=[fixture.doc['id']])))
            print('DETERMINISTIC MISLEADING CLAIM:',check['status'],(check['result'] or {}).get('status'),flush=True)
            request=AnalysisStart(task_type='full_research',entity='Synthetic Fixture Co',periods=['FY2024','FY2025'],
                accounting_basis='consolidated / synthetic GAAP',research_as_of_date='2025-06-30',document_ids=[fixture.doc['id']],
                question_override='Compare FY2024 and FY2025 revenue growth and net profit margin; discuss financial statement document content.',
                calculations=[{'calculation_type':'revenue_growth','periods':['FY2024','FY2025']},{'calculation_type':'net_profit_margin','periods':['FY2025']}]+
                    [{'calculation_type':kind,'periods':[f'FY{year}']} for kind in ('current_ratio','debt_to_equity') for year in (2024,2025)])
            run=manager.store.create(fixture.case['id'],request);await manager.execute(fixture.case['id'],run['id'])
            saved=manager.store.get(fixture.case['id'],run['id'])
            print('PLANNING:', 'Python validated allowlisted tasks; no AI planning call', 'saved:',bool(saved['plan']),flush=True)
            print('LIVE SYNTHESIS:',(saved.get('brief') or {}).get('qualitative_status','not reached'),'diagnostic:',(saved.get('brief') or {}).get('synthesis_error'),flush=True)
            print('DETERMINISTIC FINANCIALS:',[f['text'] for f in (saved.get('financial') or {}).get('findings',[])],flush=True)
            reports=ReportStore(fixture.store).list(fixture.case['id'])
            if reports:
                report=reports[0]
                print('RISK:',report['risks']['status'],report['risks']['method'],'items:',len(report['risks']['items']),'AI risk synthesis: not attempted',flush=True)
                print('FINAL FINDING VERIFICATION:',[(f['execution_status'],f['verdict'],f['errors']) for f in report['findings'] if f['origin']=='analysis_finding' and (f.get('machine_result') or {}).get('method')!='deterministic_numerical_check'],flush=True)
                submitted=ReportStore(fixture.store).review(fixture.case['id'],report['id'],ReviewRequest(expected_revision=report['revision'],action='submit',reviewer_label='Synthetic probe reviewer',comment='Submit selected-document synthetic results.'))
                approved=ReportStore(fixture.store).review(fixture.case['id'],report['id'],ReviewRequest(expected_revision=submitted['revision'],action='approve',reviewer_label='Synthetic probe reviewer',comment='Acknowledge partial processing, selected-source limitations and all unresolved material findings.',acknowledge_limitations=True,
                    dispositions={cid:'retain_as_unresolved' for cid in submitted['material_unresolved']}))
                print('REPORT REVIEW:',approved['state'],'version:',approved['version'],'unresolved retained:',len(approved['material_unresolved']),flush=True)
            else:
                print('REPORT: not reached; analysis errors:',saved['errors'],flush=True)
            # One direct qualitative probe ensures a failed/empty synthesis does not hide provider reliability.
            allegation=verifier.add(fixture.case['id'],ClaimInput(text='Revenue disclosure confirms a major acquisition.',mapping_reviewed=True,
                mapping=ClaimMapping(assertion_type='qualitative',entity='Synthetic Fixture Co',temporal_scope='historical')))
            checked=await execute_verification(verifier,verifier.create_run(fixture.case['id'],allegation['id'],VerificationStart(supporting_document_ids=[fixture.doc['id']])))
            print('LIVE QUALITATIVE VERIFICATION:',checked['status'],'verdict:',(checked['result'] or {}).get('status'),'errors:',checked['errors'],flush=True)
    except TimeoutError:
        print('OVERALL 210 SECOND BUDGET EXHAUSTED: unreported stages remain unverified.',flush=True)
    finally:
        await manager.shutdown();fixture.tearDown()


if __name__=='__main__':asyncio.run(main())
