export type Fact = {
  statement: string; metric: string; label: string; dimension: string; fiscal_year: number;
  period: string; period_type: string; start_date: string; end_date: string; value: number;
  unit: string; source_url: string; basis: string;
};
export type Measure = { id: string; label: string; value: number | null; format: 'money' | 'percent' | 'ratio' | 'eps'; formula: string; group: string; basis: 'Reported' | 'Calculated' };
export const SEGMENTS = ['Productivity and Business Processes', 'Intelligent Cloud', 'More Personal Computing'];
export const SEGMENT_SHORT: Record<string, string> = { 'Productivity and Business Processes': 'Productivity', 'Intelligent Cloud': 'Intelligent Cloud', 'More Personal Computing': 'Personal Computing' };
export const COLORS = ['#2979c7', '#21a394', '#8473c3', '#e2a543', '#d47479', '#6ba9bd', '#597a96', '#9ab77e', '#b28bac', '#b8c6d1'];
export const divide = (a: number | null, b: number | null): number | null => a === null || b === null || b === 0 ? null : a / b;
export const growth = (now: number | null, before: number | null): number | null => now === null || before === null || before <= 0 ? null : (now - before) / before;

export function factValue(facts: Fact[], year: number, statement: string, metric: string, dimension = 'Consolidated', period?: string): number | null {
  return facts.find(f => f.fiscal_year === year && f.statement === statement && f.metric === metric && f.dimension === dimension && (!period || f.period === period))?.value ?? null;
}

