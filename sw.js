'use strict';

/* sw.js — cache conservador para GitHub Pages.
   Objetivo: evitar mezclas raras de versiones viejas con nuevas.
   Estrategia:
   - navegación y assets locales importantes: network first
   - fallback a caché si no hay red
   - no interceptar llamadas a Firebase / Google APIs */

const CACHE_NAME = 'cartas-nupi-v6-imgbb';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css?v=6',
  './script.js?v=6',
  './firebase-integration.js?v=6',
  './natito-editor.js?v=6',
  './page-content.js?v=6',
  './photo-upload-config.js?v=6',
  './photo-formats.js?v=6',
  './photo-upload.js?v=6',
  './photo-converter.worker.js?v=6',
  './polish.css?v=6',
  './firebase-config.js?v=6',
  './login.html',
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
    await Promise.all(keys.filter(key => key.startsWith('cartas-nupi-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isCoreLocalAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return /\.(?:html|css|m?js|json)$/.test(url.pathname) ||
         url.pathname.endsWith('/');
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Firebase, ImgBB y sus imágenes siempre usan la red normal del navegador.
  if (url.origin !== self.location.origin) return;

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
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const fallback = await cache.match('./index.html');
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
