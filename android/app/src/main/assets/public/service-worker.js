self.addEventListener('install', event => {
    console.log('[Service Worker] Install');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('[Service Worker] Activate');
});

self.addEventListener('push', event => {
    console.log('[Service Worker] Push Received.');
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'Sparkle', body: event.data.text() };
        }
    }

    const title = data.title || 'Sparkle Notification';
    const options = {
        body: data.body || 'You have a new notification.',
        icon: data.icon || '/images/logo.png',
        badge: '/images/logo.png',
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification click received.');
    event.notification.close();

    const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Check if there is already a window/tab open with the target URL
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window/tab
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
