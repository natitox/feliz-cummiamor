'use strict';

/* sw.js — cache conservador + notificaciones web controladas por la página.
   Nota: esto NO reemplaza un backend/FCM para push remotas reales cuando la web
   está completamente cerrada. Sí permite experiencia PWA sólida y notificaciones
   locales desde la propia web/service worker. */

const CACHE_NAME = 'cartas-nupi-v2';
const STATIC_ASSETS = [
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
    await Promise.allSettled(STATIC_ASSETS.map(asset => cache.add(asset)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('firestore') || url.pathname.includes('googleapis')) return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const network = await fetch(event.request);
      if (network && network.status === 200 && network.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, network.clone()).catch(() => {});
      }
      return network;
    } catch (err) {
      const fallback = await caches.match('./index.html');
      if (fallback && event.request.mode === 'navigate') return fallback;
      throw err;
    }
  })());
});

self.addEventListener('message', event => {
  const data = event.data || {};
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
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if ('focus' in client) {
        await client.focus();
        client.postMessage({ type: 'OPEN_CHAT' });
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(url);
  })());
});
