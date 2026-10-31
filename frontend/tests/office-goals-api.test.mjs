import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function moduleAt(path, fetch, document, aliases = {}) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', 'document', 'process', outputText)(id => {
    if (aliases[id]) return aliases[id];
    if (id === './taskEvents') return { notifyTaskChange() {} };
    throw new Error(`Unexpected import: ${id}`);
  }, module, module.exports, fetch, document, { env: {} });
  return module.exports;
}

function setup(fetch, document = { cookie: '' }) {
  const crm = moduleAt('../src/lib/crmApi.ts', fetch, document);
  return moduleAt('../src/lib/officeGoalsApi.ts', fetch, document, { './crmApi': crm });
}

test('goals and actuals use the selected calendar month', async () => {
  const calls = [];
  const fetch = async (url, init) => { calls.push({url, init}); return { ok: true, json: async () => ({}) }; };
  const goals = setup(fetch);
  const actuals = moduleAt('../src/lib/managementDashboardApi.ts', fetch, {cookie:''});
  for (const month of [10, 11]) {
    await goals.fetchOfficeGoals({year:2026, month});
    await actuals.fetchManagementDashboard('custom_month', {year:2026, month});
  }
  assert.deepEqual(calls.map(c => new URL(c.url).searchParams.get('month')), ['10','10','11','11']);
  assert.ok(calls.every(c => c.init.credentials === 'include'));
});

test('checkbox and manual receipts reuse CRM CSRF protection', async () => {
  const document = {cookie:''}; const calls=[];
  const goals = setup(async (url, init) => {
    calls.push({url, init});
    if (url.endsWith('/api/auth/csrf/')) document.cookie = 'csrftoken=local-test-csrf';
    return { ok:true, json:async()=>({activities:[]}) };
  }, document);
  await goals.updateOfficeGoals({year:2026,month:11},{activity_id:'thailand-katya',completed:true});
  await goals.updateOfficeGoals({year:2026,month:11},{commission_receipts_actual:'0'});
  await goals.updateOfficeGoals({year:2026,month:11},{commission_receipts_actual:null});
  const writes=calls.filter(c=>c.init?.method==='PATCH');
  assert.equal(writes.length,3);
  for(const c of writes){ assert.equal(c.init.headers.get('X-CSRFToken'),'local-test-csrf'); assert.equal(c.init.credentials,'include'); }
  assert.deepEqual(JSON.parse(writes[0].init.body),{activity_id:'thailand-katya',completed:true});
  assert.deepEqual(JSON.parse(writes[1].init.body),{commission_receipts_actual:'0'});
  assert.deepEqual(JSON.parse(writes[2].init.body),{commission_receipts_actual:null});
});

test('save failures expose the server message and never report success',async()=>{
  const goals=setup(async()=>({ok:false,json:async()=>({detail:'Не удалось сохранить отметку'})}),{cookie:'csrftoken=local-test'});
  await assert.rejects(()=>goals.updateOfficeGoals({year:2026,month:11},{activity_id:'crm',completed:true}),/Не удалось сохранить отметку/);
});
