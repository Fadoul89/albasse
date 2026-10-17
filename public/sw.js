// Service worker Albasse Shopping : notifications push + page « hors connexion ».
//
// Chrome n'envoie l'evenement d'installation en un tap (beforeinstallprompt)
// que si le site a un service worker actif avec un gestionnaire « fetch » qui
// fait quelque chose (un gestionnaire vide est ignore). Le menu ⋮ de Chrome,
// lui, s'en passe : c'est pour ca que « Installer et creer un raccourci »
// existait deja alors que le bouton du site n'ouvrait jamais la boite.
//
// Le gestionnaire ne met rien d'autre en cache que la page hors connexion :
// pas de risque de montrer une ancienne version du site.
const CACHE = 'albasse-hors-connexion-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

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
