/* Blixp service worker: installable app shell + offline fallback.
   Bump VERSION to force every device to refresh its cache. */
const VERSION = "blixp-v4";
const SHELL = VERSION + "-shell";
const RUNTIME = VERSION + "-runtime";

const PRECACHE = [
  "/",
  "/editor",
  "/manifest.webmanifest",
  "/pwa.js",
  "/logo.png",
  "/favicon.png",
  "/splash-logo.png",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) =>
        // add one by one so a single missing file never blocks install
        Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

// On launch, how long to wait for the network before showing the cached
// shell instead. The network request keeps going and refreshes the cache,
// so the next open is fresh. Without this a slow connection leaves the
// launch screen up until the request finishes or fails.
const NAV_TIMEOUT_MS = 2000;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.headers.has("range")) return; // let video/audio ranges hit the network

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Pages: network first (fresh), but fall back to the cached copy when
  // offline or when the network is slower than NAV_TIMEOUT_MS
  if (req.mode === "navigate") {
    const network = fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(req, copy));
      }
      return res;
    });
    // keep the request alive after a timeout so the cache still refreshes
    event.waitUntil(network.catch(() => null));

    const findCached = async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      const path = url.pathname.replace(/\/+$/, "");
      return (
        (await caches.match(path.startsWith("/editor") ? "/editor" : "/")) ||
        (await caches.match("/")) ||
        null
      );
    };

    event.respondWith(
      (async () => {
        let timer;
        const timeout = new Promise((resolve) => {
          timer = setTimeout(() => resolve("timeout"), NAV_TIMEOUT_MS);
        });
        try {
          const first = await Promise.race([network, timeout]);
          if (first !== "timeout") return first;
          // slow network: use the cached shell if there is one, otherwise
          // keep waiting for the network
          const cachedShell = await findCached();
          if (cachedShell) return cachedShell;
          return await network;
        } catch (err) {
          return (
            (await findCached()) ||
            new Response("You are offline.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        } finally {
          clearTimeout(timer);
        }
      })(),
    );
    return;
  }

  // Same-origin static files and Google Fonts: stale-while-revalidate
  if (sameOrigin || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === "opaque"))
              cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
