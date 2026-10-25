from collections import Counter

from app.research.analysis_models import VerificationStageOutput
from app.research.verification_store import VerificationStore
from app.research.verification_models import VerificationStart
from app.research.verification_engine import execute_verification


async def verification_node(state,store):
    verifier=VerificationStore(store.store)
    claims=[]; runs=[]; counts=Counter()
    supporting=[d.document.id for d in state['snapshot'].documents if d.included]
    selected_claims=state.get('request',{}).get('claim_ids',[])
    limitations=[]
    if not selected_claims and state.get('request',{}).get('task_type')=='full_research':
        available=[c for c in verifier.claims(state['case_id']) if c['origin']!='analysis_finding']
        selected_claims=[c['id'] for c in available[:8]]
        if len(available)>8:
            limitations.append('Claim processing cap: at most eight existing case claims checked automatically; remaining claims stay visible and unresolved in Report.')
    for claim_id in selected_claims:
        claim=verifier.claim(state['case_id'],claim_id)
        selected=[did for did in supporting if not claim.get('source') or did!=claim['source']['document_id']]
        claims.append(claim_id)
        if selected:
            run=verifier.create_run(state['case_id'],claim_id,VerificationStart(supporting_document_ids=selected))
            saved=await execute_verification(verifier,run)
            runs.append(saved['id'])
            counts[saved['result']['status'] if saved['result'] else 'execution_failed']+=1
    for finding in state['financial'].findings:
        claim=verifier.import_finding(state['case_id'],state['run_id'],finding.model_dump(mode='json'))
        claims.append(claim['id'])
        if not supporting:
            continue
        run=verifier.create_run(state['case_id'],claim['id'],VerificationStart(
            supporting_document_ids=supporting, receipt_ids=finding.receipt_ids))
        saved=await execute_verification(verifier,run)
        runs.append(saved['id'])
        counts[saved['result']['status'] if saved['result'] else 'execution_failed']+=1
    return VerificationStageOutput(claim_ids=claims,verification_ids=runs,status_counts=dict(counts),
        limitations=limitations+['Numerical preliminary findings were checked against the selected supporting scope. Qualitative findings or manual claims can be checked separately in Evidence. Support is not independent certification.'])
