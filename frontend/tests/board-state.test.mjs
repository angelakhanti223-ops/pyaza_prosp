import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/boardState.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { previewTaskMove, dropIndex, matchesTaskDate, taskGroupMatches, sortClosedTasks } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('closed section includes done and cancelled, with no overlap with working states', () => {
  for (const status of ['new', 'in_progress', 'waiting_client', 'postponed', 'done', 'cancelled']) {
    assert.equal(taskGroupMatches({ status }, true), ['done', 'cancelled'].includes(status));
    assert.notEqual(taskGroupMatches({ status }, true), taskGroupMatches({ status }, false));
  }
});

test('closed records sort by closure date, with fallback for unknown historical date', () => {
  const tasks = [{id:1,closed_at:'2026-10-24T10:00:00Z',updated_at:'2026-10-25T11:00:00Z'}, {id:2,closed_at:'2026-10-25T10:00:00Z'}, {id:3,closed_at:null,updated_at:'2026-10-23T10:00:00Z'}];
  assert.deepEqual(sortClosedTasks(tasks).map(t=>t.id), [2,1,3]);
  assert.deepEqual(tasks.map(t=>t.id), [1,2,3]);
});

test('drag preview changes status and column together while preserving the cancellation snapshot', () => {
  const tasks = [{ id: 1, column: 10, status: 'new', status_display: 'Новая', order: 0 }, { id: 2, column: 10, status: 'new', order: 1 }];
  const moved = previewTaskMove(tasks, 1, { id: 11, status: 'done', name: 'Выполнено' });
  assert.equal(moved[0].status, 'done'); assert.equal(moved[0].column, 11);
  assert.equal(tasks[0].status, 'new'); assert.equal(tasks[0].column, 10);
  assert.equal(moved[1], tasks[1]);
});

test('drop positions account for hidden tasks and moving in either direction', () => {
  const tasks = [{ id: 1, column: 10, order: 0 }, { id: 2, column: 10, order: 1 }, { id: 3, column: 10, order: 2 }, { id: 4, column: 11, order: 99 }];
  assert.equal(dropIndex(tasks, 1, 10, 3), 2);
  assert.equal(dropIndex(tasks, 3, 10, 1), 0);
  assert.equal(dropIndex(tasks, 4, 10, 3), 2); // hidden id=2 still occupies its position
  assert.equal(dropIndex(tasks, 4, 10, 'column-10'), 3);
});

test('overdue includes earlier today; terminal tasks are excluded from date filters', () => {
  const now = new Date('2026-10-24T10:00:00Z');
  const task = { deadline: '2026-10-24T09:00:00Z', status: 'new' };
  assert.equal(matchesTaskDate(task, 'overdue', now), true);
  for (const status of ['done', 'cancelled']) for (const filter of ['today', 'week', 'overdue']) assert.equal(matchesTaskDate({ ...task, status }, filter, now), false);
  assert.equal(matchesTaskDate({ ...task, status: 'done' }, 'all', now), true);
});

test('today/week boundaries use Moscow dates and skip unscheduled tasks', () => {
  const now = new Date('2026-10-24T21:05:00Z'); // 25 October in Moscow
  assert.equal(matchesTaskDate({ deadline: '2026-10-24T21:01:00Z', status: 'waiting_client' }, 'today', now), true);
  assert.equal(matchesTaskDate({ deadline: '2026-10-24T20:59:00Z', status: 'new' }, 'today', now), false);
  assert.equal(matchesTaskDate({ deadline: '2026-10-30T21:00:00Z', status: 'new' }, 'week', now), true);
  assert.equal(matchesTaskDate({ deadline: '2026-10-31T21:00:00Z', status: 'new' }, 'week', now), false);
  assert.equal(matchesTaskDate({ deadline: null, status: 'new' }, 'today', now), false);
});
