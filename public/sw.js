/* Only public application assets are cached. API responses and evidence never enter this cache. */
const CACHE = "aquarelay-shell-v4";
function validAsset(response, url) {
  const type = response.headers.get('content-type') || '';
  return response.ok && (/\.css$/.test(new URL(url).pathname)
    ? type.includes('text/css') : /javascript|ecmascript/.test(type));
}
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const shell = await fetch("/", { cache: "reload" });
      if (!shell.ok) throw new Error("Application shell unavailable");
      const html = await shell.clone().text();
      const assets = [
        ...new Set(
          [...html.matchAll(/(?:src|href)\s*=\s*["'](\/assets\/[^"'?#]+)["']/g)]
            .map((match) => new URL(match[1], self.location.origin))
            .filter(
              (url) =>
                url.origin === self.location.origin &&
                url.pathname.startsWith("/assets/") &&
                /\.(js|css)$/.test(url.pathname),
            )
            .map((url) => url.href),
        ),
      ];
      if (!assets.length || assets.length > 64)
        throw new Error("Invalid application entry assets");
      // The first page loads before this worker controls it. Cache its entry
      // scripts/styles during installation rather than relying on HTTP cache.
      await Promise.all(assets.map(async url => {
        const response = await fetch(url);
        if (!validAsset(response, url)) throw new Error('Application asset unavailable');
        await cache.put(url, response);
      }));
      await cache.put("/", shell);
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("aquarelay-shell-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/media")
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            try {
              await cache.put("/", response.clone());
            } catch {
              /* Storage may be full. */
            }
          }
          return response;
        } catch {
          return (await cache.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }
  if (url.pathname.startsWith("/assets/"))
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(event.request);
        if (cached && validAsset(cached, url.href)) return cached;
        const response = await fetch(event.request);
        if (validAsset(response, url.href)) {
          // Keep the write within the fetch event's response lifetime.
          try {
            await cache.put(event.request, response.clone());
          } catch {
            /* Storage may be full. */
          }
        }
        return response;
      })(),
    );
});
/* No private API responses or authenticated pages are cached. */
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{return;}
 event.waitUntil(self.registration.showNotification(String(data.title||'AquaRelay update'),{body:String(data.body||''),tag:String(data.tag||'aquarelay'),data:{url:'/notifications'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil(self.clients.openWindow(new URL('/notifications',self.location.origin).href));
});
