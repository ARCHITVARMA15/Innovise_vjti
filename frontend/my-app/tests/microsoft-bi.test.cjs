/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness follows existing project convention. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const filename = path.join(__dirname, '../src/app/financial-analytics/microsoft/model.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, filename);
const model = compiled.exports;
const dataset = require('../src/app/financial-analytics/data/microsoft-fy2025.json');
const facts = dataset.facts;
const metrics = year => Object.fromEntries(model.measures(facts, year).map(m => [m.id, m.value]));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('454 uniquely keyed observations retain units, real fiscal periods and primary sources', () => {
  assert.equal(facts.length, 454);
  assert.equal(dataset.sources.length, 5);
  assert.equal(new Set(facts.map(f => [f.statement, f.metric, f.dimension, f.period].join('|'))).size, 454);
  for (const f of facts) {
    assert.ok(dataset.sources.some(s => s.url === f.source_url));
    assert.equal(new URL(f.source_url).hostname, 'www.microsoft.com');
    assert.equal(f.basis, 'reported');
    assert.ok(Number.isFinite(f.value));
    assert.equal(f.end_date.length, 10);
    assert.ok(['USD_millions', 'USD/share', 'shares_millions'].includes(f.unit));
  }
  assert.equal(facts.find(f => f.statement === 'quarterly' && f.period === 'FY2025 Q1').end_date, '2024-09-30');
  assert.equal(facts.find(f => f.statement === 'quarterly' && f.period === 'FY2025 Q4').end_date, '2025-06-30');
  assert.equal(facts.find(f => f.statement === 'income' && f.fiscal_year === 2025).start_date, '2024-07-01');
  assert.ok(facts.filter(f => f.statement === 'balance').every(f => f.start_date === '' && f.period_type === 'instant'));
});
test('FY2025 headline values agree with reported statements and independent arithmetic', () => {
  const m = metrics(2025);
  assert.equal(m.revenue, 281724);
  assert.equal(m.operating_income, 128528);
  assert.equal(m.net_income, 101832);
  assert.equal(m.diluted_eps, 13.64);
  assert.equal(m.operating_cash, 136162);
  assert.equal(m.cash_capex, 64551);
  assert.equal(m.free_cash_flow, 71611);
  assert.equal(m.debt, 43151);
  assert.equal(m.net_cash, 51414);
  assert.equal(m.working_capital, 49913);
  assert.equal(m.capital_returns, 42502);
  near(m.revenue_growth, 36602 / 245122);
  near(m.gross_margin, 193893 / 281724);
  near(m.net_margin, 101832 / 281724);
  near(m.current_ratio, 191131 / 141218);
  near(m.roa, 101832 / 565583);
  near(m.roe, 101832 / 305978);
  near(m.fcf_payout, 42502 / 71611);
});
test('every available statement, segment, geographic and quarterly reconciliation balances', () => {
  for (const year of [2023, 2024, 2025]) {
    for (const check of model.reconciliations(facts, year)) {
      if (check.difference !== null) assert.equal(check.difference, 0, `${year}: ${check.name}`);
    }
  }
});
test('quarters are standalone three-month values, not YTD values', () => {
  const q = model.quarterly(facts, 2025);
  assert.deepEqual(q.map(row => row.revenue), [65585, 69632, 70066, 76441]);
  assert.deepEqual(q.map(row => row.operating), [30552, 31653, 32000, 34323]);
  assert.deepEqual(q.map(row => row.net), [24667, 24108, 25824, 27233]);
  assert.equal(q.reduce((sum, row) => sum + row.revenue, 0), 281724);
  assert.equal(model.quarterly(facts, 2023).length, 0);
});
test('segment decomposition uses recast values and never adds overlapping Cloud revenue', () => {
  const segments = model.segmentData(facts, 2025);
  assert.deepEqual(segments.map(s => s.revenue), [120810, 106265, 54649]);
  assert.equal(segments.reduce((sum, row) => sum + row.revenue, 0), 281724);
  assert.equal(segments.reduce((sum, row) => sum + row.operating, 0), 128528);
  near(segments[1].margin, 44589 / 106265);
  assert.equal(segments[0].cost + segments[0].opex + segments[0].operating, segments[0].revenue);
  assert.equal(model.factValue(facts, 2025, 'cloud', 'revenue', 'Microsoft Cloud (overlapping measure)'), 168900);
});
test('missing periods, missing fields and zero denominators remain unavailable', () => {
  assert.equal(model.divide(1, 0), null);
  assert.equal(model.divide(null, 2), null);
  assert.equal(model.growth(1, 0), null);
  assert.equal(model.growth(-1, -2), null);
  assert.equal(model.factValue(facts, 2023, 'balance', 'assets'), null);
  assert.equal(metrics(2023).assets, null);
  assert.equal(metrics(2024).roa, null);
  assert.equal(metrics(2024).roe, null);
  assert.equal(metrics(2023).revenue_growth, null);
  assert.equal(model.formatMeasure(null, 'money'), 'n/a');
  assert.ok(model.measures(facts, 2025).every(m => m.formula.length > 10));
  assert.equal(new Set(model.measures(facts, 2025).map(m => m.id)).size, model.measures(facts, 2025).length);
});
test('unit switching changes presentation only, preserving source USD millions and per-share values', () => {
  assert.equal(model.formatMeasure(281724, 'money', 'B'), '$281.72B');
  assert.equal(model.formatMeasure(281724, 'money', 'M'), '$281,724M');
  assert.equal(model.formatMeasure(13.64, 'eps', 'B'), '$13.64');
  assert.equal(model.formatMeasure(.5, 'percent'), '50.0%');
  assert.equal(model.formatMeasure(1.25, 'ratio'), '1.25×');
  assert.equal(model.formatMeasure(-10, 'money', 'M'), '−$10M');
});
test('downloadable dataset contains all observations and CSV exports quote text safely', () => {
  const csv = fs.readFileSync(path.join(__dirname, '../public/financial-analytics/microsoft/microsoft_fy2025_financials.csv'), 'utf8');
  assert.equal(csv.trim().split('\n').length, 455);
  assert.match(csv, /USD_millions/);
  assert.match(csv, /281724/);
  const fields = Object.keys(facts[0]);
  const downloaded = csv.trim().split(/\r?\n/).slice(1).map(line => {
    const values = [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^",]*))/g)].map(m => (m[1] ?? m[2]).replaceAll('""', '"'));
    return Object.fromEntries(fields.map((key, i) => [key, ['fiscal_year', 'value'].includes(key) ? Number(values[i]) : values[i]]));
  });
  assert.deepEqual(downloaded, facts, 'download CSV values and provenance must exactly match the app snapshot');
  const output = model.csvText(['Metric', 'Value'], [['Quoted "name", comma', 1], ['=malicious()', -5], ['Missing', null]]);
  assert.ok(output.startsWith('\uFEFF'));
  assert.match(output, /"Quoted ""name"", comma","1"/);
  assert.match(output, /"'=malicious\(\)","-5"/);
  assert.match(output, /"Missing",""/);
});
