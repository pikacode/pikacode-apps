// 网页测试版的 service worker：本目录 app/ 下的请求从本机缓存取（缓存是入口页输对口令后解密写进去的），没有的再走网络。
const CACHE = 'jstqb-web-test';
const APP = new URL('app/', self.location.href).pathname;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(APP)) return;
  const path = url.pathname === APP ? APP + 'index.html' : url.pathname;
  e.respondWith(
    caches.open(CACHE)
      .then((c) => c.match(path))
      .then((hit) => hit || (path.endsWith('.html') ? Response.redirect(APP.slice(0, -'app/'.length), 302) : fetch(e.request))),
  );
});
