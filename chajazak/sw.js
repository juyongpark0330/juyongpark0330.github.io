/* 차자작 · CHAJAZAK — 오프라인 실행용 Service Worker
   앱 껍데기(HTML·매니페스트·아이콘)를 설치할 때 캐시해 두고,
   오프라인이거나 네트워크가 느릴 때도 캐시에서 바로 응답합니다. */
var CACHE = 'chajazak-v2';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // 개별 addAll 은 하나만 실패해도 전체가 실패하므로 항목별로 담습니다.
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE && key.indexOf('chajazak-') === 0) return caches.delete(key);
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  // 페이지 이동(새로 열기·새로고침): 캐시를 먼저 보여 주고, 뒤에서 최신본으로 갱신
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE).then(function (cache) {
        var network = fetch(request).then(function (response) {
          if (response && response.ok) cache.put('./index.html', response.clone());
          return response;
        }).catch(function () { return null; });

        return cache.match('./index.html').then(function (cached) {
          if (cached) return cached;
          return network.then(function (response) {
            return response || cache.match('./') || new Response(
              '<!doctype html><meta charset="utf-8"><title>차자작</title><p style="font:16px/1.6 sans-serif;padding:32px;text-align:center">오프라인 상태입니다. 한 번 접속한 뒤에는 인터넷 없이도 열립니다.</p>',
              { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        });
      })
    );
    return;
  }

  // 그 밖의 같은 사이트 자원: 캐시 우선, 없으면 네트워크 후 캐시에 저장
  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.ok && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); }).catch(function () {});
        }
        return response;
      }).catch(function () {
        return cached || Response.error();
      });
    })
  );
});
