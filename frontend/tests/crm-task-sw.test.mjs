import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/crm-task-sw.js', import.meta.url), 'utf8');

function worker(preview, ok = true) {
  const handlers = {}, shown = [], opened = [], requested = [];
  const self = {
    location: { origin: 'https://flypenza.ru' },
    addEventListener: (name, handler) => { handlers[name] = handler; },
    skipWaiting() {},
    clients: { claim() {}, matchAll: async () => [], openWindow: async url => { opened.push(url); } },
    registration: { showNotification: async (title, options) => { shown.push({ title, ...options }); } },
  };
  vm.runInNewContext(source, { self, URL, Date, fetch: async (url, options) => { requested.push({ url, options }); return { ok, json: async () => preview }; } });
  return { shown, opened, requested,
    async push(payload) { let pending; handlers.push({ data: { json: () => payload }, waitUntil: value => { pending = value; } }); await pending; },
    async click(url) { let pending; handlers.notificationclick({ notification: { close() {}, data: { url } }, waitUntil: value => { pending = value; } }); await pending; },
  };
}

test('task push rechecks current account and deadline before showing a notification', async () => {
  const deadline = '2026-10-24T15:00:00Z';
  const w = worker({ user_id: 7, tasks: [{ id: 11, title: 'Связаться с клиентом', deadline }] });
  await w.push({ user_id: 7, tasks: [{ id: 11, deadline }] });
  assert.equal(w.shown.length, 1);
  assert.equal(w.shown[0].body, 'Связаться с клиентом');
  assert.equal(w.shown[0].data.url, '/crm/kanban?task=11');
  assert.equal(w.requested[0].options.credentials, 'include');
  assert.equal(w.requested[0].options.cache, 'no-store');
});

test('other account, logged-out, completed and rescheduled tasks are suppressed', async () => {
  const entry = { id: 11, deadline: '2026-10-24T15:00:00Z' };
  for (const [preview, ok] of [
    [{ user_id: 8, tasks: [{ ...entry, title: 'Чужая задача' }] }, true],
    [{ user_id: 7, tasks: [] }, true],
    [{ user_id: 7, tasks: [{ ...entry, deadline: '2026-10-25T15:00:00Z', title: 'Перенесена' }] }, true],
    [{}, false],
  ]) {
    const w = worker(preview, ok);
    await w.push({ user_id: 7, tasks: [entry] });
    assert.equal(w.shown.length, 0);
  }
});

test('several tasks are combined and test notification is separate', async () => {
  const tasks = Array.from({ length: 4 }, (_, index) => ({ id: index + 1, title: `Задача ${index + 1}`, deadline: '2026-10-24T15:00:00Z' }));
  const w = worker({ user_id: 7, tasks });
  await w.push({ user_id: 7, tasks });
  assert.equal(w.shown.length, 1);
  assert.equal(w.shown[0].title, 'Задач со сроком: 4');
  assert(w.shown[0].body.includes('И ещё 1'));
  assert.equal(w.shown[0].data.url, '/crm/kanban');
  await w.push({ user_id: 7, test: true });
  assert.equal(w.shown[1].tag, 'flypenza-task-test');
});

test('notification clicks only open CRM on the same origin', async () => {
  const w = worker({});
  await w.click('https://evil.example/crm/kanban');
  await w.click('/admin/');
  assert.equal(w.opened.length, 0);
  await w.click('/crm/kanban?task=11');
  assert.equal(w.opened[0], 'https://flypenza.ru/crm/kanban?task=11');
});
