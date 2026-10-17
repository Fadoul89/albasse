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
const CACHE = 'albasse-hors-connexion-v2';
const OFFLINE_URL = '/offline.html';
// Cache partage avec la page (public/index.html) pour le toucher d'une notification.
const HANDOFF_CACHE = 'albasse-notification';
const HANDOFF_KEY = '/__ouverture-notification';

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
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE && key !== HANDOFF_CACHE).map((key) => caches.delete(key)))
      )
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
  const options = {
    body: data.message || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Page a ouvrir au toucher : la fiche du produit (envoyee par le serveur).
    data: { url: data.url || '/' },
  };
  // Photo du produit sous le texte (Android ; Apple ne l'affiche pas) : adresse https seulement.
  if (typeof data.image === 'string' && data.image.startsWith('https://')) options.image = data.image;
  event.waitUntil(self.registration.showNotification(data.title || 'Albasse Shopping', options));
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

// Sur iPhone, Apple lance parfois l'appli sur l'accueil sans suivre l'adresse donnee a
// openWindow(). Le service worker note donc aussi la page voulue dans un cache que la
// page lit a son ouverture et a son retour au premier plan (voir public/index.html) :
// c'est elle qui va alors sur la bonne fiche.
async function rememberTarget(target) {
  try {
    const cache = await caches.open(HANDOFF_CACHE);
    await cache.put(HANDOFF_KEY, new Response(JSON.stringify({ url: target, at: Date.now() })));
    // Une page deja ouverte est prevenue tout de suite.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    windows.forEach((w) => w.postMessage({ type: 'albasse-notification' }));
  } catch {
    // silencieux : l'ouverture directe reste tentee
  }
}

async function openTarget(target) {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
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
  try {
    await self.clients.openWindow(target);
  } catch {
    // refuse : la page lira la page voulue dans le cache a son ouverture
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = pageToOpen(event.notification);
  event.waitUntil(Promise.allSettled([rememberTarget(target), openTarget(target)]));
});
