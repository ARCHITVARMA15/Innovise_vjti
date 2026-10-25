"""Each requested margin period survives planning, verification, brief and report."""
import unittest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
import test_financials as fixtures
from app.research.analysis_models import AnalysisStart, AnalysisSnapshot
from app.research.analysis_manager import AnalysisManager
from app.research.financial_models import FactInput, FactUpdate
from app.research.models import DocumentMetadata
from app.research.reports import ReportStore
from app.research.verification_store import VerificationStore
from app.research.investigation import resolve_scope, bounded_plan


class MarginPeriodTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.f = fixtures.FinancialTests()
        self.f.setUp()
        self.cid = self.f.case['id']
        self.manager = AnalysisManager(self.f.store)
        text = 'SYNTHETIC margin fixture; consolidated synthetic GAAP, INR units.\nRevenue 2024 245122\nNet income 2024 88136\nRevenue 2025 281724\nNet income 2025 101832'
        self.doc = self.f.store.add_document(self.cid, DocumentMetadata(title='SYNTHETIC two-period margins'),
            'pasted_text', None, text.encode(), [{'position': 1, 'page_number': None,
                'label': 'Text section', 'text': text, 'extraction_status': 'extracted'}])
        self.facts = {}
        for year, revenue, income in ((2024, '245122', '88136'), (2025, '281724', '101832')):
            for metric, value, name in (('revenue', revenue, 'Revenue'), ('net_income', income, 'Net income')):
                label = 'FY2024' if (year, metric) == (2024, 'revenue') else f'Year Ended June 30, {year}'
                self.facts[metric, year] = self.f.fact(metric, year, document_id=self.doc['id'],
                    section_id=self.doc['pages'][0]['id'], value=value, scale='units', reporting_period=label,
                    period_start=f'{year-1}-07-01', period_end=f'{year}-06-30', excerpt=f'{name} {year} {value}')
        self.receipts = {year: self.f.calc('net_profit_margin', net_income=self.facts['net_income', year],
            revenue=self.facts['revenue', year]) for year in (2024, 2025)}
        self.request = AnalysisStart(task_type='simple_metric', document_ids=[self.doc['id']],
            entity='Synthetic Fixture Co', accounting_basis='consolidated / synthetic GAAP',
            research_as_of_date='2026-10-25', periods=['FY2024', 'FY2025'],
            calculations=[{'calculation_type': 'net_profit_margin', 'periods': ['FY2025']}],
            receipt_ids=[self.receipts[2024]['id'], self.receipts[2025]['id']])

    async def asyncTearDown(self):
        await self.manager.shutdown()
        self.f.tearDown()

    async def execute(self, request=None, after_snapshot=None):
        run = self.manager.store.create(self.cid, request or self.request)
        if after_snapshot:
            after_snapshot()
        with patch('app.research.analysis_llm._invoke_research_model', new_callable=AsyncMock) as model:
            await self.manager.execute(self.cid, run['id'])
            model.assert_not_awaited()
        return self.manager.store.get(self.cid, run['id'])

    async def test_observed_old_payload_preserves_both_periods_end_to_end(self):
        facts_before = self.f.financials.list_facts(self.cid)
        receipts_before = self.f.financials.list_receipts(self.cid)
        run = await self.execute()
        self.assertEqual(run['status'], 'completed', run['errors'])
        self.assertEqual(len(run['request']['calculations']), 1)  # Original submitted intent stays intact.
        self.assertEqual([t['periods'] for t in run['plan']['calculations']], [['FY2024'], ['FY2025']])
        self.assertEqual({self.receipts[y]['display_result'] for y in self.receipts}, {'35.96', '36.15'})
        expected = {r['id'] for r in self.receipts.values()}
        self.assertEqual(set(run['financial']['receipt_ids']), expected)
        self.assertEqual(len(run['brief']['findings']), 2)
        self.assertEqual(len(run['brief']['verification_ids']), 2)
        self.assertEqual(run['verification']['status_counts'], {'supported': 2})
        verifier = VerificationStore(self.f.store)
        for vid in run['verification']['verification_ids']:
            check = verifier.get_run(self.cid, vid)
            self.assertEqual(check['claim_snapshot']['revision'], 1)
            self.assertEqual(check['result']['status'], 'supported')
            self.assertEqual(len(check['snapshot']['selected_receipts']), 1)
            self.assertEqual(check['snapshot']['selected_receipts'][0]['id'], check['result']['receipt_ids'][0])
            self.assertTrue(all(i['source_snapshot']['document_id'] == self.doc['id']
                for i in check['result']['comparison']['inputs'].values()))
        report = ReportStore(self.f.store).get(self.cid, run['report']['report_id'])
        self.assertEqual(len(report['findings']), 2)
        self.assertTrue(all(f['verdict'] == 'supported' for f in report['findings']))
        self.assertEqual(set(report['receipt_ids']), expected)
        self.assertEqual(report['material_unresolved'], [])
        self.assertEqual(self.f.financials.list_facts(self.cid), facts_before)
        self.assertEqual(self.f.financials.list_receipts(self.cid), receipts_before)

    async def test_explicit_two_operation_request_is_not_duplicated(self):
        request = self.request.model_dump(mode='json')
        request['calculations'] = [{'calculation_type': 'net_profit_margin', 'periods': [p]}
            for p in request['periods']]
        run = await self.execute(AnalysisStart.model_validate(request))
        self.assertEqual(run['status'], 'completed')
        self.assertEqual(len(run['plan']['calculations']), 2)
        self.assertEqual(len(run['verification']['verification_ids']), 2)

    async def test_missing_first_period_retains_second_and_requires_input(self):
        data = self.request.model_dump(mode='json')
        data['receipt_ids'] = [self.receipts[2025]['id']]
        run = await self.execute(AnalysisStart.model_validate(data))
        self.assertEqual(run['status'], 'needs_input')
        self.assertEqual(run['financial']['receipt_ids'], [self.receipts[2025]['id']])
        self.assertEqual(len(run['brief']['findings']), 1)
        self.assertTrue(any('FY2024' in m for m in run['brief']['missing_information']))
        self.assertEqual(run['verification']['status_counts'], {'supported': 1})
        report = ReportStore(self.f.store).get(self.cid, run['report']['report_id'])
        self.assertEqual(report['source_analysis_status'], 'needs_input')
        self.assertTrue(any('FY2024' in q for q in report['unresolved_questions']))

    async def test_stale_first_period_does_not_discard_valid_second_period(self):
        def revise():
            fact = self.facts['net_income', 2024]
            self.f.financials.update_fact(self.cid, fact['id'], FactUpdate(expected_revision=fact['revision'],
                values=FactInput.model_validate({k:fact[k] for k in FactInput.model_fields}),
                status='candidate', reason='Synthetic review withdrawn'))
        run = await self.execute(after_snapshot=revise)
        self.assertEqual(run['status'], 'needs_input')
        self.assertEqual(run['financial']['receipt_ids'], [self.receipts[2025]['id']])
        self.assertTrue(any('FY2024' in m and 'stale' in m for m in run['financial']['needs_input']))
        with self.assertRaises(HTTPException):
            self.manager.store.create(self.cid, self.request)

    async def test_shared_scope_does_not_broaden_an_unselected_margin_task(self):
        data = self.request.model_dump(mode='json')
        data['receipt_ids'] = []
        data['calculations'] = [
            {'calculation_type': 'revenue_growth', 'periods': ['FY2024', 'FY2025']},
            {'calculation_type': 'net_profit_margin', 'periods': ['FY2025']}]
        saved = self.manager.store.create(self.cid, AnalysisStart.model_validate(data))
        state = {'request': saved['request'], 'snapshot': AnalysisSnapshot.model_validate(saved['snapshot']),
            'question': saved['question']}
        state['scope'] = resolve_scope(state)
        planned = bounded_plan(state)
        self.assertEqual(len(planned.calculations), 2)
        self.assertEqual(planned.calculations[1].periods, ['FY2025'])

    async def test_scope_and_operation_budget_cannot_be_bypassed_by_expansion(self):
        saved = self.manager.store.create(self.cid, self.request)
        state = {'request': saved['request'], 'snapshot': AnalysisSnapshot.model_validate(saved['snapshot']),
            'question': saved['question']}
        state['scope'] = resolve_scope(state)
        state['request']['calculations'][0]['periods'] = ['FY2030']
        with self.assertRaisesRegex(ValueError, 'outside'):
            bounded_plan(state)
        state['request']['calculations'][0]['periods'] = ['FY2025']
        state['request']['calculations'] += [{'calculation_type': 'current_ratio', 'periods': ['FY2024']}] * 7
        with self.assertRaisesRegex(ValueError, 'eight'):
            bounded_plan(state)
