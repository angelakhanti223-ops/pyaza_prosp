// Only task notifications. No fetch interception, offline cache or public-site tracking.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload;
    try { payload = event.data?.json(); } catch { return; }
    if (!payload || !Number.isInteger(payload.user_id)) return;
    const entries = Array.isArray(payload.tasks) ? payload.tasks.slice(0, 10).filter(t => Number.isInteger(t.id)) : [];
    const response = await fetch(`/api/crm/task-push/preview/?ids=${entries.map(t => t.id).join(',')}`, { credentials: 'include', cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return;
    const current = await response.json();
    if (current.user_id !== payload.user_id) return;
    let title, body, url, tag;
    if (payload.test === true) {
      title = 'Слетать.ру · уведомления включены';
      body = 'Здесь будут появляться напоминания о сроках ваших задач.';
      url = '/crm/kanban'; tag = 'flypenza-task-test';
    } else {
      const tasks = current.tasks.filter(task => entries.some(entry => entry.id === task.id && new Date(entry.deadline).getTime() === new Date(task.deadline).getTime()));
      if (!tasks.length) return;
      title = tasks.length === 1 ? 'Пора выполнить задачу' : `Задач со сроком: ${tasks.length}`;
      body = tasks.slice(0, 3).map(task => task.title.slice(0, 110)).join('\n');
      if (tasks.length > 3) body += `\nИ ещё ${tasks.length - 3}`;
      url = tasks.length === 1 ? `/crm/kanban?task=${tasks[0].id}` : '/crm/kanban';
      tag = 'flypenza-tasks';
    }
    await self.registration.showNotification(title, {
      body, icon: '/logo.jpg', tag, renotify: true,
      data: { url, user_id: current.user_id },
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || '/crm/kanban', self.location.origin);
    if (target.origin !== self.location.origin || !target.pathname.startsWith('/crm/')) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).pathname.startsWith('/crm/'));
    if (existing) { await existing.navigate(target.href); await existing.focus(); }
    else await self.clients.openWindow(target.href);
  })());
});
