const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module');
const path=require('node:path');
const filename=path.join(__dirname,'../src/lib/comparison-metrics.ts');
const compiled=new Module(filename,module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText,filename);
const {comparisonMetricPlans}=compiled.exports;
function fact(metric,year,status='confirmed'){
 return {id:metric+year,revision:1,metric,value:'100',scale:'millions',currency:'USD',entity:'Example Corp',accounting_scope:'consolidated US GAAP',reporting_period:'FY'+year,period_end:year+'-06-30',period_start:metric==='net_income'||metric==='revenue'?(year-1)+'-07-01':null,period_type:metric==='net_income'||metric==='revenue'?'duration':'instant',status,ambiguity_note:null,source_available:true,removed_at:null};
}
const revenues=[fact('revenue',2024),fact('revenue',2025)];
const incomes=[fact('net_income',2024),fact('net_income',2025)];
const balances=[2024,2025].flatMap(year=>['current_assets','current_liabilities'].map(metric=>fact(metric,year,'candidate')));
const receipt={id:'growth',status:'valid',calculation_type:'revenue_growth',created_at:'2026-01-01',inputs:{previous:revenues[0],current:revenues[1]}};
test('three saved results can be extended by exactly five plans without treating PDF candidates as confirmed',()=>{
 const plans=comparisonMetricPlans([...revenues,...incomes,...balances],[receipt]);
 assert.equal(plans.length,5);
 assert.equal(plans.filter(p=>!p.missing.length).length,1);
 assert.deepEqual(plans.filter(p=>!p.missing.length).map(p=>p.type),['net_income_growth']);
 assert.equal(new Set(plans.flatMap(p=>p.reviewFacts.map(f=>f.id))).size,4);
});
test('confirmed inputs enable all five and exact saved receipt revisions prevent duplicate plans',()=>{
 const facts=[...revenues,...incomes,...balances.map(f=>({...f,status:'confirmed'}))];
 const plans=comparisonMetricPlans(facts,[receipt]);
 assert.equal(plans.filter(p=>!p.missing.length).length,5);
 const saved=plans.map((p,i)=>({id:'new'+i,status:'valid',calculation_type:p.type,inputs:Object.fromEntries(Object.entries(p.inputs).map(([role,id])=>[role,facts.find(f=>f.id===id)]))}));
 assert.equal(comparisonMetricPlans(facts,[receipt,...saved]).filter(p=>!p.receiptId).length,0);
});
test('competing values and another entity never silently fill the planned inputs',()=>{
 const facts=[...revenues,...incomes,...balances.map(f=>({...f,status:'confirmed'})),{...balances[0],id:'alternative',status:'confirmed',value:'999'}];
 assert.ok(comparisonMetricPlans(facts,[receipt]).filter(p=>p.period==='FY2024').every(p=>p.missing.length));
 assert.ok(comparisonMetricPlans([...revenues,...incomes,...balances.map(f=>({...f,entity:'Other Corp'}))],[receipt]).filter(p=>p.type!=='net_income_growth').every(p=>p.missing.length));
});
