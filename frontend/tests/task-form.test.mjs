import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/taskForm.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { taskDeadlinePatch, toLocalTaskTime } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('editing other fields preserves original deadline seconds and contact identity', () => {
  const original = '2026-10-24T10:30:42.123456Z';
  assert.deepEqual(taskDeadlinePatch(original, toLocalTaskTime(original)), {});
  assert.deepEqual(taskDeadlinePatch(null, ''), {});
});

test('explicit deadline changes are saved and clearing removes the deadline', () => {
  const original = '2026-10-24T10:30:42.123456Z';
  const input = '2026-11-01T15:00';
  assert.deepEqual(taskDeadlinePatch(original, input), { deadline: new Date(input).toISOString() });
  assert.deepEqual(taskDeadlinePatch(original, ''), { deadline: null });
});
