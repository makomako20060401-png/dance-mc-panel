// オフライン対応用 Service Worker（ビルド時に vite.config.ts がファイル一覧とバージョンを埋め込む）
// - インストール時にアプリの全ファイルを先に保存するので、一度開けば電波がなくても起動できる
// - 画面（index.html）はまず保存済みのものを即表示し、裏で最新版を取得する
//   → 会場の弱い電波で起動が待たされない。更新は次回起動時に反映される
const CACHE = 'dance-mc-panel-__VERSION__';
const ASSETS = __ASSETS__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dance-mc-panel-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match('./index.html', { ignoreVary: true });
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put('./index.html', res.clone());
            return res;
          })
          .catch(() => null);
        if (cached) {
          event.waitUntil(network);
          return cached;
        }
        return (await network) || new Response('オフラインです', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }),
    );
    return;
  }

  // ファイル名にハッシュが付いているので保存済みを優先してよい。
  // ignoreVary: ホスティングによっては Vary: Origin などが付き、保存済みと一致しなくなるため
  event.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
