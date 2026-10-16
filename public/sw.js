self.addEventListener('push', (event) => {
  let data = { title: 'Albasse Shopping', message: '' };
  try {
    data = event.data.json();
  } catch {
    // ignore, on garde les valeurs par defaut
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Albasse Shopping', {
      body: data.message || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
