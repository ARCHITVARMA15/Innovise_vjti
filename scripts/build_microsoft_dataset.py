"""Extract FY2025 report tables into the BI demo's canonical, provenance-labelled CSV.

Run with a Python containing beautifulsoup4:
  python scripts/build_microsoft_dataset.py --source-dir /tmp
Input names: veritas-msft-ar25.html and veritas-msft-q1.html ... q4.html.
Download URLs are recorded in the emitted source manifest. No credentials required.
"""
import argparse
import csv
import hashlib
import json
import re
from datetime import date
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend/my-app/public/financial-analytics/microsoft'
DATA = ROOT / 'frontend/my-app/src/app/financial-analytics/data'
ANNUAL_URL = 'https://www.microsoft.com/investor/reports/ar25/index.html'


def norm(value):
    return ' '.join(value.split())


def number(value):
    value = value.replace('$', '').replace(',', '').replace(' ', '')
    if not re.fullmatch(r'\(?-?\d+(?:\.\d+)?\)?', value):
        raise ValueError(value)
    value = '-' + value[1:-1] if value.startswith('(') else value
    return float(value) if '.' in value else int(value)


def rows(table):
    return [[norm(c.get_text(' ', strip=True)) for c in tr.find_all(['td', 'th'], recursive=False)
             if norm(c.get_text(' ', strip=True))] for tr in table.find_all('tr')]


def numeric_rows(table, columns):
    result = []
    for row in rows(table):
        if len(row) != columns + 1:
            continue
        if row[0].startswith(('Year Ended', 'June 30,')):
            continue
        try:
            values = [number(v) for v in row[1:]]
        except ValueError:
            continue
        result.append((row[0], values))
    return result


INCOME = ['product_revenue', 'service_revenue', 'revenue', 'product_cost', 'service_cost',
          'cost_of_revenue', 'gross_profit', 'research_development', 'sales_marketing',
          'general_administrative', 'operating_income', 'other_income', 'pretax_income',
          'income_tax', 'net_income', 'basic_eps', 'diluted_eps', 'basic_shares', 'diluted_shares']
BALANCE = ['cash', 'short_investments', 'liquid_assets', 'receivables', 'inventories',
           'other_current_assets', 'current_assets', 'property_equipment', 'lease_assets',
           'equity_investments', 'goodwill', 'intangibles', 'other_long_assets', 'assets',
           'payables', 'short_debt', 'current_long_debt', 'accrued_compensation', 'short_tax',
           'short_unearned_revenue', 'other_current_liabilities', 'current_liabilities',
           'long_debt', 'long_tax', 'long_unearned_revenue', 'deferred_tax', 'lease_liabilities',
           'other_long_liabilities', 'liabilities', 'paid_capital', 'retained_earnings',
           'other_comprehensive_loss', 'equity', 'liabilities_equity']
