/* Minimal offline service worker.
 * - App shell + Next static assets: cache-first (hashed filenames, safe to cache).
 * - Navigations: network-first, fall back to cached page, then to the start page.
 * Works both at the site root (laptop server) and under /Magyar/ (GitHub
 * Pages): every path is built from the worker's own scope.
 * Bump CACHE when you change caching logic; Next asset hashes handle the rest.
 */
const CACHE = "magyar-v12";
const SCOPE = new URL(self.registration.scope).pathname; // "/" or "/Magyar/"
const STATIC = SCOPE !== "/"; // the static export uses trailing slashes
const page = (p) => (p === "" ? SCOPE : SCOPE + p + (STATIC ? "/" : ""));
const SHELL = [
  ...["", "review", "harmony", "builder", "conj", "sentences", "dictionary", "mistakes", "stats", "dictation", "boss", "guide", "settings"].map(page),
  SCOPE + "manifest.json",
  SCOPE + "icons/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(SCOPE)))
    );
    return;
  }

  const p = url.pathname;
  if (p.includes("/_next/static/") || p.startsWith(SCOPE + "icons/") || p.startsWith(SCOPE + "audio/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
  }
});
