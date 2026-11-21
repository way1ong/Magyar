/* Offline service worker.
 * The static export (GitHub Pages) puts two globals at the top of this file
 * during `npm run build:static` (scripts/build-static.mjs):
 *   self.__BUILD__    — a hash of the build: every deploy is a new worker;
 *   self.__PRECACHE__ — every file of the app (pages, page data, Next chunks,
 *                       icons, manifest), as paths relative to the scope.
 * The worker downloads all of them when it installs, so after the first
 * launch with a network the whole app works offline, including pages that
 * were never opened. Without the injection (the laptop server) it caches the
 * main pages and then whatever gets visited.
 * - Pages and Next's page data (index.txt?_rsc=…): network first, so an
 *   online launch is fresh; after TIMEOUT_MS or offline, the cached copy.
 * - Hashed Next assets, icons and other files: cache first.
 * Paths come from the worker's own scope: works at the site root and under /Magyar/.
 */
const BUILD = self.__BUILD__ || "v22";
const CACHE = "magyar-" + BUILD;
const SCOPE = new URL(self.registration.scope).pathname; // "/" or "/Magyar/"
const STATIC = SCOPE !== "/"; // the static export uses trailing slashes
const page = (p) => (p === "" ? SCOPE : SCOPE + p + (STATIC ? "/" : ""));
const MAIN_PAGES = ["", "review", "harmony", "builder", "conj", "sentences", "dialogues", "dictionary", "mistakes", "stats", "boss", "guide", "settings", "personal"];
const SHELL = Array.isArray(self.__PRECACHE__)
  ? self.__PRECACHE__.map((p) => SCOPE + p)
  : [...MAIN_PAGES.map(page), SCOPE + "manifest.json", SCOPE + "icons/icon.svg"];
const TIMEOUT_MS = 4000;

const fresh = (u) => new Request(u, { cache: "reload" });

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // All or nothing first; if a file fails, keep what downloads so an update is never blocked.
      .then((c) => c.addAll(SHELL.map(fresh)).catch(() => Promise.all(SHELL.map((u) => c.add(fresh(u)).catch(() => {})))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("magyar-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Network first with a timeout; the response is cached under `key` (no query). Offline: the cached copy, then `fallback`. */
function networkFirst(req, key, fallback) {
  const fromCache = () => caches.match(key, { ignoreSearch: true }).then((hit) => hit || (fallback ? caches.match(fallback) : undefined));
  const net = fetch(req).then((res) => {
    if (res.ok && res.type === "basic") {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(key, copy));
    }
    return res;
  });
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done || !r) return;
      done = true;
      resolve(r);
    };
    const timer = setTimeout(() => fromCache().then(finish), TIMEOUT_MS);
    net.then((res) => {
      clearTimeout(timer);
      finish(res);
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then((hit) => finish(hit || Response.error()));
    });
  });
}

function cacheFirst(req) {
  return caches.match(req).then(
    (hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }),
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;
  if (url.pathname === SCOPE + "sw.js") return;
  const key = url.origin + url.pathname;
  if (req.mode === "navigate") return e.respondWith(networkFirst(req, key, SCOPE));
  if (url.pathname.endsWith(".txt")) return e.respondWith(networkFirst(req, key));
  e.respondWith(cacheFirst(req));
});
