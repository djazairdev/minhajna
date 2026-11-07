// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directory's network client (answers 802 to 809), the only code of the
// app's that calls the demo server's `/directory/` paths, on the phone and on a
// PC: the reference list that setup reads, the Ministry's and the school's
// pages on the dashboard, and joining a school with its code. It sends what its
// caller gives it and nothing else of the device's: an edit code, when the page
// holds one, goes as a bearer token and nowhere else; no world's pass goes with
// it. A request carries no cookie and is never cached or sent with a referrer;
// a redirect fails it where the platform's fetch can refuse one, and the demo
// server sends none; on the phone, React Native follows one itself. Each try
// stops after TIMEOUT_MS, and an answer over MOST_ANSWER characters is refused.
// The container sleeps, and the host answers 503 while it wakes, for about 45
// seconds; such an answer has done nothing, so the request goes again, calmly,
// and `onWaking` lets the page say so. Errors carry a code:
// E_DIRECTORY_REFUSED for a code the server refuses or that could not be sent,
// E_DIRECTORY_STALE when someone else saved first, E_DIRECTORY_MISSING for
// what does not exist or a path that cannot, E_DIRECTORY_WAKING when the server
// stayed asleep, E_DIRECTORY_BAD for what the server would not read, with the
// server's own sentence, E_DIRECTORY_BUSY past its limits, E_DIRECTORY_FULL
// past its caps, and E_DIRECTORY_NETWORK for all else: no network, no answer in
// time, or an answer that is not this server's. A request the guard refuses
// keeps E_REFUSED.

import { DIRECTORY_PATH } from './guard';
import { DEMO_SERVER, MOST_ANSWER, TIMEOUT_MS } from './world-network';

/** How long a request goes on trying while the server wakes. */
export const WAKE_MS = 75_000;
/** The calm wait between tries, unless the server names a shorter one. */
export const WAKE_WAIT_MS = 15_000;

const EDIT_CODE = /^[\x21-\x7E]{8,64}$/u;

type Fetch = (address: string, init: RequestInit) => Promise<Response>;

/** What a page may add to a request; a test gives its own fetch, wait and clock. */
export interface DirectoryOptions {
  /** Told once, when the server is found waking. */
  readonly onWaking?: () => void;
  readonly fetcher?: Fetch;
  readonly wait?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

function failed(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

/** Whether this can be an edit code: 8 to 64 printable ASCII characters, none a space, as a header can carry it. */
export function isEditCode(code: string): boolean {
  return EDIT_CODE.test(code);
}

function headersFor(body: unknown, code: string | undefined): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (code !== undefined) {
    if (!isEditCode(code)) throw failed('Not an edit code', 'E_DIRECTORY_REFUSED');
    headers.Authorization = `Bearer ${code}`;
  }
  return headers;
}

interface Answer {
  readonly status: number;
  readonly text: string;
  readonly retryAfter: number | null;
}

async function once(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: string | undefined,
  fetcher: Fetch,
): Promise<Answer> {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const response = await fetcher(`${DEMO_SERVER}${path}`, {
      method,
      headers,
      body,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: control.signal,
    });
    const length = Number(response.headers.get('Content-Length') ?? '0');
    if (length > MOST_ANSWER) throw failed('The answer is too long', 'E_DIRECTORY_NETWORK');
    const text = await response.text();
    if (text.length > MOST_ANSWER) throw failed('The answer is too long', 'E_DIRECTORY_NETWORK');
    const wait = Number(response.headers.get('Retry-After') ?? 'NaN');
    return { status: response.status, text, retryAfter: Number.isSafeInteger(wait) && wait >= 0 ? wait : null };
  } catch (error) {
    const known = (error as { code?: unknown } | null)?.code;
    if (known === 'E_REFUSED' || known === 'E_DIRECTORY_NETWORK') throw error;
    throw failed(control.signal.aborted ? 'No answer in time' : 'Offline', 'E_DIRECTORY_NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

function parsed(text: string): unknown {
  try {
    return text === '' ? null : (JSON.parse(text) as unknown);
  } catch {
    throw failed('The answer is not JSON', 'E_DIRECTORY_NETWORK');
  }
}

/** The server's sentence for a request it would not read, when it gives one. */
function sentence(text: string): string {
  try {
    const { message } = JSON.parse(text) as { message?: unknown };
    if (typeof message === 'string' && message !== '') return message;
  } catch {
    return 'The server would not read this';
  }
  return 'The server would not read this';
}

function refusalOf({ status, text }: Answer): Error {
  if (status === 401 || status === 403) return failed('The code was refused', 'E_DIRECTORY_REFUSED');
  if (status === 404) return failed('Not found', 'E_DIRECTORY_MISSING');
  if (status === 409) return failed('Someone else saved first', 'E_DIRECTORY_STALE');
  if (status === 400) return failed(sentence(text), 'E_DIRECTORY_BAD');
  if (status === 429) return failed('Too many requests for now', 'E_DIRECTORY_BUSY');
  if (status === 413 || status === 507) return failed('The directory has no room for this', 'E_DIRECTORY_FULL');
  return failed(`The server answered ${status}`, 'E_DIRECTORY_NETWORK');
}

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

async function request(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body: unknown,
  code: string | undefined,
  options: DirectoryOptions,
): Promise<unknown> {
  if (!DIRECTORY_PATH.test(path)) throw failed('Not a path of the directory', 'E_DIRECTORY_MISSING');
  const headers = headersFor(body, code);
  const text = body === undefined ? undefined : JSON.stringify(body);
  const { fetcher = globalThis.fetch, wait = sleep, now = Date.now, onWaking } = options;
  const until = now() + WAKE_MS;
  let told = false;
  for (;;) {
    const answer = await once(method, path, headers, text, fetcher);
    if (answer.status >= 200 && answer.status < 300) return parsed(answer.text);
    if (answer.status !== 503) throw refusalOf(answer);
    if (now() >= until) throw failed('The server is still waking', 'E_DIRECTORY_WAKING');
    if (!told) onWaking?.();
    told = true;
    const named = answer.retryAfter === null ? WAKE_WAIT_MS : answer.retryAfter * 1000;
    await wait(Math.min(Math.max(named, 1000), WAKE_WAIT_MS));
  }
}

/** Reads from the directory. */
export function directoryGet(path: string, code?: string, options: DirectoryOptions = {}): Promise<unknown> {
  return request('GET', path, undefined, code, options);
}

/** Posts to the directory: to claim, publish, renew or join. */
export function directoryPost(
  path: string,
  body: unknown,
  code?: string,
  options: DirectoryOptions = {},
): Promise<unknown> {
  return request('POST', path, body, code, options);
}

/** Saves to the directory, with the revision the page last read inside the body. */
export function directoryPut(
  path: string,
  body: unknown,
  code?: string,
  options: DirectoryOptions = {},
): Promise<unknown> {
  return request('PUT', path, body, code, options);
}
