// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Checks the demo server once it is deployed (#517): `node
// apps/server/host/check.ts <address> <version> [seconds]`, asking again for
// that many seconds while a first address gets its certificate, a rollout ends
// or the container wakes. /health must answer the version and nothing else; the
// directory must be reachable, as the Worker hands on only the paths it names;
// no answer may carry a header outside HEADERS, which holds what the server and
// Cloudflare send, so none says what the server is built with, sets a cookie or
// has the browser report to anyone; plain HTTP must go to HTTPS, but on this
// computer; the web app's addresses must be allowed to call the server, without
// credentials, and a page elsewhere refused. It uses Node's built-ins alone, so
// a deploy job runs it with no install. Prints each problem; exits 1 if there
// are.

import { realpathSync } from 'node:fs';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

/** The web app's public addresses, as src/cors.ts names them; a test keeps them equal. */
export const WEB_APPS = ['https://minhajna.djazair.dev', 'https://minhajna-test.djazair.dev'];

const ELSEWHERE = 'https://not-the-web-app.example';
const LOCAL = ['127.0.0.1', 'localhost', '[::1]'];
const ASK_EVERY_MS = 15_000;
const ANSWER_MS = 30_000;

/** The only headers an answer may carry, in lower case. */
const HEADERS = new Set([
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-allow-origin',
  'access-control-expose-headers',
  'access-control-max-age',
  'alt-svc',
  'cache-control',
  'cf-cache-status',
  'cf-ray',
  'connection',
  'content-encoding',
  'content-length',
  'content-type',
  'date',
  'keep-alive',
  'location',
  'retry-after',
  'server',
  'server-timing',
  'speculation-rules',
  'strict-transport-security',
  'transfer-encoding',
  'vary',
]);

/** Cloudflare's own Server-Timing entries, which say nothing of the server behind it. */
const CLOUDFLARE_TIMING = /^cf[A-Za-z0-9]*(?:;[^,]*)?(?:,\s*cf[A-Za-z0-9]*(?:;[^,]*)?)*$/u;

/** Where Cloudflare's Speed Brain points a browser: its own file, which says nothing of the server behind it. */
const CLOUDFLARE_SPECULATION = '"/cdn-cgi/speculation"';

/** What an answer's headers say that they should not. */
function leaks(label: string, headers: Headers): string[] {
  const problems: string[] = [];
  for (const [name, value] of headers) {
    if (!HEADERS.has(name)) problems.push(`${label}: sends ${name}`);
    if (name === 'server' && value !== 'cloudflare') problems.push(`${label}: its server is ${value}`);
    if (name === 'cf-cache-status' && value !== 'DYNAMIC') problems.push(`${label}: its cache status is ${value}`);
    if (name === 'server-timing' && !CLOUDFLARE_TIMING.test(value)) problems.push(`${label}: its timing is ${value}`);
    if (name === 'speculation-rules' && value !== CLOUDFLARE_SPECULATION) {
      problems.push(`${label}: its speculation rules are at ${value}`);
    }
  }
  return problems;
}

/** One request, followed nowhere and given a limit, its body read. */
async function ask(address: URL, init: RequestInit = {}): Promise<{ answer: Response; body: string }> {
  const answer = await fetch(address, { ...init, redirect: 'manual', signal: AbortSignal.timeout(ANSWER_MS) });
  return { answer, body: await answer.text() };
}

/** Asks whether one page may call the server, as a browser asks before a world's requests. */
function preflight(base: URL, origin: string): Promise<{ answer: Response }> {
  return ask(new URL('worlds', base), {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-world-pass',
    },
  });
}

/** What is wrong with the answer to plain HTTP, none when it goes to the same address over HTTPS. */
export function plainProblems(answer: Response, base: URL): string[] {
  const problems = leaks('plain HTTP', answer.headers);
  const location = URL.parse(answer.headers.get('location') ?? '');
  if (![301, 308].includes(answer.status) || location?.protocol !== 'https:' || location.host !== base.host) {
    problems.push('plain HTTP does not go to HTTPS');
  }
  return problems;
}

/** The problems with what `address` answers, none when the demo server stands as it should. */
export async function checkServer(address: string, version: string, webApps = WEB_APPS): Promise<string[]> {
  const base = new URL(address.endsWith('/') ? address : `${address}/`);
  const local = LOCAL.includes(base.hostname);
  if (base.protocol !== 'https:' && !(local && base.protocol === 'http:')) return [`${base.href} is not HTTPS`];
  const problems: string[] = [];
  const health = await ask(new URL('health', base));
  if (health.answer.status !== 200) return [`/health: status ${health.answer.status}`];
  problems.push(...leaks('/health', health.answer.headers));
  if (health.body !== JSON.stringify({ version })) {
    problems.push(`/health: answers ${health.body}, not the version ${version}`);
  }
  const missing = await ask(new URL('worlds/not/a/path/here', base));
  if (missing.answer.status !== 404) problems.push(`a path the server lacks: status ${missing.answer.status}, not 404`);
  problems.push(...leaks('a path the server lacks', missing.answer.headers));
  const directory = await ask(new URL('directory/reference/claimed', base));
  if (directory.answer.status !== 200) problems.push(`the directory: status ${directory.answer.status}, not 200`);
  if (directory.answer.headers.get('cache-control') !== 'no-store')
    problems.push('the directory: its answer may be kept');
  problems.push(...leaks('the directory', directory.answer.headers));
  if (!local) {
    const plain = new URL('health', base);
    plain.protocol = 'http:';
    problems.push(...plainProblems((await ask(plain)).answer, base));
  }
  for (const origin of webApps) {
    const asked = (await preflight(base, origin)).answer;
    if (asked.status !== 204) problems.push(`${origin}: the preflight's status is ${asked.status}, not 204`);
    if (asked.headers.get('access-control-allow-origin') !== origin) {
      problems.push(`${origin}: may not call the server`);
    }
    problems.push(...leaks(`${origin}'s preflight`, asked.headers));
    const read = (await ask(new URL('health', base), { headers: { Origin: origin } })).answer;
    if (read.headers.get('access-control-allow-origin') !== origin) problems.push(`${origin}: may not read an answer`);
    problems.push(...leaks(`${origin}'s answer`, read.headers));
  }
  const refused = (await preflight(base, ELSEWHERE)).answer;
  if (refused.status !== 403) problems.push(`a page elsewhere: the preflight's status is ${refused.status}, not 403`);
  if (refused.headers.has('access-control-allow-origin')) problems.push('a page elsewhere may call the server');
  problems.push(...leaks('a page elsewhere', refused.headers));
  return problems;
}

/** Asks until the server stands as it should or `seconds` have passed, and answers the last problems. */
export async function waitForServer(address: string, version: string, seconds: number): Promise<string[]> {
  const deadline = Date.now() + seconds * 1000;
  for (;;) {
    const problems = await checkServer(address, version).catch((error: unknown) => [`${address}: ${String(error)}`]);
    if (problems.length === 0 || Date.now() >= deadline) return problems;
    await sleep(ASK_EVERY_MS);
  }
}

if (process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const [address, version, seconds = '0'] = process.argv.slice(2);
  if (address === undefined || version === undefined || !/^\d+$/u.test(seconds)) {
    process.stderr.write('usage: node apps/server/host/check.ts <address> <version> [seconds]\n');
    process.exit(2);
  }
  const problems = await waitForServer(address, version, Number(seconds));
  for (const problem of problems) process.stdout.write(`${problem}\n`);
  process.stdout.write(problems.length === 0 ? `${address}: serves ${version}\n` : `problems: ${problems.length}\n`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}
