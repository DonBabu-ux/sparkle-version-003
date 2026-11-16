self.addEventListener('push', (event) => {
  let payload = { title: 'Sparkle', body: '', icon: '/logo.png', badge: '/sparklelogo.png', url: '/' };
  try {
    if (event.data) payload = Object.assign({}, payload, event.data.json());
  } catch (e) {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Sparkle', {
      body: payload.body || '',
      icon: payload.icon || '/logo.png',
      badge: payload.badge || '/sparklelogo.png',
      data: { url: payload.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          try { await client.navigate(target); } catch (e) { /* cross-origin mid-nav */ }
        }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
