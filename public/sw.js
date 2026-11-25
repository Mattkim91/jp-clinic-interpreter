const PREFIX = "clinic-ja-";
const CACHE = `${PREFIX}v1`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Drop the scripts and styles of earlier versions: keep only what this page names. */
async function tidy(page) {
  const html = await page.text();
  const named = new Set([...html.matchAll(/assets\/[^"'\s)]+/g)].map((match) => match[0].split("/").pop()));
  if (!named.size) return;
  const cache = await caches.open(CACHE);
  for (const request of await cache.keys()) {
    const parts = new URL(request.url).pathname.split("/");
    if (parts[parts.length - 2] === "assets" && !named.has(parts[parts.length - 1])) await cache.delete(request);
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const dict = url.pathname.includes("/kuromoji-dict/");
  event.respondWith(
    (dict ? caches.match(event.request) : Promise.resolve(undefined)).then((cached) => {
      if (cached) return cached;
      // GitHub Pages lets the page be reused for 10 minutes: ask the server each time instead.
      return (event.request.mode === "navigate" ? fetch(event.request, { cache: "no-cache" }) : fetch(event.request))
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            if (event.request.mode === "navigate") event.waitUntil(tidy(response.clone()).catch(() => {}));
          }
          return response;
        })
        .catch(() => caches.match(event.request));
    }),
  );
});