export function measures(facts: Fact[], year: number): Measure[] {
  const v = (statement: string, key: string, y = year) => factValue(facts, y, statement, key);
  const i = (key: string) => v('income', key), c = (key: string) => v('cash', key), b = (key: string) => v('balance', key);
  const add = (...values: (number | null)[]) => values.some(v => v === null) ? null : (values as number[]).reduce((a, b) => a + b, 0);
  const neg = (value: number | null) => value === null ? null : -value;
  const debt = add(b('short_debt'), b('current_long_debt'), b('long_debt'));
  const fcf = add(c('operating_cash'), c('capex'));
  const capitalReturns = neg(add(c('dividends'), c('buybacks')));
  const avgAssets = divide(add(b('assets'), v('balance', 'assets', year - 1)), 2);
  const avgEquity = divide(add(b('equity'), v('balance', 'equity', year - 1)), 2);
  const result: Measure[] = [];
  const put = (id: string, label: string, value: number | null, format: Measure['format'], formula: string, group: string, basis: Measure['basis'] = 'Calculated') => result.push({ id, label, value, format, formula, group, basis });
  put('revenue', 'Revenue', i('revenue'), 'money', 'Income statement · Total revenue', 'Earnings', 'Reported');
  put('gross_profit', 'Gross profit', i('gross_profit'), 'money', 'Income statement · Gross margin (amount)', 'Earnings', 'Reported');
  put('operating_income', 'Operating income', i('operating_income'), 'money', 'Income statement · Operating income', 'Earnings', 'Reported');
  put('net_income', 'Net income', i('net_income'), 'money', 'Income statement · Net income', 'Earnings', 'Reported');
  put('diluted_eps', 'Diluted EPS', i('diluted_eps'), 'eps', 'Income statement · Diluted earnings per share (USD/share)', 'Earnings', 'Reported');
  put('revenue_growth', 'Revenue growth', growth(i('revenue'), v('income', 'revenue', year - 1)), 'percent', '(Revenue ÷ prior-year revenue) − 1', 'Growth');
  put('operating_growth', 'Operating income growth', growth(i('operating_income'), v('income', 'operating_income', year - 1)), 'percent', '(Operating income ÷ prior-year operating income) − 1', 'Growth');
  put('net_growth', 'Net income growth', growth(i('net_income'), v('income', 'net_income', year - 1)), 'percent', '(Net income ÷ prior-year net income) − 1', 'Growth');
  put('eps_growth', 'Diluted EPS growth', growth(i('diluted_eps'), v('income', 'diluted_eps', year - 1)), 'percent', '(Diluted EPS ÷ prior-year diluted EPS) − 1', 'Growth');
  put('revenue_cagr', 'Two-year revenue CAGR', year >= 2025 && i('revenue') !== null && v('income', 'revenue', year - 2) !== null ? Math.sqrt(i('revenue')! / v('income', 'revenue', year - 2)!) - 1 : null, 'percent', '(Revenue ÷ revenue two years earlier)^(1/2) − 1', 'Growth');
  put('gross_margin', 'Gross margin', divide(i('gross_profit'), i('revenue')), 'percent', 'Gross profit ÷ revenue', 'Profitability');
  put('operating_margin', 'Operating margin', divide(i('operating_income'), i('revenue')), 'percent', 'Operating income ÷ revenue', 'Profitability');
  put('net_margin', 'Net margin', divide(i('net_income'), i('revenue')), 'percent', 'Net income ÷ revenue', 'Profitability');
  put('effective_tax', 'Effective tax rate', divide(i('income_tax'), i('pretax_income')), 'percent', 'Income tax provision ÷ pretax income', 'Profitability');
  put('rd_intensity', 'R&D / revenue', divide(i('research_development'), i('revenue')), 'percent', 'Research and development ÷ revenue', 'Efficiency');
  put('sales_intensity', 'Sales & marketing / revenue', divide(i('sales_marketing'), i('revenue')), 'percent', 'Sales and marketing ÷ revenue', 'Efficiency');
  put('ga_intensity', 'G&A / revenue', divide(i('general_administrative'), i('revenue')), 'percent', 'General and administrative ÷ revenue', 'Efficiency');
  put('operating_cash', 'Operating cash flow', c('operating_cash'), 'money', 'Cash flow statement · Net cash from operations', 'Cash flow', 'Reported');
  put('cash_capex', 'Cash capital expenditure', neg(c('capex')), 'money', 'Negative of cash flow statement additions to property and equipment; excludes noncash lease additions', 'Cash flow');
  put('free_cash_flow', 'Free cash flow', fcf, 'money', 'Operating cash flow − cash additions to property and equipment; Veritas calculation', 'Cash flow');
  put('fcf_margin', 'Free cash flow margin', divide(fcf, i('revenue')), 'percent', 'Free cash flow ÷ revenue', 'Cash flow');
  put('cfo_margin', 'Operating cash flow margin', divide(c('operating_cash'), i('revenue')), 'percent', 'Operating cash flow ÷ revenue', 'Cash flow');
  put('cash_conversion', 'Cash conversion', divide(c('operating_cash'), i('net_income')), 'ratio', 'Operating cash flow ÷ net income', 'Cash flow');
  put('capex_intensity', 'Cash capex / revenue', divide(neg(c('capex')), i('revenue')), 'percent', 'Cash additions to property and equipment ÷ revenue', 'Cash flow');
  put('capex_cfo', 'Cash capex / operating cash flow', divide(neg(c('capex')), c('operating_cash')), 'percent', 'Cash additions to property and equipment ÷ operating cash flow', 'Cash flow');
  put('sbc_intensity', 'Stock compensation / revenue', divide(c('stock_compensation'), i('revenue')), 'percent', 'Stock-based compensation ÷ revenue', 'Cash flow');
  put('dividends', 'Cash dividends paid', neg(c('dividends')), 'money', 'Negative of common stock cash dividends paid; cash paid differs from dividends declared', 'Capital allocation');
  put('buybacks', 'Cash stock repurchases', neg(c('buybacks')), 'money', 'Negative of common stock repurchased in cash flow statement; includes tax-withholding related repurchases', 'Capital allocation');
  put('capital_returns', 'Cash returned to shareholders', capitalReturns, 'money', 'Cash dividends paid + cash stock repurchases', 'Capital allocation');
  put('fcf_payout', 'Cash returns / free cash flow', divide(capitalReturns, fcf), 'percent', '(Cash dividends + cash stock repurchases) ÷ free cash flow', 'Capital allocation');
  put('assets', 'Total assets', b('assets'), 'money', 'Balance sheet · Total assets at June 30', 'Financial position', 'Reported');
  put('liquid_assets', 'Cash & short-term investments', b('liquid_assets'), 'money', 'Balance sheet · Cash, cash equivalents and short-term investments', 'Liquidity', 'Reported');
  put('working_capital', 'Working capital', add(b('current_assets'), neg(b('current_liabilities'))), 'money', 'Current assets − current liabilities', 'Liquidity');
  put('current_ratio', 'Current ratio', divide(b('current_assets'), b('current_liabilities')), 'ratio', 'Current assets ÷ current liabilities', 'Liquidity');
  put('quick_ratio', 'Quick ratio', divide(add(b('liquid_assets'), b('receivables')), b('current_liabilities')), 'ratio', '(Cash + short-term investments + receivables) ÷ current liabilities', 'Liquidity');
  put('cash_ratio', 'Cash ratio', divide(b('liquid_assets'), b('current_liabilities')), 'ratio', '(Cash + cash equivalents + short-term investments) ÷ current liabilities', 'Liquidity');
  put('debt', 'Borrowings', debt, 'money', 'Short-term debt + current portion of long-term debt + long-term debt; excludes leases', 'Leverage');
  put('net_cash', 'Net cash including short-term investments', add(b('liquid_assets'), neg(debt)), 'money', 'Cash + short-term investments − borrowings; leases excluded', 'Leverage');
  put('debt_equity', 'Borrowings / equity', divide(debt, b('equity')), 'ratio', 'Borrowings (excluding leases) ÷ ending equity', 'Leverage');
  put('liabilities_assets', 'Liabilities / assets', divide(b('liabilities'), b('assets')), 'percent', 'Total liabilities ÷ total assets', 'Leverage');
  put('equity_assets', 'Equity / assets', divide(b('equity'), b('assets')), 'percent', 'Total equity ÷ total assets', 'Leverage');
  put('roa', 'Return on average assets', divide(i('net_income'), avgAssets), 'percent', 'Net income ÷ average of opening and closing total assets; unavailable without both balances', 'Returns');
  put('roe', 'Return on average equity', divide(i('net_income'), avgEquity), 'percent', 'Net income ÷ average of opening and closing equity; unavailable without both balances', 'Returns');
  put('asset_turnover', 'Average asset turnover', divide(i('revenue'), avgAssets), 'ratio', 'Revenue ÷ average of opening and closing total assets', 'Returns');
  put('cloud_share', 'Microsoft Cloud / revenue', divide(factValue(facts, year, 'cloud', 'revenue', 'Microsoft Cloud (overlapping measure)'), i('revenue')), 'percent', 'Disclosed Microsoft Cloud revenue ÷ total revenue; overlaps segments and product offerings', 'Business mix');
  put('service_share', 'Service & other revenue share', divide(i('service_revenue'), i('revenue')), 'percent', 'Service and other revenue ÷ total revenue', 'Business mix');
  return result;
}

