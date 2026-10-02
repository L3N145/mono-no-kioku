const CACHE_NAME = 'mono-no-kioku-vault-v3';

// アプリ起動に必要なコアファイル
const SHELL_FILES = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. 同一オリジン（アプリ本体のHTML/JS）
  const isAppShell = url.origin === self.location.origin;
  // 2. AI推論エンジンおよびWebAssemblyファイル（cdn.jsdelivr.net）
  const isJsDelivr = url.origin === 'https://cdn.jsdelivr.net';

  // HuggingFaceのモデル自体はTransformers.js内部の専用CacheStorageに保存されるため除外
  if (!isAppShell && !isJsDelivr) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 端末内にキャッシュがあれば最優先でそれを返す（機内モードでも即起動）
      if (cachedResponse) {
        return cachedResponse;
      }

      // キャッシュにない場合はネットワークから取得し、次回のためにキャッシュへ保存
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
