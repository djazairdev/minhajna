// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/* global self, caches, crypto, fetch, Request, Response, TextEncoder, URL */

// The web app's offline worker (#250, R-6.6-05, R-6.6-06, R-6.6-07). On install
// it reads build.json once, checks that its checksum is the one its files'
// hashes give, fetches every file it lists past the browser's HTTP cache, and
// checks each against its SHA-256 there: a checksum or a file that differs, or
// a page the server redirects, fails the install, so the cache never mixes two
// builds and holds the build its name says. The files go into one cache named
// after the build's checksum, build.json last, and the cache counts as
// installed only once build.json is in it. From then on the worker answers only
// from that cache: the app opens with no network and stays the build the
// teacher installed. The worker itself never changes between builds, so the
// browser never swaps it; a new build comes in only when the app asks for it,
// once the teacher accepts. Until an install has finished, the page's requests
// go to the server as usual. Nothing but the app's own files is fetched or
// kept.

const PREFIX = 'minhajna-web-';

/** A URL in the worker's own folder. */
const here = (path) => new URL(path, self.registration.scope).href;

/** Lowercase hex of the SHA-256 of the bytes. */
async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The build's checksum from its files' hashes, as scripts/build.ts makes it:
 * the SHA-256 of `hash  name` lines, sorted by name.
 */
async function checksum(files) {
  const lines = Object.keys(files)
    .sort()
    .map((name) => `${files[name]}  ${name}\n`)
    .join('');
  return sha256(new TextEncoder().encode(lines));
}

/** The file at `path` from the server, checked against its hash, as a response to keep. */
async function checked(path, hash) {
  const response = await fetch(new Request(here(path), { cache: 'reload', redirect: 'error' }));
  if (!response.ok) throw new Error(`No ${path}`);
  const bytes = await response.arrayBuffer();
  if ((await sha256(bytes)) !== hash) throw new Error(`${path} is not the build's`);
  return new Response(bytes, { headers: { 'Content-Type': response.headers.get('Content-Type') ?? '' } });
}

/**
 * The installed build's cache, or null before an install has finished. A
 * cache counts once it holds build.json, which goes in last.
 */
async function installed() {
  for (const name of await caches.keys()) {
    if (!name.startsWith(PREFIX)) continue;
    const cache = await caches.open(name);
    if ((await cache.match(here('./build.json'))) !== undefined) return cache;
  }
  return null;
}

async function install() {
  if ((await installed()) !== null) return;
  const left = (await caches.keys()).filter((name) => name.startsWith(PREFIX));
  await Promise.all(left.map((name) => caches.delete(name)));
  const response = await fetch(new Request(here('./build.json'), { cache: 'no-store', redirect: 'error' }));
  if (!response.ok) throw new Error('No build.json');
  const text = await response.text();
  const build = JSON.parse(text);
  if (build.format !== 2 || (await checksum(build.files)) !== build.sha256) throw new Error('Not this build');
  const paths = Object.keys(build.files).filter((path) => path !== 'sw.js');
  const kept = await Promise.all(paths.map((path) => checked(`./${path}`, build.files[path])));
  const page = await checked('./', build.files['index.html']);
  const cache = await caches.open(PREFIX + build.sha256);
  await Promise.all(paths.map((path, index) => cache.put(here(`./${path}`), kept[index])));
  await cache.put(here('./'), page);
  await cache.put(here('./build.json'), new Response(text, { headers: { 'Content-Type': 'application/json' } }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(install());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const target = event.request.mode === 'navigate' ? here('./') : url.href;
  event.respondWith(
    installed().then(async (cache) => {
      if (cache === null) return fetch(event.request);
      return (await cache.match(target)) ?? new Response(null, { status: 404 });
    }),
  );
});