export function quarterly(facts: Fact[], year: number) {
  return [1, 2, 3, 4].flatMap(q => {
    const v = (key: string, y = year) => factValue(facts, y, 'quarterly', key, 'Consolidated', `FY${y} Q${q}`);
    const revenue = v('revenue');
    if (revenue === null) return [];
    return [{ quarter: `Q${q}`, period: `FY${year} Q${q}`, end: facts.find(f => f.statement === 'quarterly' && f.period === `FY${year} Q${q}`)?.end_date ?? '',
      revenue, priorRevenue: v('revenue', year - 1), operating: v('operating_income')!, net: v('net_income')!,
      gross: v('gross_profit')!, eps: v('diluted_eps')!, revenueGrowth: growth(revenue, v('revenue', year - 1)),
      operatingMargin: divide(v('operating_income'), revenue), netMargin: divide(v('net_income'), revenue) }];
  });
}

export function segmentData(facts: Fact[], year: number) {
  return SEGMENTS.map((segment, index) => {
    const v = (key: string, y = year) => factValue(facts, y, 'segments', key, segment);
    const revenue = v('revenue')!;
    return { name: segment, short: SEGMENT_SHORT[segment], revenue, operating: v('operating_income')!, cost: v('cost_of_revenue')!, opex: v('operating_expenses')!,
      margin: divide(v('operating_income'), revenue), growth: growth(revenue, v('revenue', year - 1)),
      contribution: divide(revenue, factValue(facts, year, 'income', 'revenue')), color: COLORS[index] };
  });
}

