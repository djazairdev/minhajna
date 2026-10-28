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
// once the teacher accepts (answers 516 and 517). A build's version and
// version code are taken from its notes.json, which its checksum covers and
// which must name the ones build.json gives, from the first install on. The
// app asks the worker two things, by message:
// `check`, the build on the server with its notes, checked as an install
// checks them, and whether it is newer than the installed one; and `update`,
// which installs the server's build only if its checksum is the one the
// teacher saw and it is newer, into a cache of its own beside the current
// one, which goes only once the new one is whole, and then tells every page
// of the app to reload. A second `update` waits for the first only when it
// asks for the same build. Until an install has finished, the page's requests
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

/** The server's build.json, as text and read, once its checksum is the one its files' hashes give. */
async function served() {
  const response = await fetch(new Request(here('./build.json'), { cache: 'no-store', redirect: 'error' }));
  if (!response.ok) throw new Error('No build.json');
  const text = await response.text();
  const build = JSON.parse(text);
  if (build.format !== 2 || (await checksum(build.files)) !== build.sha256) throw new Error('Not this build');
  return { text, build };
}

/**
 * The installed build's cache name, or null before an install has finished.
 * A cache counts once it holds build.json, which goes in last; while an
 * update fills its own, the one made first still answers.
 */
async function installedName() {
  for (const name of await caches.keys()) {
    if (!name.startsWith(PREFIX)) continue;
    const cache = await caches.open(name);
    if ((await cache.match(here('./build.json'))) !== undefined) return name;
  }
  return null;
}

async function installed() {
  const name = await installedName();
  return name === null ? null : caches.open(name);
}

/** Fetches and checks every file of `build`, then keeps them in its own cache, build.json last. */
async function fill({ text, build }) {
  const paths = Object.keys(build.files).filter((path) => path !== 'sw.js');
  const kept = await Promise.all(paths.map((path) => checked(`./${path}`, build.files[path])));
  const page = await checked('./', build.files['index.html']);
  const cache = await caches.open(PREFIX + build.sha256);
  await Promise.all(paths.map((path, index) => cache.put(here(`./${path}`), kept[index])));
  await cache.put(here('./'), page);
  await cache.put(here('./build.json'), new Response(text, { headers: { 'Content-Type': 'application/json' } }));
}

/** Deletes the app's caches but `keep`. */
async function dropAllBut(keep) {
  const names = (await caches.keys()).filter((name) => name.startsWith(PREFIX) && name !== keep);
  await Promise.all(names.map((name) => caches.delete(name)));
}

async function install() {
  if ((await installed()) !== null) return;
  await dropAllBut(null);
  await fill(await checkedBuild());
}

/** A build's notes, which its checksum covers, once they name the version build.json gives. */
async function notesOf(response, build) {
  const notes = JSON.parse(await response.text());
  if (notes.version !== build.version || notes.versionCode !== build.versionCode) {
    throw new Error('The notes name another version');
  }
  return notes;
}

/** The version code in the kept notes of the cache `name`, or -1 when it has none. */
async function codeOf(name) {
  const kept = name === null ? undefined : await (await caches.open(name)).match(here('./notes.json'));
  if (kept === undefined) return -1;
  const code = JSON.parse(await kept.text()).versionCode;
  return Number.isSafeInteger(code) ? code : -1;
}

/** The installed build's version code, from its kept notes, or -1 when it has none. */
async function installedCode() {
  return codeOf(await installedName());
}

/** The server's build, checked, with its notes. */
async function checkedBuild() {
  const fresh = await served();
  const hash = fresh.build.files['notes.json'];
  if (hash === undefined) throw new Error('No notes.json');
  return { ...fresh, notes: await notesOf(await checked('./notes.json', hash), fresh.build) };
}

/** The server's build, its notes, and whether it is newer than the installed one, for the app to offer. */
async function check() {
  const { build, notes } = await checkedBuild();
  return {
    version: notes.version,
    versionCode: notes.versionCode,
    sha256: build.sha256,
    notes,
    newer: notes.versionCode > (await installedCode()),
  };
}

/** Whether the cache `name` holds a whole build. */
async function whole(name) {
  return (await caches.has(name)) && (await (await caches.open(name)).match(here('./build.json'))) !== undefined;
}

/** Tells every page of the app that a new build answers now. */
async function tell() {
  for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage({ kind: 'updated' });
}

let updating = null;

/** Installs the server's build if it is the one of `sha256` and newer, then drops the one it replaces. */
async function update(wanted) {
  const current = await installedName();
  if (current === PREFIX + wanted) return;
  if (await whole(PREFIX + wanted)) {
    if ((await codeOf(PREFIX + wanted)) > (await installedCode())) {
      if (current !== null) await caches.delete(current);
      await tell();
      return;
    }
    await caches.delete(PREFIX + wanted);
  }
  const fresh = await checkedBuild();
  if (fresh.build.sha256 !== wanted) throw new Error('The server holds another build');
  if (fresh.notes.versionCode <= (await installedCode())) throw new Error('Not a newer build');
  await dropAllBut(current);
  await fill(fresh);
  if (current !== null) await caches.delete(current);
  await tell();
}

self.addEventListener('install', (event) => {
  event.waitUntil(install());
});

self.addEventListener('message', (event) => {
  const port = event.ports[0];
  const kind = event.data?.kind;
  if (port === undefined || (kind !== 'check' && kind !== 'update')) return;
  const wanted = String(event.data.sha256);
  if (kind === 'update' && updating === null) {
    const work = update(wanted).finally(() => {
      updating = null;
    });
    updating = { wanted, work };
  }
  const work =
    kind === 'check'
      ? check()
      : updating.wanted === wanted
        ? updating.work
        : Promise.reject(new Error('Another update is running'));
  event.waitUntil(
    work.then(
      (value) => port.postMessage({ ok: true, value: value ?? null }),
      (error) => port.postMessage({ ok: false, error: String(error?.message ?? error) }),
    ),
  );
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
