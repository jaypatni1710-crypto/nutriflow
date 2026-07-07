// Minimal service worker whose only job is to receive Web Push events and
// show a native notification, then focus/open the app when it's clicked.
// This runs even if no NutriFlow tab is open.

self.addEventListener('push', (event) => {
  let data = { title: 'NutriFlow', body: 'You have a new notification.', url: '/dashboard/appointments' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Ignore malformed payloads — fall back to the default above.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard/appointments';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = allClients.find((c) => c.url.includes(targetUrl));
      if (existing) {
        existing.focus();
      } else if (allClients.length > 0) {
        allClients[0].focus();
        allClients[0].navigate(targetUrl);
      } else {
        self.clients.openWindow(targetUrl);
      }
    })()
  );
});