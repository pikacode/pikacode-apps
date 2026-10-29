// 网页测试版的 service worker：本目录 app/ 下的请求从本机缓存取（缓存是入口页输对口令后解密写进去的），没有的再走网络。
// 打开 App 页面时先看线上有没有新构建：有就转回入口页重新下载（直接收藏 app/ 也不会一直停在旧版）；没网时照旧用缓存。
const CACHE = 'jstqb-web-test';
const APP = new URL('app/', self.location.href).pathname;
const GATE = APP.slice(0, -'app/'.length);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function isStale(cache) {
  const local = await cache.match(APP + '__build');
  if (!local) return true;
  try {
    const res = await fetch(GATE + 'build.json', { cache: 'no-store' });
    return (await res.json()).build !== (await local.text());
  } catch (_) {
    return false;
  }
}

async function respond(request, path) {
  const cache = await caches.open(CACHE);
  if (request.mode === 'navigate' && await isStale(cache)) return Response.redirect(GATE, 302);
  const hit = await cache.match(path);
  if (hit) return hit;
  return path.endsWith('.html') ? Response.redirect(GATE, 302) : fetch(request);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(APP)) return;
  const path = url.pathname === APP ? APP + 'index.html' : url.pathname;
  e.respondWith(respond(e.request, path));
});
