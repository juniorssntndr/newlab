// Service Worker for AFINIX Dental Lab Web Push Notifications
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let payload = {
        title: 'AFINIX Dental Lab',
        body: 'Nueva notificación de pedido',
        icon: '/icon-192x192.png',
        badge: '/icon-32x32.png',
        url: '/'
    };

    if (event.data) {
        try {
            const json = event.data.json();
            payload = { ...payload, ...json };
        } catch {
            payload.body = event.data.text();
        }
    }

    const targetUrl = payload.url || (payload.data && payload.data.url) || '/';

    const options = {
        body: payload.body,
        icon: payload.icon || '/icon-192x192.png',
        badge: payload.badge || '/icon-32x32.png',
        data: {
            url: targetUrl
        },
        vibrate: [200, 100, 200],
        tag: payload.tag || `afinix-${Date.now()}`,
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Si ya hay una ventana abierta de AFINIX, le damos foco y navegamos
            for (const client of clientList) {
                if ('focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            // Si no hay ventana abierta, abrimos una nueva
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});
