"""Selected receipts resolve exact facts without automatic display-label selection."""
import unittest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
import test_financials as fixtures
from app.research.analysis_models import AnalysisStart, AnalysisSnapshot
from app.research.analysis_manager import AnalysisManager
from app.research.analysis_financial import financial_node
from app.research.investigation import resolve_scope, bounded_plan
from app.research.financial_models import FactUpdate
from app.research.models import DocumentMetadata


class SelectedReceiptTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.f = fixtures.FinancialTests()
        self.f.setUp()
        self.case_id = self.f.case['id']
        self.manager = AnalysisManager(self.f.store)
        self.manager.startup()
        self.previous = self.f.fact('revenue', 2024, reporting_period='FY2024',
            period_start='2023-07-01', period_end='2024-06-30')
        self.current = self.f.fact('revenue', 2025, reporting_period='Year Ended June 30, 2025',
            period_start='2024-07-01', period_end='2025-06-30')
        self.receipt = self.f.calc('revenue_growth', previous=self.previous, current=self.current)
        self.request = AnalysisStart(task_type='simple_metric', document_ids=[self.f.doc['id']],
            entity='Synthetic Fixture Co', accounting_basis='consolidated / synthetic GAAP',
            research_as_of_date='2026-10-24', periods=['FY2024', 'FY2025'],
            calculations=[{'calculation_type': 'revenue_growth', 'periods': ['FY2024', 'FY2025']}],
            receipt_ids=[self.receipt['id']])

    async def asyncTearDown(self):
        await self.manager.shutdown()
        self.f.tearDown()

    def state(self, request=None):
        run = self.manager.store.create(self.case_id, request or self.request)
        state = {'case_id': self.case_id, 'run_id': run['id'], 'question': run['question'],
            'request': run['request'], 'snapshot': AnalysisSnapshot.model_validate(run['snapshot'])}
        state['scope'] = resolve_scope(state)
        state['plan'] = bounded_plan(state)
        self.manager.store.update(self.case_id, run['id'], changes={'status': 'completed'})
        return state

    async def test_selection_survives_request_snapshot_plan_and_full_execution(self):
        facts_before = self.f.financials.list_facts(self.case_id)
        receipts_before = self.f.financials.list_receipts(self.case_id)
        for label in ('FY2025', 'Year Ended June 30, 2025'):
            data = self.request.model_dump(mode='json')
            data.update(periods=['FY2024', label], calculations=[{
                'calculation_type': 'revenue_growth', 'periods': ['FY2024', label]}])
            request = AnalysisStart.model_validate(data)
            run = self.manager.store.create(self.case_id, request)
            self.assertEqual(run['request']['receipt_ids'], [self.receipt['id']])
            self.assertEqual(run['snapshot']['selected_receipts'][0]['id'], self.receipt['id'])
            self.assertEqual(run['snapshot']['research_as_of_date'], '2026-10-24')
            self.assertIsNone(run['snapshot']['case']['research_as_of_date'])
            with patch('app.research.analysis_llm._invoke_research_model', new_callable=AsyncMock) as model:
                await self.manager.execute(self.case_id, run['id'])
                model.assert_not_awaited()
            saved = self.manager.store.get(self.case_id, run['id'])
            self.assertEqual(saved['status'], 'completed', saved['errors'])
            self.assertEqual(saved['plan']['calculations'][0]['periods'], ['FY2024', label])
            self.assertEqual(saved['financial']['needs_input'], [])
            self.assertEqual(saved['financial']['receipt_ids'], [self.receipt['id']])
            finding = saved['financial']['findings'][0]
            self.assertEqual(set(finding['fact_ids']), {self.current['id'], self.previous['id']})
            self.assertIn(self.receipt['display_result'], finding['text'])
        self.assertEqual(self.f.financials.list_facts(self.case_id), facts_before)
        self.assertEqual(self.f.financials.list_receipts(self.case_id), receipts_before)

    async def test_automatic_selection_does_not_guess_aliases(self):
        output = financial_node(self.state(self.request.model_copy(update={'receipt_ids': []})), self.manager.store)
        self.assertFalse(output.findings)
        self.assertTrue(output.needs_input)

    async def test_incompatible_scope_periods_and_competing_selected_receipts(self):
        state = self.state()
        for change in ({'entity': 'Other'}, {'accounting_basis': 'standalone'},
                       {'periods': ['FY2023', 'FY2024']}, {'research_as_of_date': '2024-06-30'}):
            with self.subTest(change=change):
                output = financial_node({**state, 'scope': {**state['scope'], **change}}, self.manager.store)
                self.assertFalse(output.findings)
                self.assertTrue(output.needs_input)
        task = state['plan'].calculations[0].model_copy(update={'periods': ['FY2023', 'FY2024']})
        output = financial_node({**state, 'plan': state['plan'].model_copy(update={'calculations': [task]})}, self.manager.store)
        self.assertFalse(output.findings)
        self.assertIn('incompatible', output.needs_input[0])
        duplicate = self.f.calc('revenue_growth', previous=self.previous, current=self.current)
        output = financial_node(self.state(self.request.model_copy(update={
            'receipt_ids': [self.receipt['id'], duplicate['id']]})), self.manager.store)
        self.assertFalse(output.findings)
        self.assertIn('select one', output.needs_input[0])

    async def test_stale_after_snapshot_and_at_intake_rejected(self):
        state = self.state()
        values = self.f.input('revenue', 2025, reporting_period='Year Ended June 30, 2025',
            period_start='2024-07-01', period_end='2025-06-30')
        self.f.financials.update_fact(self.case_id, self.current['id'], FactUpdate(
            expected_revision=self.current['revision'], values=values, status='confirmed', reason='Synthetic revision'))
        output = financial_node(state, self.manager.store)
        self.assertFalse(output.findings)
        self.assertIn('stale', output.needs_input[0])
        with self.assertRaises(HTTPException):
            self.manager.store.create(self.case_id, self.request)

    async def test_as_of_override_snapshotted_without_changing_case_or_staleness(self):
        future = self.f.store.add_document(self.case_id, DocumentMetadata(title='Future synthetic',
            publication_date='2026-10-25'), 'pasted_text', None, b'test',
            [{'position': 1, 'page_number': None, 'label': 'Text section', 'text': 'test', 'extraction_status': 'extracted'}])
        run = self.manager.store.create(self.case_id, self.request.model_copy(update={
            'document_ids': [self.f.doc['id'], future['id']]}))
        self.assertIn(future['id'], run['excluded_document_ids'])
        self.assertEqual(run['snapshot']['research_as_of_date'], run['request']['research_as_of_date'])
        self.assertIsNone(self.f.store.get_case(self.case_id)['research_as_of_date'])
        self.assertFalse(self.manager.store.get(self.case_id, run['id'])['stale'])
