const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const filename = path.join(__dirname, '../src/lib/analysis-input.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText, filename);
const {parseAnalysisPeriods, analysisAsOf, analysisCalculations} = compiled.exports;

test('exact period labels survive form parsing and JSON serialization', () => {
  for (const value of ['FY2024\nYear Ended June 30, 2025', 'FY2024; Year Ended June 30, 2025']) {
    assert.deepEqual(JSON.parse(JSON.stringify({periods: parseAnalysisPeriods(value)})).periods,
      ['FY2024', 'Year Ended June 30, 2025']);
  }
  assert.deepEqual(parseAnalysisPeriods('Year Ended June 30, 2025'), ['Year Ended June 30, 2025']);
  assert.deepEqual(parseAnalysisPeriods('\n ; '), []);
});

test('snapshot date display uses saved run override, including historical runs', () => {
  const run = {snapshot: {case: {research_as_of_date: null}},
    request: {research_as_of_date: '2026-10-24'}, scope: {research_as_of_date: '2026-10-24'}};
  assert.equal(analysisAsOf(run), '2026-10-24');
  assert.equal(analysisAsOf({...run, snapshot: {...run.snapshot, research_as_of_date: '2025-06-30'}}), '2025-06-30');
  assert.equal(analysisAsOf({snapshot: {case: {research_as_of_date: '2024-06-30'}}}), '2024-06-30');
  assert.equal(analysisAsOf({snapshot: {case: {research_as_of_date: null}}}), null);
});


test('margin requests retain an operation for every period and both selected receipt IDs', () => {
  const periods = parseAnalysisPeriods('FY2024; FY2025');
  const payload = JSON.parse(JSON.stringify({periods,
    calculations: analysisCalculations(['net_profit_margin'], periods),
    receipt_ids: ['fy2024-receipt', 'fy2025-receipt']}));
  assert.deepEqual(payload.calculations, [
    {calculation_type: 'net_profit_margin', periods: ['FY2024']},
    {calculation_type: 'net_profit_margin', periods: ['FY2025']},
  ]);
  assert.deepEqual(payload.receipt_ids, ['fy2024-receipt', 'fy2025-receipt']);
  assert.deepEqual(analysisCalculations(['revenue_growth'], periods), [
    {calculation_type: 'revenue_growth', periods}]);
  assert.deepEqual(analysisCalculations(['net_profit_margin'], ['Year Ended June 30, 2025']), [
    {calculation_type: 'net_profit_margin', periods: ['Year Ended June 30, 2025']}]);
});
