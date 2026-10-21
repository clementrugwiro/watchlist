// Network-first for same-origin pages, saved copy only when offline. Never saves /api/ calls.
const C = 'wl-v3';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(C).then(c => c.put(r, copy)); } return res; })
    .catch(() => caches.match(r)));
});

// The number on the app icon = how many notifications are waiting.
const badge = async () => {
  try { const n = (await self.registration.getNotifications()).length;
    if (n) await self.navigator.setAppBadge?.(n); else await self.navigator.clearAppBadge?.(); } catch {}
};
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'Watchlist', {
      body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: d.tag, renotify: !!d.tag, data: { url: d.url || '/' } });
    await badge();
  })());
});
// Tapping a notification opens (or focuses) the app on the right page.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil((async () => {
    await badge();
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) if ('focus' in c) { c.navigate?.(url); return c.focus(); }
    return clients.openWindow(url);
  })());
});