CASH = ['net_income', 'depreciation_other', 'stock_compensation', 'investment_losses',
        'deferred_tax', 'receivables_change', 'inventory_change', 'other_current_assets_change',
        'other_long_assets_change', 'payables_change', 'unearned_revenue_change', 'tax_change',
        'other_current_liabilities_change', 'other_long_liabilities_change', 'operating_cash',
        'short_debt_change', 'debt_issued', 'debt_repaid', 'stock_issued', 'buybacks', 'dividends',
        'financing_other', 'financing_cash', 'capex', 'acquisitions', 'investment_purchases',
        'investment_maturities', 'investment_sales', 'investing_other', 'investing_cash',
        'fx_effect', 'cash_change', 'beginning_cash', 'ending_cash']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path, required=True)
    args = parser.parse_args()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    facts, sources = [], []

    def read(name, url, title):
        raw = (args.source_dir / name).read_bytes()
        sources.append({'title': title, 'url': url, 'sha256': hashlib.sha256(raw).hexdigest()})
        return BeautifulSoup(raw, 'html.parser')

    annual = read('veritas-msft-ar25.html', ANNUAL_URL, 'Microsoft FY2025 Annual Report')
    tables = annual.find_all('table')

    def emit(group, key, label, values, years, url=ANNUAL_URL, quarter=None, dimension='Consolidated'):
        for value, year in zip(values, years, strict=True):
            end = f'{year}-06-30'
            start = f'{year-1}-07-01'
            if quarter:
                end = [f'{year-1}-09-30', f'{year-1}-12-31', f'{year}-03-31', f'{year}-06-30'][quarter-1]
                start = [f'{year-1}-07-01', f'{year-1}-10-01', f'{year}-01-01', f'{year}-04-01'][quarter-1]
            if group == 'balance':
                start = ''
            facts.append({'statement': group, 'metric': key, 'label': label, 'dimension': dimension,
                          'fiscal_year': year, 'period': f'FY{year}' + (f' Q{quarter}' if quarter else ''),
                          'period_type': 'instant' if group == 'balance' else 'quarter' if quarter else 'annual',
                          'start_date': start, 'end_date': end, 'value': value,
                          'unit': 'USD/share' if key.endswith('eps') else 'shares_millions' if key.endswith('shares') else 'USD_millions',
                          'source_url': url, 'basis': 'reported'})

    for idx, group, keys, years in [(15, 'income', INCOME, [2025, 2024, 2023]),
                                    (17, 'balance', BALANCE, [2025, 2024]),
                                    (18, 'cash', CASH, [2025, 2024, 2023])]:
        numeric = numeric_rows(tables[idx], len(years))
        assert len(numeric) == len(keys), (group, len(numeric), len(keys))
        for key, (label, values) in zip(keys, numeric, strict=True):
            emit(group, key, label, values, years)

    section = ''
    for row in rows(tables[62]):
        if len(row) == 1:
            section = row[0]
        elif len(row) == 4 and row[0] in ['Revenue', 'Cost of revenue', 'Operating expenses', 'Operating Income']:
            if section == 'Total':
                continue
            key = {'Revenue': 'revenue', 'Cost of revenue': 'cost_of_revenue',
                   'Operating expenses': 'operating_expenses', 'Operating Income': 'operating_income'}[row[0]]
            emit('segments', key, row[0], [number(v) for v in row[1:]], [2025, 2024, 2023], dimension=section)
    for idx, group in [(63, 'geography'), (64, 'offerings')]:
        for label, values in numeric_rows(tables[idx], 3):
            if label != 'Total':
                emit(group, 'revenue', label, values, [2025, 2024, 2023], dimension=label.replace(' (a)', ''))
    # This disclosed overlay overlaps product/segment revenue and must not be added to it.
    emit('cloud', 'revenue', 'Microsoft Cloud revenue', [168900, 137700, 111600], [2025, 2024, 2023], dimension='Microsoft Cloud (overlapping measure)')

    for quarter in range(1, 5):
        url = f'https://www.microsoft.com/en-us/investor/earnings/fy-2025-q{quarter}/press-release-webcast'
        soup = read(f'veritas-msft-q{quarter}.html', url, f'Microsoft FY2025 Q{quarter} Earnings Release')
        table = next(t for t in soup.find_all('table') if 'Total revenue' in norm(t.get_text(' ', strip=True))
                     and 'Weighted average shares' in norm(t.get_text(' ', strip=True)))
        numeric = numeric_rows(table, 2 if quarter == 1 else 4)
        assert len(numeric) == len(INCOME), (quarter, len(numeric))
        for key, (label, values) in zip(INCOME, numeric, strict=True):
            # First two numeric columns are standalone three-month periods, not YTD.
            emit('quarterly', key, label, values[:2], [2025, 2024], url=url, quarter=quarter)

    identities = [(f['statement'], f['metric'], f['dimension'], f['period']) for f in facts]
    assert len(identities) == len(set(identities))
    manifest = {'company': 'Microsoft Corporation', 'ticker': 'MSFT', 'currency': 'USD',
                'report_fiscal_year': 2025, 'prepared_on': date(2026, 10, 25).isoformat(),
                'description': 'Veritas-prepared CSV extracted from official Microsoft reports; not a Microsoft-published CSV.',
                'sources': sources, 'facts': facts}
    (DATA / 'microsoft-fy2025.json').write_text(json.dumps(manifest, indent=2) + '\n')
    with (PUBLIC / 'microsoft_fy2025_financials.csv').open('w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=list(facts[0]))
        writer.writeheader()
        writer.writerows(facts)
    (PUBLIC / 'sources.json').write_text(json.dumps({k: v for k, v in manifest.items() if k != 'facts'}, indent=2) + '\n')
    print(f'Extracted {len(facts)} reported observations from {len(sources)} official sources.')


if __name__ == '__main__':
    main()
