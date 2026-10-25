"""Report verdicts bind exact claim revisions to applicable verification snapshots."""
import copy
import json
import unittest
from app.research.analysis_models import AnalysisStart
from app.research.analysis_manager import AnalysisManager
from app.research.reports import ReportStore, ReportCreate, select_report_check
from app.research.verification_store import VerificationStore
from app.research.verification_models import VerificationStart, ClaimEdit, ClaimMapping
from app.research.verification_engine import execute_verification
from app.research.models import DocumentMetadata
import test_financials as fixtures


class ReportScopeTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.f = fixtures.FinancialTests()
        self.f.setUp()
        self.cid = self.f.case['id']
        self.manager = AnalysisManager(self.f.store)
        self.previous = self.f.fact('revenue', 2024, reporting_period='FY2024',
            period_start='2023-07-01', period_end='2024-06-30')
        self.current = self.f.fact('revenue', 2025, reporting_period='Year Ended June 30, 2025',
            period_start='2024-07-01', period_end='2025-06-30')
        self.receipt = self.f.calc('revenue_growth', previous=self.previous, current=self.current)
        request = AnalysisStart(task_type='simple_metric', document_ids=[self.f.doc['id']],
            entity='Synthetic Fixture Co', accounting_basis='consolidated / synthetic GAAP',
            research_as_of_date='2026-10-25', periods=['FY2024', 'FY2025'],
            calculations=[{'calculation_type': 'revenue_growth', 'periods': ['FY2024', 'FY2025']}],
            receipt_ids=[self.receipt['id']])
        initial = self.manager.store.create(self.cid, request)
        await self.manager.execute(self.cid, initial['id'])
        self.run = self.manager.store.get(self.cid, initial['id'])
        self.verifier = VerificationStore(self.f.store)
        self.claim = self.verifier.claim(self.cid, self.run['verification']['claim_ids'][0])
        self.check = self.verifier.get_run(self.cid, self.run['verification']['verification_ids'][0])
        self.reports = ReportStore(self.f.store)

    async def asyncTearDown(self):
        await self.manager.shutdown()
        self.f.tearDown()

    def compose(self):
        return self.reports.create(self.cid, ReportCreate(analysis_run_id=self.run['id']))

    def choose(self, checks, run=None):
        return select_report_check(self.claim, checks, run or self.run, (run or self.run)['scope'],
            {self.receipt['id']: self.receipt})

    async def test_new_report_uses_exact_supported_check_and_preserves_old_version(self):
        with self.f.store.connection() as db:
            original = dict(db.execute('SELECT id,payload FROM research_reports').fetchone())
        report = self.compose()
        finding = next(f for f in report['findings'] if f['id'] == self.claim['id'])
        self.assertEqual(finding['claim_revision'], 1)
        self.assertEqual(finding['verification_id'], self.check['id'])
        self.assertEqual(finding['verdict'], 'supported')
        self.assertIsNone(finding['reason_code'])
        self.assertEqual(report['material_unresolved'], [])
        self.assertEqual(report['state'], 'draft')
        self.assertFalse(report['current_approval'])
        self.assertEqual(report['predecessor_id'], original['id'])
        with self.f.store.connection() as db:
            self.assertEqual(db.execute('SELECT payload FROM research_reports WHERE id=?',
                (original['id'],)).fetchone()['payload'], original['payload'])

    async def test_stale_check_is_not_a_current_supported_conclusion(self):
        self.check.update(stale=True, stale_reasons=['Synthetic stale fact catalog.'])
        self.verifier.save_run(self.check)
        finding = self.compose()['findings'][0]
        self.assertNotEqual(finding['verdict'], 'supported')
        self.assertEqual(finding['reason_code'], 'source_stale')
        self.assertIn('stale fact catalog', finding['reason_detail'])
        self.assertTrue(finding['resolution'])

    async def test_wrong_claim_revision_cannot_reuse_prior_supported_check(self):
        self.verifier.edit(self.cid, self.claim['id'], ClaimEdit(expected_revision=1,
            text=self.claim['text'] + ' Reviewed wording.', mapping=ClaimMapping.model_validate(self.claim['mapping']),
            mapping_reviewed=True, reason='Synthetic new revision'))
        report = self.compose()
        finding = report['findings'][0]
        self.assertEqual(finding['claim_revision'], 2)
        self.assertNotEqual(finding['verdict'], 'supported')
        self.assertIn('different claim revision', finding['reason_detail'])
        self.assertIn(self.claim['id'], report['material_unresolved'])

    async def test_incompatible_evidence_scope_is_rejected_during_composition(self):
        extra = self.f.store.add_document(self.cid, DocumentMetadata(title='Other synthetic evidence'),
            'pasted_text', None, b'Other evidence', [{'position': 1, 'page_number': None,
                'label': 'Text section', 'text': 'Other evidence', 'extraction_status': 'extracted'}])
        other = self.verifier.create_run(self.cid, self.claim['id'], VerificationStart(
            supporting_document_ids=[self.f.doc['id'], extra['id']], receipt_ids=[self.receipt['id']]))
        other = await execute_verification(self.verifier, other)
        self.assertEqual(other['result']['status'], 'supported')
        self.check.update(stale=True, stale_reasons=['Synthetic original check retired.'])
        self.verifier.save_run(self.check)
        report = self.compose()
        self.assertNotEqual(report['findings'][0]['verdict'], 'supported')
        chosen, issue = self.choose([other])
        self.assertEqual(chosen['id'], other['id'])
        self.assertIn('outside the report sources', issue[1])

    async def test_newer_inapplicable_retry_does_not_hide_linked_eligible_check(self):
        for update in ({'status': 'failed', 'result': None}, {'stale': True},
                       {'claim_snapshot': {**self.check['claim_snapshot'], 'revision': 9}}):
            newer = {**self.check, **update, 'id': 'unrelated-newer-check'}
            chosen, issue = self.choose([newer, self.check])
            self.assertEqual(chosen['id'], self.check['id'])
            self.assertIsNone(issue)

    async def test_alias_proof_does_not_accept_wrong_dates_revisions_or_receipts(self):
        for kind in ('period', 'revision', 'receipt', 'hash', 'basis', 'as_of'):
            with self.subTest(kind=kind):
                check, run = copy.deepcopy(self.check), copy.deepcopy(self.run)
                if kind == 'period': run['scope']['periods'] = ['FY2023', 'FY2024']
                if kind == 'revision': run['snapshot']['facts'][0]['revision'] += 1
                if kind == 'receipt': check['result']['receipt_ids'] = ['unrelated-receipt']
                if kind == 'hash': check['snapshot']['documents'][0]['content_hash'] = 'changed'
                if kind == 'basis': run['scope']['accounting_basis'] = 'standalone'
                if kind == 'as_of': run['scope']['research_as_of_date'] = '2024-06-30'
                _, issue = self.choose([check], run)
                self.assertIsNotNone(issue)
