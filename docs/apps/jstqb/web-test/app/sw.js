// 网页的离线缓存（pika 10-31 选「加离线缓存」）：iPhone Safari 刷新时会逐个问服务器 90 多个文件变没变，要 2–3 秒。
// 这里把本版的文件（程序、引擎、字体、シラバス等）存在浏览器里，刷新直接从这里取，不再逐个问。
// 不会卡在旧版：每次打开页面（导航）都从网上取 index.html 和 boot_sizes.json（构建时写的版本记号 stamp），
// 记号变了就清掉旧版文件再取新的；取不到记号（开发时、离线）不存也不用缓存，全部照常走网络。
// index.html、boot_sizes.json、flutter_bootstrap.js、sw.js 自己从不缓存。

const prefix = 'jstqb-app-';
const neverCache = ['boot_sizes.json', 'flutter_bootstrap.js', 'sw.js', 'index.html'];
let stamp = null;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/** 从网上读本版记号；读到了且和缓存的不同，删掉别的版本的缓存。读不到返回 null。 */
async function refreshStamp() {
  try {
    const res = await fetch(new URL('boot_sizes.json', self.registration.scope), { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const value = (await res.json()).stamp;
    if (typeof value !== 'string' || !value) throw new Error('没有 stamp');
    const keep = prefix + value;
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name !== keep) await caches.delete(name);
    }
    return value;
  } catch (_) {
    return null;
  }
}

function pathOf(request) {
  return request.url.slice(self.registration.scope.length).split('?')[0];
}

function cacheable(request) {
  if (request.method !== 'GET' || request.headers.has('range')) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return false;
  const path = pathOf(request);
  return path !== '' && !neverCache.includes(path);
}

// version.json 每次带不同的 cachebuster 参数来取（package_info_plus 网页版），按参数比对永远对不上：
// 每次刷新都要走一趟网络，缓存里还越积越多。它每版构建只有一份，按路径比对就行。
const ignoreQuery = ['version.json'];

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode === 'navigate') {
    // 先确定版本记号再给页面：页面接着要的文件都按新记号判断，不会混进旧版。
    event.respondWith((async () => {
      const [page, value] = await Promise.all([fetch(request), refreshStamp()]);
      stamp = value;
      return page;
    })());
    return;
  }
  if (!cacheable(request)) return;
  event.respondWith((async () => {
    // SW 被浏览器停过又唤醒时 stamp 会丢：重新读一次。
    if (!stamp) stamp = await refreshStamp();
    if (!stamp) return fetch(request);
    const cache = await caches.open(prefix + stamp);
    const hit = await cache.match(request, { ignoreSearch: ignoreQuery.includes(pathOf(request)) });
    if (hit) return hit;
    const res = await fetch(request);
    if (res.ok && res.type === 'basic') cache.put(request, res.clone()).catch(() => {});
    return res;
  })());
});
