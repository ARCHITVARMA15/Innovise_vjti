"""Opt-in replay of already fetched official SEC bytes in a disposable store.

No network or production fact confirmation. The review below is a test-harness
action in a temporary database, never an analyst approval in a saved user case.
Run from backend: .venv/bin/python tests/replay_sec_microsoft.py
"""
import asyncio
import hashlib
import json
import sys
import tempfile
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.research.store import ResearchStore, research_directory
from app.research.analysis_manager import AnalysisManager
from app.research.financial_store import FinancialStore
from app.research.reports import ReportStore
from app.research.automation.models import Start, BatchReview
from app.research.automation.workflow import AutomationManager
from app.research.automation.network import RetrievalError


class SavedOfficialBytes:
    def __init__(self, directory):
        self.requests = self.bytes = self.cache_hits = 0
        self.sources = {}
        for path in (research_directory() / 'sec_cache').glob('*.json'):
            meta = json.loads(path.read_text())
            if path.with_suffix('.bin').exists():
                self.sources[meta['url']] = (meta, path.with_suffix('.bin'))

    def fetch(self, url, kind='filing', ttl=0):
        if url not in self.sources:
            raise RetrievalError('Required official source is not cached; run live retrieval first.')
        meta, path = self.sources[url]
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != meta['content_hash']:
            raise RetrievalError('Cached official source hash does not match.')
        self.cache_hits += 1
        self.bytes += len(raw)
        return {**meta, 'data': raw, 'cached': True}

    def json(self, url, ttl=0):
        source = self.fetch(url, 'json', ttl)
        return json.loads(source['data'], parse_float=Decimal), source

    def budget(self):
        return {'requests': self.requests, 'bytes': self.bytes, 'cache_hits': self.cache_hits}


async def main():
    with tempfile.TemporaryDirectory(prefix='veritas-sec-replay-') as directory:
        research = ResearchStore(Path(directory))
        analysis = AnalysisManager(research)
        manager = AutomationManager(research, analysis, SavedOfficialBytes)
        run = manager.store.create(Start(
            query='Analyse Microsoft FY2025 financial performance compared with FY2024.',
            company='MSFT', as_of_date='2025-07-30', request_id=uuid4().hex,
            metrics=['revenue_growth', 'net_profit_margin', 'current_ratio']))
        try:
            await manager.execute(run['case_id'], run['id'])
            run = manager.store.get(run['case_id'], run['id'])
            assert run['status'] == 'awaiting_review', run['blockers']
            candidates = manager.store.candidates(run)
            assert len(candidates) == 10 and all(c['eligible'] for c in candidates)
            assert all(c['fact']['status'] == 'candidate' for c in candidates)
            for candidate in candidates:
                fact = candidate['fact']
                proof = fact['source_snapshot']['structured_provenance']
                with research.connection() as db:
                    row = db.execute('SELECT stored_filename FROM documents WHERE id=?', (fact['document_id'],)).fetchone()
                raw = (research.uploads / row[0]).read_bytes()
                assert hashlib.sha256(raw).hexdigest() == proof['raw_content_hash']
                entry = json.loads(raw, parse_float=Decimal)
                for key in proof['json_pointer'].strip('/').split('/'):
                    entry = entry[int(key)] if isinstance(entry, list) else entry[key]
                assert Decimal(str(entry['val'])) == Decimal(fact['value'])
                assert entry['accn'] == proof['accession']
            run = manager.store.review(run['case_id'], run['id'], BatchReview(
                request_id=uuid4().hex, expected_revision=run['revision'], acknowledge=True,
                reason='AUTOMATED TEST ONLY: context assertions passed in disposable store; not a saved analyst review.',
                items=[{'fact_id': c['fact']['id'], 'expected_revision': c['fact']['revision']} for c in candidates]))
            await manager.execute(run['case_id'], run['id'], continuation=True)
            run = manager.store.get(run['case_id'], run['id'])
            assert run['status'] == 'completed', run['blockers']
            receipts = FinancialStore(research).list_receipts(run['case_id'])
            assert len(receipts) == 5 and all(r['status'] == 'valid' for r in receipts)
            results = {r['calculation_type']: [] for r in receipts}
            for receipt in receipts:
                results[receipt['calculation_type']].append(receipt['display_result'])
            assert results['revenue_growth'] == ['14.93'], results
            assert sorted(results['net_profit_margin']) == ['35.96', '36.15'], results
            assert sorted(results['current_ratio']) == ['1.27', '1.35'], results
            child = analysis.store.get(run['case_id'], run['analysis_run_id'])
            assert child['verification']['status_counts'].get('supported') == 5
            report = ReportStore(research).get(run['case_id'], run['report_id'])
            assert report['state'] in ('draft', 'needs_review')
            print(json.dumps({'source': 'Preserved official SEC bytes; no new network retrieval',
                              'store': 'Disposable test database; user records untouched',
                              'candidates': len(candidates), 'receipts': results,
                              'supported_checks': 5, 'report_state': report['state']}, indent=2))
        finally:
            await manager.shutdown()
            await analysis.shutdown()


if __name__ == '__main__':
    asyncio.run(main())
