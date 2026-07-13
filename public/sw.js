const CACHE_VERSION = 'v3';
const STATIC_CACHE = `bc-charge-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `bc-charge-dynamic-${CACHE_VERSION}`;
const API_CACHE = `bc-charge-api-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/bc-icon.svg',
  '/offline.html',
];

const CACHE_STRATEGIES = {
  cacheFirst: ['fonts.googleapis.com', 'fonts.gstatic.com'],
  networkFirst: ['/api/'],
  staleWhileRevalidate: ['/assets/'],
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key.startsWith('bc-charge-') && !key.includes(CACHE_VERSION))
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isCacheFirstRequest(url) {
  return CACHE_STRATEGIES.cacheFirst.some((domain) => url.hostname.includes(domain));
}

function isStaleWhileRevalidate(url) {
  return CACHE_STRATEGIES.staleWhileRevalidate.some((path) => url.pathname.startsWith(path));
}

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidateStrategy(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const cache = caches.open(DYNAMIC_CACHE);
        cache.then((c) => c.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

async function networkOnlyWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      if (offlinePage) return offlinePage;
      
      const indexPage = await caches.match('/');
      if (indexPage) return indexPage;
    }
    return new Response('Offline', { status: 503 });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin && !isCacheFirstRequest(url)) {
    return;
  }

  let responsePromise;

  if (isCacheFirstRequest(url)) {
    responsePromise = cacheFirstStrategy(request);
  } else if (isApiRequest(url)) {
    responsePromise = networkFirstStrategy(request);
  } else if (isStaleWhileRevalidate(url)) {
    responsePromise = staleWhileRevalidateStrategy(request);
  } else if (request.mode === 'navigate') {
    responsePromise = networkOnlyWithOfflineFallback(request);
  } else {
    responsePromise = caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const cache = caches.open(DYNAMIC_CACHE);
          cache.then((c) => c.put(request, response.clone()));
        }
        return response;
      });
    });
  }

  event.respondWith(responsePromise);
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'BC Charge Benachrichtigung',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'BC Charge', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
