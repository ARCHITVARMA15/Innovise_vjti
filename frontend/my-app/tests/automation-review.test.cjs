const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const filename = path.join(__dirname, '../src/lib/automation-review.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText, filename);
const {candidateReviewIssues, batchReviewIssues} = compiled.exports;
const values = {metric:'current_assets',value:'190867000000',entity:'AMAZON COM INC',
  currency:'USD',scale:'units',reporting_period:'FY2024',period_type:'instant',
  period_start:null,period_end:'2024-12-31',accounting_scope:null,
  ambiguity_note:'Accounting basis could not be established from the filing.'};
const candidate = {values,fact:{...values,id:'candidate-1',source_available:true,removed_at:null}};

test('the reported Amazon selection explains its missing basis and unresolved note',()=>{
  const issues=batchReviewIssues([candidate],{});
  assert.equal(issues.length,1);
  assert.match(issues[0],/current assets · FY2024/);
  assert.match(issues[0],/Enter accounting basis/);
  assert.match(issues[0],/Resolve the ambiguity note/);
});
test('review uses current edits and preserves blank start dates for instant balances',()=>{
  const edited={...values,accounting_scope:'consolidated US GAAP',ambiguity_note:null};
  assert.deepEqual(batchReviewIssues([candidate],{'candidate-1':edited}),[]);
  assert.equal(values.accounting_scope,null);
  assert.match(candidateReviewIssues(candidate,{...edited,period_type:'duration'})[0],/period start/);
});
test('removed sources remain blocked and an empty batch cannot submit',()=>{
  assert.match(candidateReviewIssues({...candidate,fact:{...candidate.fact,source_available:false}},values).join(' '),/removed/);
  assert.match(batchReviewIssues([],{}).join(' '),/Select at least one/);
});
