// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The offline worker, run as it is in a made-up browser beside a made-up
// server, and a made-up build for it. Builds are made up.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

export const ORIGIN = 'https://pc.test/';
const code = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

const hex = (text: string) => createHash('sha256').update(text).digest('hex');

/** A made-up build: its files, build.json's text and its checksum. */
export function made(version: string, versionCode: number, notes: string[] = [], more: Record<string, string> = {}) {
  const files: Record<string, string> = {
    'index.html': `<!doctype html><title>${version}</title>`,
    'app.js': `console.log(${JSON.stringify(version)});`,
    'notes.json': JSON.stringify({ version, versionCode, ar: notes, fr: notes, en: notes }),
    ...more,
  };
  const hashes = Object.fromEntries(Object.entries(files).map(([name, body]) => [name, hex(body)]));
  const lines = Object.keys(hashes)
    .sort()
    .map((name) => `${hashes[name]}  ${name}\n`)
    .join('');
  const sha256 = hex(lines);
  return { files, sha256, json: JSON.stringify({ format: 2, version, versionCode, sha256, files: hashes }) };
}

type Listener = (event: object) => void;

export const POLICY = "default-src 'none'; script-src 'self'";

/** The worker in a fresh made-up browser, with the server's files and what reached the pages. */
export function browser() {
  const server = new Map<string, string>();
  const stores = new Map<string, Map<string, Response>>();
  const listeners = new Map<string, Listener>();
  const told: unknown[] = [];
  const caches = {
    keys: () => Promise.resolve([...stores.keys()]),
    has: (name: string) => Promise.resolve(stores.has(name)),
    open: (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return Promise.resolve({
        match: (url: string) => Promise.resolve(store.get(url)?.clone()),
        put: (url: string, response: Response) => {
          store.set(url, response);
          return Promise.resolve();
        },
      });
    },
    delete: (name: string) => Promise.resolve(stores.delete(name)),
  };
  const fetched: string[] = [];
  const requests: Request[] = [];
  const reachable = { online: true };
  const fetch = (request: Request) => {
    const path = request.url.replace(ORIGIN, '');
    fetched.push(path);
    requests.push(request);
    if (!reachable.online) return Promise.reject(new TypeError('Made-up offline'));
    const body = server.get(path);
    return Promise.resolve(
      body === undefined
        ? new Response(null, { status: 404 })
        : new Response(body, { headers: { 'Content-Security-Policy': POLICY, 'Content-Type': 'text/javascript' } }),
    );
  };
  const self = {
    registration: { scope: ORIGIN },
    location: new URL(ORIGIN),
    clients: { matchAll: () => Promise.resolve([{ postMessage: (message: unknown) => told.push(message) }]) },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  };
  runInNewContext(code, { self, caches, crypto, fetch, Request, Response, TextEncoder, URL });
  const serve = (build: ReturnType<typeof made>) => {
    server.clear();
    for (const [name, body] of Object.entries(build.files)) server.set(name, body);
    server.set('', build.files['index.html'] ?? '');
    server.set('build.json', build.json);
  };
  const install = async () => {
    const waits: Promise<unknown>[] = [];
    listeners.get('install')!({ waitUntil: (work: Promise<unknown>) => waits.push(work) });
    await Promise.all(waits);
  };
  const ask = async (data: object) => {
    const answers: { ok: boolean; value?: unknown; error?: string }[] = [];
    const waits: Promise<unknown>[] = [];
    const port = { postMessage: (answer: (typeof answers)[number]) => answers.push(answer) };
    listeners.get('message')!({ data, ports: [port], waitUntil: (work: Promise<unknown>) => waits.push(work) });
    await Promise.all(waits);
    return JSON.parse(JSON.stringify(answers[0])) as (typeof answers)[number];
  };
  const answer = async (path: string, mode = 'cors') => {
    let work: Promise<Response> | undefined;
    const request = Object.defineProperty(new Request(ORIGIN + path), 'mode', { value: mode });
    listeners.get('fetch')!({ request, respondWith: (one: Promise<Response>) => (work = one) });
    return work!;
  };
  const page = async (path: string) => (await answer(path)).text();
  return { server, stores, told, fetched, requests, reachable, serve, install, ask, page, answer };
}
