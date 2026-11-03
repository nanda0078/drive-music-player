// Drive Music - Service Worker v2.0.0 (Selective Caching & Instant PWA Support)
const CACHE_VERSION = "drive-music-pwa-v2.0.0";
const STATIC_CACHE_NAME = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `runtime-${CACHE_VERSION}`;

// Core assets to pre-cache on install (relative paths for GitHub Pages subpath compatibility)
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

// Install Event: Cache Core UI Shell Assets & Prepare Activation
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[SW] Pre-cache warning:", err);
      })
  );
});

// Activate Event: Clean Up Stale Caches & Claim Clients Immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (name) =>
                name.startsWith("drive-music-") &&
                name !== STATIC_CACHE_NAME &&
                name !== RUNTIME_CACHE_NAME
            )
            .map((name) => {
              console.log("[SW] Removing outdated cache:", name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Selective Caching Strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests and unsupported protocols
  if (request.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // 2. EXCLUDE LARGE AUDIO FILES, GOOGLE DRIVE STREAMS, AUTH & TOKENS FROM SW CACHE
  // Never cache audio streaming endpoints, byte-range requests, or authentication data
  const isAudioOrStream =
    url.pathname.includes("/api/audio/") ||
    url.pathname.includes("/api/stream") ||
    url.hostname.includes("googleapis.com/drive") ||
    url.searchParams.has("alt") && url.searchParams.get("alt") === "media" ||
    request.headers.get("range");

  const isAuthOrToken =
    url.hostname.includes("accounts.google.com") ||
    url.hostname.includes("oauth2.googleapis.com") ||
    url.hostname.includes("identitytoolkit.googleapis.com") ||
    url.hostname.includes("securetoken.googleapis.com") ||
    url.pathname.includes("/token") ||
    url.searchParams.has("token");

  const isFirestoreOrFirebase =
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.pathname.startsWith("/api/auth");

  if (isAudioOrStream || isAuthOrToken || isFirestoreOrFirebase) {
    // Pure network pass-through — never touch SW cache
    return;
  }

  // 3. For app navigation requests (HTML), use Network-First with Cache fallback
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

  // 4. For static app shell assets (JS, CSS, SVGs, Images, Web Manifest), use Stale-While-Revalidate
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

// Listen for SKIP_WAITING message to trigger instant seamless client update
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
