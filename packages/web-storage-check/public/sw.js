// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/* global self, caches, fetch, URL */

// Cache this diagnostic's static assets only. Results and keys are never sent.
// No skipWaiting: a newly built worker waits for the old windows to close.

import { assets, version } from './assets.js';

const prefix = 'minhajna-storage-check-';
const cacheName = prefix + version;
const allowed = new Set(assets.map((path) => new URL(path, self.registration.scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((name) => name.startsWith(prefix) && name !== cacheName).map((name) => caches.delete(name)),
        ),
      ),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const target = event.request.mode === 'navigate' ? new URL('./index.html', self.registration.scope).href : url.href;
  if (!allowed.has(target)) return;
  event.respondWith(caches.open(cacheName).then(async (cache) => (await cache.match(target)) ?? fetch(target)));
});