export function reconciliations(facts: Fact[], year: number) {
  const v = (s: string, k: string) => factValue(facts, year, s, k);
  const checks: { name: string; difference: number | null }[] = [];
  const check = (name: string, left: number | null, right: (number | null)[]) => checks.push({ name, difference: left === null || right.some(x => x === null) ? null : left - (right as number[]).reduce((a, b) => a + b, 0) });
  check('Revenue by product and service', v('income', 'revenue'), [v('income', 'product_revenue'), v('income', 'service_revenue')]);
  check('Revenue less cost = gross profit', v('income', 'revenue'), [v('income', 'cost_of_revenue'), v('income', 'gross_profit')]);
  check('Gross profit less operating expenses = operating income', v('income', 'gross_profit'), [v('income', 'operating_income'), v('income', 'research_development'), v('income', 'sales_marketing'), v('income', 'general_administrative')]);
  check('Pretax income less tax = net income', v('income', 'pretax_income'), [v('income', 'income_tax'), v('income', 'net_income')]);
  check('Operating income plus other income = pretax income', v('income', 'pretax_income'), [v('income', 'operating_income'), v('income', 'other_income')]);
  check('Cash flows plus FX = change in cash', v('cash', 'cash_change'), [v('cash', 'operating_cash'), v('cash', 'financing_cash'), v('cash', 'investing_cash'), v('cash', 'fx_effect')]);
  check('Beginning cash plus change = ending cash', v('cash', 'ending_cash'), [v('cash', 'beginning_cash'), v('cash', 'cash_change')]);
  for (const [group, metric] of [['segments', 'revenue'], ['segments', 'operating_income'], ['geography', 'revenue'], ['offerings', 'revenue']])
    check(`${group} reconcile to consolidated ${metric.replaceAll('_', ' ')}`, v('income', metric), facts.filter(f => f.statement === group && f.metric === metric && f.fiscal_year === year).map(f => f.value));
  check('Assets = liabilities plus equity', v('balance', 'assets'), [v('balance', 'liabilities'), v('balance', 'equity')]);
  check('Cash flow ending cash = balance sheet cash', v('cash', 'ending_cash'), [v('balance', 'cash')]);
  const quarters = quarterly(facts, year);
  for (const [key, annual] of [['revenue', 'revenue'], ['operating', 'operating_income'], ['net', 'net_income']] as const)
    checks.push({ name: `Four standalone quarters = annual ${annual.replaceAll('_', ' ')}`, difference: quarters.length === 4 ? quarters.reduce((total, q) => total + q[key], 0) - v('income', annual)! : null });
  return checks;
}

export function formatMeasure(value: number | null, format: Measure['format'], unit: 'B' | 'M' = 'B') {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`;
  if (format === 'ratio') return `${value.toFixed(2)}×`;
  if (format === 'eps') return `$${value.toFixed(2)}`;
  const scaled = value / (unit === 'B' ? 1000 : 1);
  return `${scaled < 0 ? '−' : ''}$${Math.abs(scaled).toLocaleString('en-US', { maximumFractionDigits: unit === 'B' ? 2 : 0, minimumFractionDigits: unit === 'B' ? 2 : 0 })}${unit}`;
}

export function csvText(headers: string[], rows: (string | number | null)[][]) {
  const escape = (v: string | number | null) => {
    // Preserve numeric negatives; prevent spreadsheet formula execution for text fields.
    const text = typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v ?? '');
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [headers, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
}
