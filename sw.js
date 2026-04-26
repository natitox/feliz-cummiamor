\
'use strict';

/* sw.js — cache conservador para GitHub Pages.
   Objetivo: evitar mezclas raras de versiones viejas con nuevas.
   Estrategia:
   - navegación y assets locales importantes: network first
   - fallback a caché si no hay red
   - no interceptar llamadas a Firebase / Google APIs */

const CACHE_NAME = 'cartas-nupi-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './firebase-integration.js',
  './natito-editor.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_ASSETS.map(asset => cache.add(asset)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isFirebaseRequest(url) {
  return url.origin.includes('googleapis.com') ||
         url.origin.includes('gstatic.com') ||
         url.pathname.includes('firestore');
}

function isCoreLocalAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return /\/(index\.html|style\.css|script\.js|firebase-integration\.js|natito-editor\.js|manifest\.json)?$/.test(url.pathname) ||
         url.pathname.endsWith('/');
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (isFirebaseRequest(url)) return;

  if (event.request.mode === 'navigate' || isCoreLocalAsset(url)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        if (fresh && fresh.status === 200 && fresh.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (error) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        const fallback = await caches.match('./index.html');
        if (fallback && event.request.mode === 'navigate') return fallback;
        throw error;
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, response.clone()).catch(() => {});
    }
    return response;
  })());
});

self.addEventListener('message', event => {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type !== 'CHAT_NOTIFY') return;

  const title = data.title || '💬 Nuevo mensaje';
  const options = {
    body: data.body || 'Tienes un mensaje nuevo 💖',
    icon: data.icon || './img/favicon.png',
    badge: data.badge || './img/favicon.png',
    tag: data.tag || 'chat-message',
    renotify: true,
    data: {
      url: data.url || './index.html#chat',
      chat: true
    },
    vibrate: [160, 80, 160]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './index.html#chat';

  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        client.postMessage({ type: 'OPEN_CHAT' });
        return;
      }
    }

    if (clients.openWindow) {
      await clients.openWindow(url);
    }
  })());
});
