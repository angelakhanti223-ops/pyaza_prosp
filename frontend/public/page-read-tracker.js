// Shared by App Router pages and the standalone China constructor.
// Never persist a visitor ID, URL parameters, referrer, form data or document title.
export const PUBLIC_PAGE_PATHS = [
  '/', '/tours', '/tours/china-constructor', '/tours/russia-january-2027',
  '/tours/china-2026', '/tours/china-november-2026', '/tours/shanghai-beijing-constructor',
  '/directions', '/cruises', '/promotions', '/blog', '/blog/kakie-gory-i-sklon-vam-podoydut',
  '/middle-east', '/about', '/team', '/certificates', '/contacts', '/privacy', '/terms',
];
const MAX_ACTIVE_MS = 2 * 60 * 60 * 1000;

/** @param {string} value */
export function publicPagePath(value) {
  let path = value.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  if (path === '/china-tour-builder.html') path = '/tours/china-constructor';
  return PUBLIC_PAGE_PATHS.includes(path) || /^\/blog\/[a-zA-Z0-9_-]{1,255}$/.test(path) ? path : null;
}

function viewId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  return Array.from(bytes, (value, index) => `${[4, 6, 8, 10].includes(index) ? '-' : ''}${value.toString(16).padStart(2, '0')}`).join('');
}

/** @param {string} path */
export function createPageReading(path) {
  return { path, id: viewId(), activeMs: 0, started: false };
}

/**
 * @param {ReturnType<typeof createPageReading>} reading
 * @param {string} [configuredBase]
 */
export function startPageTracking(reading, configuredBase = '') {
  const path = publicPagePath(reading.path);
  if (!path) return () => {};
  reading.path = path;
  let base = configuredBase.replace(/\/$/, '');
  if (!['localhost', '127.0.0.1'].includes(location.hostname) && /localhost|127\.0\.0\.1/.test(base)) base = '';
  const url = `${base}/api/pages/read-event/`;
  let runningSince = null;
  let pageHidden = false;
  const eligible = () => !pageHidden && document.visibilityState === 'visible' && document.hasFocus();
  const capture = () => {
    if (runningSince !== null) {
      const now = performance.now();
      reading.activeMs = Math.min(MAX_ACTIVE_MS, reading.activeMs + Math.max(0, now - runningSince));
      runningSince = now;
    }
    return Math.round(reading.activeMs);
  };
  const send = (kind, beacon = false) => {
    if (!reading.started) return;
    const body = JSON.stringify({ path: reading.path, view_id: reading.id, active_ms: capture(), kind });
    if (beacon && typeof navigator.sendBeacon === 'function') {
      try {
        if (navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) return;
      } catch { /* Retry through keepalive fetch. */ }
    }
    void fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, credentials: 'omit', keepalive: true }).catch(() => {});
  };
  const update = () => {
    capture();
    if (eligible()) {
      runningSince = performance.now();
      if (!reading.started) { reading.started = true; send('start'); }
    } else { runningSince = null; send('end', true); }
  };
  const hide = () => { capture(); pageHidden = true; runningSince = null; send('end', true); };
  const show = (event) => {
    if (event.persisted) Object.assign(reading, createPageReading(path));
    pageHidden = false;
    update();
  };
  document.addEventListener('visibilitychange', update);
  window.addEventListener('focus', update);
  window.addEventListener('blur', update);
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', show);
  const heartbeat = window.setInterval(() => { if (eligible() && reading.activeMs < MAX_ACTIVE_MS) send('progress'); }, 15000);
  update();
  return () => {
    capture(); runningSince = null; send('end', true);
    window.clearInterval(heartbeat);
    document.removeEventListener('visibilitychange', update);
    window.removeEventListener('focus', update);
    window.removeEventListener('blur', update);
    window.removeEventListener('pagehide', hide);
    window.removeEventListener('pageshow', show);
  };
}
