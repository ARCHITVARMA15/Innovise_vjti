const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const filename = path.join(__dirname, '../src/lib/financial-overview.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017},
}).outputText, filename);
const {currentMetricReceipts,overviewFacts,receiptPeriod,displayFactAmount,displayReceiptResult,receiptInputDefaults,formatFinancialAmount}=compiled.exports;
const input={reporting_period:'FY2024',period_end:'2024-06-30',entity:'Company',currency:'USD',accounting_scope:'consolidated US GAAP'};
const receipt={id:'old',calculation_type:'net_profit_margin',status:'valid',display_result:'12.00',created_at:'2026-01-01',inputs:{revenue:input,net_income:input}};

test('overview keeps both annual margins, latest duplicate scope, and excludes stale/unavailable receipts',()=>{
 const next={...receipt,id:'2025',inputs:{revenue:{...input,reporting_period:'FY2025',period_end:'2025-06-30'},net_income:{...input,reporting_period:'FY2025',period_end:'2025-06-30'}}};
 const fresh={...receipt,id:'fresh',created_at:'2026-01-02'};
 const actual=currentMetricReceipts([receipt,next,fresh,{...receipt,id:'stale',status:'stale'},{...next,id:'missing',status:'unavailable'}]);
 assert.deepEqual(actual.map(r=>r.id),['2025','fresh']);
 assert.equal(receiptPeriod(next),'FY2025');
 assert.equal(receiptPeriod({...receipt,calculation_type:'revenue_growth',inputs:{current:next.inputs.revenue,previous:input}}),'FY2024 → FY2025');
});
test('overview separates entity and basis scopes and excludes unreviewed/removed figures',()=>{
 assert.equal(currentMetricReceipts([receipt,{...receipt,inputs:{revenue:{...input,entity:'Other Company'},net_income:{...input,entity:'Other Company'}}}]).length,2);
 const fact={...input,id:'ok',status:'confirmed',source_available:true,removed_at:null,ambiguity_note:null,scale:'units'};
 assert.deepEqual(overviewFacts([fact,{...fact,id:'candidate',status:'candidate'},{...fact,id:'removed',removed_at:'today'},{...fact,id:'ambiguous',ambiguity_note:'Review context'},{...fact,id:'source',source_available:false}]).map(f=>f.id),['ok']);
});
test('source amount formatting preserves decimals beyond JavaScript numeric precision',()=>{
 assert.equal(displayFactAmount('12345678901234567890.123456'),'12,345,678,901,234,567,890.123456');
 assert.equal(displayFactAmount('-190867000000'),'-190,867,000,000');
 assert.equal(displayReceiptResult({display_result:'49913000000.00',result_unit:'USD'}),'49.91B USD');
 assert.equal(displayReceiptResult({display_result:'1.35',result_unit:'ratio'}),'1.35 ×');
});

test('calculator prefill uses latest financial period, preserves exact fact IDs, and rejects stale revisions',()=>{
 const current={...input,id:'fy2025',revision:2,reporting_period:'FY2025',period_end:'2025-06-30'};
 const previous={...input,id:'fy2024',revision:1};
 const facts=[current,previous].map(f=>({...f,status:'confirmed',source_available:true,removed_at:null,ambiguity_note:null}));
 const older={...receipt,created_at:'2026-02-01',inputs:{revenue:previous,net_income:previous}};
 const latest={...receipt,id:'latest-year',created_at:'2026-01-01',inputs:{revenue:current,net_income:current}};
 assert.deepEqual(receiptInputDefaults('net_profit_margin',facts,[older,latest]),{revenue:'fy2025',net_income:'fy2025'});
 assert.deepEqual(receiptInputDefaults('net_profit_margin',[{...facts[0],revision:3}], [latest]),{});
 assert.deepEqual(receiptInputDefaults('net_profit_margin',[{...facts[0],source_available:false}], [latest]),{});
 assert.deepEqual(receiptInputDefaults('debt_to_equity',facts,[latest]),{});
});

test('compact financial amounts respect source scales, currencies and signs',()=>{
 assert.equal(formatFinancialAmount('49913000000.00','USD'),'49.91B USD');
 assert.equal(formatFinancialAmount('34448000000.00','USD'),'34.45B USD');
 assert.equal(formatFinancialAmount('281724','USD','millions'),'281.72B USD');
 assert.equal(formatFinancialAmount('-1250000','EUR'),'-1.25M EUR');
 assert.equal(formatFinancialAmount('125','INR','crore'),'1.25B INR');
 assert.equal(formatFinancialAmount('123456789','INR','paise'),'1.23M INR');
 assert.equal(formatFinancialAmount('0','USD'),'0 USD');
 assert.equal(formatFinancialAmount(null,'USD'),'Unavailable');
 assert.equal(formatFinancialAmount('250','USD',null),'250 USD (unknown scale)');
});
test('compact formatting rounds at M/B boundaries without floating-point loss',()=>{
 assert.equal(formatFinancialAmount('999999999.999','USD'),'1B USD');
 assert.equal(formatFinancialAmount('999999.999','USD'),'1M USD');
 assert.equal(formatFinancialAmount('1000000000004999999','USD'),'1,000,000,000B USD');
 assert.equal(formatFinancialAmount('1.2345e9','USD'),'1.23B USD');
 assert.equal(displayReceiptResult({display_result:'35.96',result_unit:'%'}),'35.96%');
 assert.equal(displayReceiptResult({display_result:'1.35',result_unit:'ratio'}),'1.35 ×');
});
