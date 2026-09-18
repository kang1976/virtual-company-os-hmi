'use strict';
// Design Ref: docs/02-design/design.md §6 — 정적 자원만 캐시, /api/*는 절대 캐시하지 않음(오조작 방지)

const CACHE_NAME = 'plc-control-static-v28'; // 화면에 버전 표시(앱바·로그인·설정) — JS·SW 캐시 버전 상시 확인
const STATIC_ASSETS = ['/', '/index.html', '/app.js', '/style.css', '/manifest.json', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // API 요청(로그인 상태, 태그 값, 명령 등)은 항상 네트워크로 — 캐시된 낡은 상태를 보여주면 오조작 위험
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
