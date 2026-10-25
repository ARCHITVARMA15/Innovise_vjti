/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness loads TypeScript using the existing project convention. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const filename = path.join(__dirname, '../src/app/financial-analytics/lib/analytics.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, filename);
const { parseTransactions, parseMoney, summarize, deriveAlerts, whatsappDraft, MAX_ROWS } = compiled.exports;
const header = 'date,description,type,amount,category\n';
const row = '2026-10-01,Payment,income,100,Sales';
const fixture = name => parseTransactions(fs.readFileSync(path.join(__dirname, '../public/financial-analytics', name), 'utf8'));

test('supplied sample has independently calculated totals and high-value alerts', () => {
  const rows = fixture('sample_transactions.csv');
  const summary = summarize(rows);
  assert.equal(summary.income, 242000000);
  assert.equal(summary.expenses, 75200000);
  assert.equal(summary.net, 166800000);
  assert.equal(summary.count, 8);
  assert.deepEqual(summary.months, [{ month: '2026-10', income: 242000000, expenses: 75200000, net: 166800000 }]);
  assert.equal(deriveAlerts(rows, 50000000, 10000000).length, 2);
  assert.equal(deriveAlerts(rows, 200000000, 10000000).length, 0);
});
test('expense-heavy sample triggers aggregate alert at inclusive boundary', () => {
  const rows = fixture('expense_heavy_transactions.csv');
  assert.equal(summarize(rows).income, 10000000);
  assert.equal(summarize(rows).expenses, 42500000);
  assert.equal(summarize(rows).net, -32500000);
  assert.equal(deriveAlerts(rows, 50000000, 32500000)[0].title, 'Negative net cash flow');
  assert.equal(deriveAlerts(rows, 50000000, 32500001).length, 0);
  assert.equal(deriveAlerts([], 1, 1).length, 0);
});
test('money is exact in paise and high-value boundary applies to both directions', () => {
  const rows = parseTransactions(header + '2026-09-01,A,income,0.10,Sales\n2026-09-02,B,income,0.20,Sales\n2026-10-01,C,expense,0.30,Ops');
  assert.equal(summarize(rows).net, 0);
  assert.equal(summarize(rows).months.length, 2);
  assert.equal(deriveAlerts(rows, 20, 1).length, 2);
  assert.equal(parseMoney('.01'), 1);
  assert.equal(parseMoney('123.4'), 12340);
});
test('quoted fields, BOM, trimmed case-insensitive headers, CRLF and physical source rows', () => {
  const rows = parseTransactions('\uFEFF DATE , Description , TYPE , Amount , CATEGORY\r\n\r\n2026-10-01,"Client, \"\"A\"\"\nPayment", INCOME ,12.50, Sales \r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourceRow, 3);
  assert.equal(rows[0].description, 'Client, "A"\nPayment');
  assert.equal(rows[0].amountPaise, 1250);
});
test('invalid input rejects the entire import with useful reasons', () => {
  for (const [input, expected] of [
    ['', /empty/], [header, /no transaction/], ['date,amount\n2026-10-01,1', /Missing required/],
    ['date,date,type,amount,category\nx,x,income,1,Sales', /Duplicate/],
    [header + row.replace('2026-10-01', '2026-02-30'), /Row 2: date/],
    [header + row.replace('2026-10-01', '2025-02-29'), /Row 2: date/],
    [header + row.replace('income', 'transfer'), /Row 2: type/],
    [header + row.replace('Payment', ''), /cannot be empty/],
    [header + row.replace('Sales', ' '), /cannot be empty/],
    [header + row + ',extra', /expected 5 columns/],
    [header + '2026-10-01,"unclosed,income,1,Sales', /not closed/],
    [header + '2026-10-01,"closed"oops,income,1,Sales', /after closing quote/],
    [header + '2026-10-01,bad"quote,income,1,Sales', /unexpected quote/],
    [header + row + '\n2026-10-02,Invalid,expense,0,Ops', /Row 3:/],
    [header + ',,,,', /Row 2:/],
  ]) assert.throws(() => parseTransactions(input), expected, input);
  for (const amount of ['0', '-1', 'NaN', 'Infinity', '1e3', '₹100', '0x10', '1.001', '', '999999999999999999']) {
    assert.throws(() => parseMoney(amount), undefined, amount);
  }
  assert.equal(parseTransactions(header + row.replace('2026-10-01', '2024-02-29')).length, 1);
});
test('dataset totals and row counts are bounded', () => {
  assert.throws(() => parseTransactions(header + `${row.replace('100', '50000000000000')}\n${row.replace('100', '50000000000000')}`), /dataset total/);
  assert.throws(() => parseTransactions(header + Array(MAX_ROWS + 1).fill(row).join('\n')), /exceeds/);
});
test('invalid thresholds are rejected and alerts are deterministic without duplication', () => {
  const rows = fixture('sample_transactions.csv');
  for (const value of [0, -1, Infinity, NaN, .1]) assert.throws(() => deriveAlerts(rows, value, 100));
  const alerts = deriveAlerts(rows, 50000000, 10000000);
  assert.deepEqual(alerts, deriveAlerts(rows, 50000000, 10000000));
  assert.equal(new Set(alerts.map(alert => alert.id)).size, alerts.length);
  const replacement = fixture('expense_heavy_transactions.csv');
  assert.equal(summarize(replacement).count, 4);
});
test('WhatsApp link contains only an encoded review draft with amount/date/threshold', () => {
  const alert = deriveAlerts(fixture('sample_transactions.csv'), 50000000, 10000000)[0];
  const link = new URL(whatsappDraft(alert));
  assert.equal(link.origin, 'https://wa.me');
  const text = link.searchParams.get('text');
  assert.match(text, /High-value transaction/);
  assert.match(text, /2026-10-01/);
  assert.match(text, /5,00,000/);
  assert.match(text, /review the Financial Analytics dashboard/);
  assert.doesNotMatch(text, /sent successfully|delivered/);
});
