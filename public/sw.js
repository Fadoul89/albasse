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
      // Page a ouvrir au toucher : la fiche du produit (envoyee par le serveur).
      data: { url: data.url || '/' },
    })
  );
});

// Adresse a ouvrir au toucher de la notification : celle envoyee avec elle, sinon
// l'accueil. Jamais une adresse hors du site.
function pageToOpen(notification) {
  const home = self.location.origin + '/';
  try {
    const url = new URL((notification.data && notification.data.url) || '/', self.location.origin);
    return url.origin === self.location.origin ? url.href : home;
  } catch {
    return home;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = pageToOpen(event.notification);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      const client = clientList[0];
      if (client) {
        // Le site est deja ouvert : on le ramene devant puis on l'amene sur la bonne page.
        try {
          await client.focus();
        } catch {
          // refuse sur certains appareils : la navigation suffit
        }
        try {
          if (client.url !== target) await client.navigate(target);
          return;
        } catch {
          // fenetre non controlee ou navigation refusee : on ouvre la page a la place
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
