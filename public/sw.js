// Drive Music Player - Service Worker
const CACHE_VERSION = "drive-music-pwa-v1.4.0";
const STATIC_CACHE_NAME = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `runtime-${CACHE_VERSION}`;

// Core assets to pre-cache on install (using relative paths for GitHub Pages subpath compatibility)
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png",
  "./icon.svg",
  "./icon-192.svg",
  "./icon-512.svg",
  "./icon-maskable.svg",
];

// Install Event: Cache Core Assets & Skip Waiting
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[SW] Pre-cache failed:", err);
      })
  );
});

// Activate Event: Cleanup Old Caches & Claim Clients Immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith("drive-music-") && name !== STATIC_CACHE_NAME && name !== RUNTIME_CACHE_NAME)
            .map((name) => {
              console.log("[SW] Deleting old cache:", name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Network-First for APIs & Drive Streams, Stale-While-Revalidate for UI Assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and browser extensions
  if (request.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // Pass Google Drive API, Firebase Firestore, and Range requests directly through network
  if (
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("firestore") ||
    request.headers.get("range") ||
    url.pathname.startsWith("/api/")
  ) {
    return; // Direct network bypass
  }

  // For app navigation requests (HTML), use Network-First with Cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          return caches.match("./index.html") || caches.match("/");
        })
    );
    return;
  }

  // For static assets (JS, CSS, SVGs, Fonts), use Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(RUNTIME_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for update triggers from client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
