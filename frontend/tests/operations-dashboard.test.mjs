import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/operationsApi.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const calls = [];
const exports = {};
vm.runInNewContext(js, { exports, URLSearchParams, require: () => ({ apiJson: (url, options) => { calls.push({ url, options }); return Promise.resolve({}); } }) });
const { operationTasks, getOperationsDashboard } = exports;
const data = {
  tasks: [{ id: 1, purpose: 'general' }, { id: 2, purpose: 'documents' }, { id: 3, purpose: 'follow_up_6m' }, { id: 4, purpose: 'general' }],
  task_buckets: { overdue: [1, 2], today: [2], period: [2, 3], no_deadline: [4], all: [1, 2, 3, 4] },
};
test('urgent includes older overdue and today once, preserving server order', () => {
  assert.equal(operationTasks(data, 'urgent').map(x => x.id).join(','), '1,2');
  assert.equal(data.tasks.length, 4);
});
test('period and no-deadline filters use Moscow calendar buckets from the API', () => {
  assert.equal(operationTasks(data, 'period').map(x => x.id).join(','), '2,3');
  assert.equal(operationTasks(data, 'no_deadline').map(x => x.id).join(','), '4');
  assert.equal(operationTasks(data, 'all').length, 4);
});
test('document queue uses the actual purpose, excluding six-month follow-ups', () => {
  assert.equal(operationTasks(data, 'documents').map(x => x.id).join(','), '2');
});
test('period and assignee reach the authenticated CRM client without caching', async () => {
  await getOperationsDashboard({ days: 30, start: '2026-12-01', assignee: '6' });
  const last = calls.at(-1);
  const query = new URL(last.url, 'https://flypenza.ru').searchParams;
  assert.equal(query.get('days'), '30'); assert.equal(query.get('start'), '2026-12-01'); assert.equal(query.get('assignee'), '6');
  assert.equal(last.options.cache, 'no-store');
});
