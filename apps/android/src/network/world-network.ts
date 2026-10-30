// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo world's network client (#559, choice D8 of the 0.7.0 demo, answer
// 570), the only code of the app's that connects, on the phone and on a PC. It
// connects only while a world is open, and only to that world's paths on the
// demo server, or to start a world: the world's ID and its pass, worked out on
// the device from the code (#556), go with each request, and the code's secret
// never does. A request carries no cookie and is never cached or sent with a
// referrer; a redirect fails it where the platform's fetch can refuse one, and
// the demo server sends none; on the phone, React Native follows one itself,
// pass and all. It stops after TIMEOUT_MS, and an answer over MOST_ANSWER
// characters is refused. An answer that comes back after the world was left is
// dropped. The guard (guard.ts) refuses other connections. Errors carry a
// code: E_NO_WORLD outside a world or for another world's path, E_REFUSED from
// the guard (guard.ts), E_OFFLINE, E_TIMEOUT, or E_ANSWER for an answer that is
// not JSON or too long. A status the server answers, as 409 or 429, is the
// caller's to read.

export const DEMO_SERVER = 'https://minhajna-demo.djazair.dev';
export const TIMEOUT_MS = 20_000;
/** The longest answer, in characters: 128 batches in base64 fit with room to spare. */
export const MOST_ANSWER = 1024 * 1024;

const WORLD_ID = /^[0-9A-HJKMNP-TV-Z]{5}$/u;
const PASS = /^[A-Za-z0-9_-]{43}$/u;
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/u;
/** A world's path after its ID: plain segments, none of dots alone, and a plain query. */
const REST = /^(?:\/(?!\.+(?:[/?]|$))[A-Za-z0-9._~-]+)*(?:\?[A-Za-z0-9._~=&-]+)?$/u;

let open: WorldEntry | null = null;

function failed(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

/** Which entry into a world is open, for leaving only that one. */
export interface WorldEntry {
  readonly world: string;
  readonly pass: string;
}

/**
 * Opens the network to a world, with its pass, and answers the entry; another open world refuses it, and the same
 * one changes nothing.
 */
export function enterWorldNetwork(world: string, pass: string): WorldEntry {
  if (!WORLD_ID.test(world) || !PASS.test(pass)) throw failed('Not a world and its pass', 'E_NO_WORLD');
  if (open !== null && open.world !== world) throw failed('Another world is open', 'E_NO_WORLD');
  const entry = open?.pass === pass ? open : { world, pass };
  open = entry;
  return entry;
}

/** Shuts the network: no request goes, and no answer still on its way is read. */
export function leaveWorldNetwork(): void {
  open = null;
}

/** Shuts the network if this entry is still the open one, and leaves a later entry open. */
export function leaveWorldEntry(entry: WorldEntry): void {
  if (open === entry) open = null;
}

/** The world the network is open to, if any. */
export function worldNetworkOpen(): string | null {
  return open?.world ?? null;
}

export interface WorldRequest {
  readonly method: 'GET' | 'POST' | 'PUT';
  /** `/worlds` to start the open world, or `/worlds/<its ID>` and what follows. */
  readonly path: string;
  readonly body?: unknown;
  /** The starter token, for moving the world's date. */
  readonly starter?: string;
}

export interface WorldAnswer {
  readonly status: number;
  /** The answer's JSON, or null when it has none. */
  readonly body: unknown;
  /** Seconds to wait before sending again, when the server says. */
  readonly retryAfter: number | null;
}

type Fetch = (address: string, init: RequestInit) => Promise<Response>;

function headersFor(request: WorldRequest, pass: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (request.path !== '/worlds') headers['X-World-Pass'] = pass;
  if (request.body !== undefined) headers['Content-Type'] = 'application/json';
  if (request.starter !== undefined) {
    if (!TOKEN.test(request.starter)) throw failed('Not a starter token', 'E_NO_WORLD');
    headers.Authorization = `Bearer ${request.starter}`;
  }
  return headers;
}

/** Sends one request to the open world on the demo server. */
export async function worldRequest(request: WorldRequest, fetcher: Fetch = globalThis.fetch): Promise<WorldAnswer> {
  const held = open;
  if (held === null) throw failed('No world is open', 'E_NO_WORLD');
  const own = `/worlds/${held.world}`;
  const named = (request.body as { world?: unknown } | null | undefined)?.world;
  const starting = request.path === '/worlds' && request.method === 'POST' && named === held.world;
  const rest = request.path.startsWith(own) ? request.path.slice(own.length) : null;
  if (!starting && (rest === null || !REST.test(rest))) throw failed('Not this world’s path', 'E_NO_WORLD');
  const headers = headersFor(request, held.pass);
  const body = request.body === undefined ? undefined : JSON.stringify(request.body);
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
  let text: string;
  let response: Response;
  try {
    response = await fetcher(`${DEMO_SERVER}${request.path}`, {
      method: request.method,
      headers,
      body,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: control.signal,
    });
    const length = Number(response.headers.get('Content-Length') ?? '0');
    if (length > MOST_ANSWER) throw failed('The answer is too long', 'E_ANSWER');
    text = await response.text();
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === 'E_ANSWER' || code === 'E_REFUSED') throw error;
    throw control.signal.aborted
      ? failed('The server did not answer in time', 'E_TIMEOUT')
      : failed('Offline', 'E_OFFLINE');
  } finally {
    clearTimeout(timer);
  }
  if (open !== held) throw failed('The world was left', 'E_NO_WORLD');
  if (text.length > MOST_ANSWER) throw failed('The answer is too long', 'E_ANSWER');
  let parsed: unknown = null;
  try {
    if (text !== '') parsed = JSON.parse(text);
  } catch {
    throw failed('The answer is not JSON', 'E_ANSWER');
  }
  const wait = Number(response.headers.get('Retry-After') ?? 'NaN');
  return { status: response.status, body: parsed, retryAfter: Number.isSafeInteger(wait) && wait >= 0 ? wait : null };
}
