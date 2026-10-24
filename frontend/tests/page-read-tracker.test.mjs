import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';

const source = await readFile(new URL('../public/page-read-tracker.js', import.meta.url), 'utf8');
const { publicPagePath, createPageReading, startPageTracking } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function environment() {
  let now = 0, focused = true;
  const packets = [], intervals = new Set(), saved = new Map();
  const doc = new EventTarget();
  doc.visibilityState = 'visible';
  doc.hasFocus = () => focused;
  const win = new EventTarget();
  win.setInterval = callback => { intervals.add(callback); return callback; };
  win.clearInterval = callback => intervals.delete(callback);
  const values = { document: doc, window: win, location: { hostname: 'flypenza.ru' }, performance: { now: () => now }, crypto: webcrypto,
    navigator: { sendBeacon: (url, body) => { packets.push({ url, body, beacon: true }); return true; } },
    fetch: (url, options) => { packets.push({ url, body: options.body, options }); return Promise.resolve({ ok: true }); },
  };
  for (const [key, value] of Object.entries(values)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  return {
    packets, intervals, doc, win,
    advance: ms => { now += ms; },
    heartbeat: () => { for (const fn of intervals) fn(); },
    focus: value => { focused = value; win.dispatchEvent(new Event(value ? 'focus' : 'blur')); },
    visible: value => { doc.visibilityState = value ? 'visible' : 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); },
    async events() { return Promise.all(packets.map(async p => ({ ...p, data: JSON.parse(typeof p.body === 'string' ? p.body : await p.body.text()) }))); },
    restore() { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } },
  };
}

test('positive public catalogue strips URL parameters and excludes internal routes', () => {
  assert.equal(publicPagePath('/tours/?utm_campaign=x#form'), '/tours');
  assert.equal(publicPagePath('/china-tour-builder.html'), '/tours/china-constructor');
  assert.equal(publicPagePath('/blog/example-123'), '/blog/example-123');
  for (const path of ['/crm', '/crm/articles', '/admin', '/api/leads', '/candidates', '/candidate-form.html', '/tours/private', '/blog/../crm', '/unknown', 'https://flypenza.ru/']) assert.equal(publicPagePath(path), null, path);
});

test('active time excludes hidden/unfocused periods; heartbeat and cleanup send cumulative values', async () => {
  const env = environment();
  try {
    const reading = createPageReading('/tours?phone=secret');
    const cleanup = startPageTracking(reading, 'http://localhost:8000');
    env.advance(15000); env.heartbeat();
    env.advance(5000); env.visible(false);
    const count = env.packets.length;
    env.advance(60000); env.heartbeat();
    assert.equal(env.packets.length, count);
    env.focus(false); env.visible(true); env.advance(10000); env.heartbeat();
    env.focus(true); env.advance(5000); cleanup();
    const events = await env.events();
    assert.equal(events.at(-1).data.active_ms, 25000);
    assert.equal(new Set(events.map(e => e.data.view_id)).size, 1);
    assert(events.some(e => e.data.kind === 'progress' && e.data.active_ms === 15000));
    assert(events.at(-1).beacon);
    assert(events.every(e => e.url === '/api/pages/read-event/' && e.data.path === '/tours'));
    assert(events.every(e => Object.keys(e.data).sort().join(',') === 'active_ms,kind,path,view_id'));
    assert.equal(env.intervals.size, 0);
  } finally { env.restore(); }
});

test('Strict Mode effect restart retains one opening; navigation uses a new identity and path', async () => {
  const env = environment();
  try {
    const reading = createPageReading('/');
    startPageTracking(reading)();
    const cleanup = startPageTracking(reading);
    env.advance(15000); env.heartbeat(); cleanup();
    const nextCleanup = startPageTracking(createPageReading('/tours'));
    env.advance(5000); nextCleanup();
    const events = await env.events();
    assert.equal(new Set(events.filter(e => e.data.path === '/').map(e => e.data.view_id)).size, 1);
    assert.equal(events.filter(e => e.data.path === '/' && e.data.kind === 'start').length, 1);
    assert.equal(new Set(events.map(e => e.data.view_id)).size, 2);
    assert.equal(events.at(-1).data.active_ms, 5000);
  } finally { env.restore(); }
});

test('opening a hidden page is delayed; bfcache restores as a new opening', async () => {
  const env = environment();
  try {
    env.visible(false);
    const cleanup = startPageTracking(createPageReading('/contacts'));
    env.advance(60000); env.heartbeat(); assert.equal(env.packets.length, 0);
    env.visible(true); env.advance(2000);
    env.win.dispatchEvent(new Event('pagehide'));
    env.advance(60000);
    const show = new Event('pageshow'); Object.defineProperty(show, 'persisted', { value: true }); env.win.dispatchEvent(show);
    env.advance(3000); cleanup();
    const events = await env.events();
    assert.equal(new Set(events.map(e => e.data.view_id)).size, 2);
    assert.equal(events.at(-1).data.active_ms, 3000);
  } finally { env.restore(); }
});

test('internal paths do not install listeners or emit events; cap and beacon fallback work', async () => {
  const env = environment();
  try {
    startPageTracking(createPageReading('/crm/articles'))();
    assert.equal(env.intervals.size, 0); assert.equal(env.packets.length, 0);
    navigator.sendBeacon = () => false;
    const cleanup = startPageTracking(createPageReading('/about'));
    env.advance(8_000_000); env.heartbeat();
    const count = env.packets.length; env.advance(15000); env.heartbeat(); assert.equal(env.packets.length, count);
    cleanup();
    const events = await env.events();
    assert.equal(events.at(-1).data.active_ms, 7_200_000);
    assert.equal(events.at(-1).options.keepalive, true);
    assert.equal(events.at(-1).options.credentials, 'omit');
  } finally { env.restore(); }
});
