"""Regression for the real grouped-decimal response and bounded page selection."""
import asyncio
import json
import re
import unittest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
import test_financials as fixtures
from app.research.analysis_llm import parse_structured, strict_schema, StructuredOutputError
from app.research.financial_models import FactInput, ExtractionOutput
from app.research.fact_extraction import extract_facts, parse_response
from app.research.models import DocumentMetadata


class ExtractionContractTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.FinancialTests()
        self.fixture.setUp()

    def tearDown(self):
        self.fixture.tearDown()

    def test_observed_grouped_decimal_response(self):
        f = self.fixture
        page = f.doc['pages'][0]
        span = f"{page['id']}:0:{len(fixtures.FIXTURE)}"
        # Observed structure, using synthetic values and IDs. No provider/source dump.
        proposal = f.input(entity=None, span_id=span, span_start=0,
            span_end=len(fixtures.FIXTURE), context_span_ids=[]).model_dump(mode='json')
        proposal['value'] = '1,100'
        with self.assertRaises(StructuredOutputError) as caught:
            parse_structured(ExtractionOutput, json.dumps({'facts': [proposal]}), 'stop')
        self.assertEqual(caught.exception.category, 'schema_mismatch')
        self.assertEqual(caught.exception.diagnostics['fields'],
            [{'field': 'facts.0.value', 'type': 'string_pattern_mismatch'}])
        schema = strict_schema(ExtractionOutput)
        fact_schema = schema['$defs']['FactInput']
        self.assertEqual(set(fact_schema['required']), set(FactInput.model_fields))
        value_schema = fact_schema['properties']['value']
        self.assertIsNone(re.fullmatch(value_schema['pattern'], '1,100'))
        self.assertIsNotNone(re.fullmatch(value_schema['pattern'], '1100'))
        self.assertEqual(value_schema['type'], 'string')
        self.assertEqual(set(schema['properties']), {'facts'})
        for name in ('entity', 'currency', 'scale', 'reporting_period', 'period_start',
                     'period_end', 'accounting_scope', 'span_id', 'span_start', 'span_end', 'ambiguity_note'):
            self.assertIn({'type': 'null'}, fact_schema['properties'][name]['anyOf'])
        self.assertEqual(fact_schema['properties']['metric']['enum'], fixtures.METRICS)
        self.assertEqual(fact_schema['properties']['period_end']['anyOf'][0]['format'], 'date')
        proposal['value'] = '1100'
        batch = [{'document_id': f.doc['id'], 'section_id': page['id'], 'text': fixtures.FIXTURE,
                  'spans': [{'id': span, 'start_offset': 0, 'end_offset': len(fixtures.FIXTURE)}]}]
        parsed = parse_response(parse_structured(ExtractionOutput, json.dumps({'facts': [proposal]})).model_dump_json(), batch)
        self.assertEqual(parsed.facts[0].excerpt, fixtures.FIXTURE)
        self.assertIsNone(parsed.facts[0].entity)
        for overrides in ({'span_id': 'unknown'}, {'span_id': None, 'context_span_ids': ['unknown']}):
            with self.assertRaises(ValueError):
                parse_response(json.dumps({'facts': [{**proposal, **overrides}]}), batch)

    def test_selected_page_40_keeps_original_ids_and_coverage(self):
        f = self.fixture
        doc = f.store.add_document(f.case['id'], DocumentMetadata(title='Synthetic multi-page PDF'),
            'pdf', 'test.pdf', b'synthetic', [
                {'position': i, 'page_number': i, 'label': f'Page {i}', 'text': fixtures.FIXTURE,
                 'extraction_status': 'extracted'} for i in range(1, 41)])
        page = doc['pages'][39]
        before = len(f.financials.list_runs(f.case['id']))
        for ids in ([], ['unknown'], [f.doc['pages'][0]['id']]):
            with self.assertRaises(HTTPException):
                asyncio.run(extract_facts(f.financials, f.case['id'], [doc['id']], ids))
        self.assertEqual(len(f.financials.list_runs(f.case['id'])), before)
        with patch('app.research.fact_extraction._get_groq_api_key', return_value='fake'), patch(
                'app.research.fact_extraction.structured_call', new_callable=AsyncMock,
                return_value='{"facts": []}') as model:
            run = asyncio.run(extract_facts(f.financials, f.case['id'], [doc['id']], [page['id']]))
        self.assertEqual(run['status'], 'completed')
        self.assertEqual(len(run['sections']), 40)
        self.assertEqual(sum(s['selected'] for s in run['sections']), 1)
        self.assertEqual(sum(s['status'] == 'processed' for s in run['sections']), 1)
        self.assertEqual(sum(s['status'] == 'skipped' for s in run['sections']), 39)
        self.assertEqual([s['section_id'] for s in model.call_args.args[2]['sources']], [page['id']])
        self.assertEqual(run['sections'][39]['page_number'], 40)
        for ids in ([f.doc['pages'][0]['id']], []):
            response = f.client.post(f"/research/cases/{f.case['id']}/extractions",
                json={'document_ids': [doc['id']], 'section_ids': ids})
            self.assertEqual(response.status_code, 422)

    def test_selected_sections_still_obey_batch_and_size_limits(self):
        f = self.fixture
        doc = f.store.add_document(f.case['id'], DocumentMetadata(title='Bounded selections'),
            'pdf', 'test.pdf', b'synthetic', [
                {'position': i, 'page_number': i, 'label': f'Page {i}',
                 'text': 'X' * (10001 if i == 1 else 4000), 'extraction_status': 'extracted'}
                for i in range(1, 22)])
        with patch('app.research.fact_extraction._get_groq_api_key', return_value='fake'), patch(
                'app.research.fact_extraction.structured_call', new_callable=AsyncMock,
                return_value='{"facts": []}') as model:
            run = asyncio.run(extract_facts(f.financials, f.case['id'], [doc['id']],
                [p['id'] for p in doc['pages']]))
        self.assertEqual(model.await_count, 6)
        self.assertEqual(run['status'], 'partial')
        self.assertEqual(sum(s['status'] == 'processed' for s in run['sections']), 18)
        self.assertEqual(sum(s['status'] == 'skipped' for s in run['sections']), 3)
        for call in model.call_args_list:
            self.assertLessEqual(sum(len(s['text']) for s in call.args[2]['sources']), 12000)
            self.assertTrue(all(len(s['text']) <= 10000 for s in call.args[2]['sources']))

    def test_run_retains_only_sanitized_validation_details(self):
        f = self.fixture
        error = StructuredOutputError('schema_mismatch', 'Model JSON does not match the requested schema.',
            fields=[{'field': 'facts.0.value', 'type': 'string_pattern_mismatch'},
                    {'field': 'private-provider-text', 'type': 'extra_forbidden'}])
        with patch('app.research.fact_extraction._get_groq_api_key', return_value='fake'), patch(
                'app.research.fact_extraction.structured_call', new_callable=AsyncMock, side_effect=error):
            run = asyncio.run(extract_facts(f.financials, f.case['id'], [f.doc['id']]))
        self.assertIn('facts.0.value (string_pattern_mismatch)', run['errors'][0])
        self.assertNotIn('private-provider-text', json.dumps(run))
        self.assertEqual(run['fact_ids'], [])
