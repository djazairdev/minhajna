// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The network on the phone (#559, answer 570): the guard the app sets as it
// starts refuses every connection outside a demo world, and every address but
// the demo server inside one, through fetch, XMLHttpRequest and WebSocket
// alike, whatever the address hides; the world's client sends only to the open
// world's paths, with its pass and nothing else of the device's, and refuses
// what comes back too late, too long or not as JSON, or after the world was
// left; entering the same world again keeps what is on its way, and leaving
// by a stale entry leaves a later one open. No test connects: every request
// lands in a stand-in. The worlds and passes are made up.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REFUSED } from '../src/network/guard';
import { installNetworkGuard } from '../src/network/install';
import {
  DEMO_SERVER,
  enterWorldNetwork,
  leaveWorldEntry,
  leaveWorldNetwork,
  MOST_ANSWER,
  TIMEOUT_MS,
  worldNetworkOpen,
  worldRequest,
} from '../src/network/world-network';

const PASS = 'pAss-made_up'.padEnd(43, 'x');
const sent: string[] = [];

class Xhr {
  open(_method: string, address: string) {
    sent.push(`xhr ${address}`);
  }
}
class Socket {
  constructor(address: string) {
    sent.push(`ws ${address}`);
  }
}

Object.assign(globalThis, {
  fetch: (address: string | Request) => {
    sent.push(`fetch ${typeof address === 'string' ? address : address.url}`);
    return Promise.resolve(new Response('{}'));
  },
  XMLHttpRequest: Xhr,
  WebSocket: Socket,
});
installNetworkGuard(null, false);

/** Which of fetch, XMLHttpRequest and WebSocket refuse the address. */
async function tryAll(address: string): Promise<string[]> {
  const refused: string[] = [];
  await globalThis.fetch(address).catch(() => refused.push('fetch'));
  try {
    new XMLHttpRequest().open('GET', address);
  } catch {
    refused.push('xhr');
  }
  try {
    new WebSocket(address);
  } catch {
    refused.push('ws');
  }
  return refused;
}

afterEach(() => {
  leaveWorldNetwork();
  sent.length = 0;
  jest.useRealTimers();
});

describe('the guard on the phone', () => {
  it('is set by the app’s first import, Metro kept in debug builds only', () => {
    const read = (...path: string[]) => readFileSync(join(__dirname, '..', ...path), 'utf8');
    expect(read('index.js').match(/^import .*$/mu)?.[0]).toBe("import './src/network/phone-guard';");
    expect(read('src', 'network', 'phone-guard.ts')).toContain('\nguardPhone();\n');
    expect(read('src', 'network', 'install.ts')).toContain('installNetworkGuard(null, __DEV__);');
  });

  it('opens no connection outside a world, to the demo server or anywhere', async () => {
    for (const address of [
      `${DEMO_SERVER}/worlds/7K3QX`,
      'https://example.com/',
      '/build.json',
      'http://10.0.2.2:8081/',
    ]) {
      expect(await tryAll(address)).toEqual(['fetch', 'xhr', 'ws']);
    }
    expect(sent).toEqual([]);
    await expect(globalThis.fetch(`${DEMO_SERVER}/health`)).rejects.toMatchObject({
      code: 'E_REFUSED',
      message: REFUSED,
    });
  });

  it('checks a Request, a URL or any other input by the very address it hands on', async () => {
    enterWorldNetwork('7K3QX', PASS);
    const own = `${DEMO_SERVER}/worlds/7K3QX`;
    await globalThis.fetch(new Request(own));
    await expect(globalThis.fetch(new Request('https://example.com/'))).rejects.toMatchObject({ code: 'E_REFUSED' });
    await globalThis.fetch(new URL(`${own}/date`) as never);
    let reads = 0;
    const shifty = { toString: () => (reads++ === 0 ? own : 'https://example.com/') };
    for (const send of [
      () => globalThis.fetch(shifty as never),
      () => new XMLHttpRequest().open('GET', shifty as never),
      () => new WebSocket(shifty as never),
    ]) {
      reads = 0;
      await Promise.resolve(send());
    }
    expect(sent).toEqual([`fetch ${own}`, `fetch ${own}/date`, `fetch ${own}`, `xhr ${own}`, `ws ${own}`]);
    expect(await tryAll(`${DEMO_SERVER.toUpperCase()}/worlds/7K3QX`)).toEqual(['fetch', 'xhr', 'ws']);
  });

  it('lets only the demo server through inside a world, whatever an address hides', async () => {
    enterWorldNetwork('7K3QX', PASS);
    expect(await tryAll(`${DEMO_SERVER}/worlds/7K3QX`)).toEqual([]);
    expect(await tryAll(` \t${DEMO_SERVER}/worlds/7K3QX\n`)).toEqual([]);
    for (const address of [
      `${DEMO_SERVER}.example.com/`,
      `${DEMO_SERVER}@example.com/`,
      `${DEMO_SERVER}:8443/`,
      DEMO_SERVER,
      'https://example.com/',
      '//example.com/',
      '/\\example.com/',
      'blob-like://x',
    ]) {
      expect(await tryAll(address)).toEqual(['fetch', 'xhr', 'ws']);
    }
    expect(sent.filter((one) => !one.includes('7K3QX'))).toEqual([]);
    leaveWorldNetwork();
    expect(await tryAll(`${DEMO_SERVER}/worlds/7K3QX`)).toEqual(['fetch', 'xhr', 'ws']);
  });
});

type Init = RequestInit & { headers: Record<string, string> };

function answering(text: string, headers: Record<string, string> = {}, status = 200) {
  const calls: { address: string; init: Init }[] = [];
  const fetcher = (address: string, init: RequestInit) => {
    calls.push({ address, init: init as Init });
    return Promise.resolve(new Response(text === '' ? null : text, { status, headers }));
  };
  return { calls, fetcher };
}

describe('the world’s client', () => {
  it('sends nothing outside a world, or to another world’s path', async () => {
    const { calls, fetcher } = answering('{}');
    await expect(worldRequest({ method: 'GET', path: '/worlds/7K3QX' }, fetcher)).rejects.toMatchObject({
      code: 'E_NO_WORLD',
    });
    expect(() => enterWorldNetwork('7K3QX', 'short')).toThrow();
    enterWorldNetwork('7K3QX', PASS);
    expect(() => enterWorldNetwork('M2ND9', PASS)).toThrow('Another world');
    for (const path of ['/worlds/M2ND9', '/worlds/7K3QX/../M2ND9', '/worlds/7K3QXY', '/health', '/worlds/7K3QX/%2e']) {
      await expect(worldRequest({ method: 'GET', path }, fetcher)).rejects.toMatchObject({ code: 'E_NO_WORLD' });
    }
    const other = { world: 'M2ND9', sealed: 'AA' };
    await expect(worldRequest({ method: 'POST', path: '/worlds', body: other }, fetcher)).rejects.toMatchObject({
      code: 'E_NO_WORLD',
    });
    expect(calls).toEqual([]);
  });

  it('sends the world’s pass and nothing else of the device’s, and reads the answer', async () => {
    enterWorldNetwork('7K3QX', PASS);
    const { calls, fetcher } = answering('{"added":2}', { 'Retry-After': '30' }, 201);
    const answer = await worldRequest(
      { method: 'POST', path: '/worlds/7K3QX/spaces/s1/batches', body: { stream: 'a', first: 0, batches: [] } },
      fetcher,
    );
    expect(answer).toEqual({ status: 201, body: { added: 2 }, retryAfter: 30 });
    const [{ address, init }] = calls;
    expect(address).toBe(`${DEMO_SERVER}/worlds/7K3QX/spaces/s1/batches`);
    expect(init.headers).toEqual({
      Accept: 'application/json',
      'X-World-Pass': PASS,
      'Content-Type': 'application/json',
    });
    expect(init).toMatchObject({
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });

    calls.length = 0;
    await worldRequest({ method: 'POST', path: '/worlds', body: { world: '7K3QX', pass: PASS } }, fetcher);
    expect(calls[0]?.init.headers['X-World-Pass']).toBeUndefined();
    const starter = 'starter-token-made-up-0001';
    await worldRequest({ method: 'POST', path: '/worlds/7K3QX/date', starter }, fetcher);
    expect(calls[1]?.init.headers.Authorization).toBe(`Bearer ${starter}`);
    await expect(
      worldRequest({ method: 'POST', path: '/worlds/7K3QX/date', starter: 'a b' }, fetcher),
    ).rejects.toMatchObject({ code: 'E_NO_WORLD' });
  });

  it('refuses an answer that is late, too long, not JSON, or comes after the world was left', async () => {
    enterWorldNetwork('7K3QX', PASS);
    const get = { method: 'GET', path: '/worlds/7K3QX/date' } as const;
    const offline = () => Promise.reject(new TypeError('Network request failed'));
    await expect(worldRequest(get, offline)).rejects.toMatchObject({ code: 'E_OFFLINE' });
    await expect(worldRequest(get, answering('not json').fetcher)).rejects.toMatchObject({ code: 'E_ANSWER' });
    const long = 'x'.repeat(MOST_ANSWER + 1);
    await expect(worldRequest(get, answering(`"${long}"`).fetcher)).rejects.toMatchObject({ code: 'E_ANSWER' });
    const said = answering('{}', { 'Content-Length': String(MOST_ANSWER + 1) }).fetcher;
    await expect(worldRequest(get, said)).rejects.toMatchObject({ code: 'E_ANSWER' });
    expect(await worldRequest(get, answering('', {}, 204).fetcher)).toEqual({
      status: 204,
      body: null,
      retryAfter: null,
    });

    let release: () => void = () => undefined;
    const slow = () => new Promise<Response>((resolve) => (release = () => resolve(new Response('{}'))));
    const leaving = worldRequest(get, slow);
    leaveWorldNetwork();
    enterWorldNetwork('7K3QX', PASS);
    release();
    await expect(leaving).rejects.toMatchObject({ code: 'E_NO_WORLD' });

    const refused = () => Promise.reject(Object.assign(new TypeError(REFUSED), { code: 'E_REFUSED' }));
    await expect(worldRequest(get, refused)).rejects.toMatchObject({ code: 'E_REFUSED' });
    const again = worldRequest(get, slow);
    enterWorldNetwork('7K3QX', PASS);
    release();
    expect(await again).toEqual({ status: 200, body: {}, retryAfter: null });

    jest.useFakeTimers();
    const hanging = (_: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) =>
        init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
      );
    const waiting = worldRequest(get, hanging);
    jest.advanceTimersByTime(TIMEOUT_MS);
    await expect(waiting).rejects.toMatchObject({ code: 'E_TIMEOUT' });
  });

  it('leaves by an entry only while that entry is the open one', () => {
    const first = enterWorldNetwork('7K3QX', PASS);
    expect(enterWorldNetwork('7K3QX', PASS)).toBe(first);
    leaveWorldNetwork();
    const second = enterWorldNetwork('7K3QX', PASS);
    expect(second).not.toBe(first);
    leaveWorldEntry(first);
    expect(worldNetworkOpen()).toBe('7K3QX');
    leaveWorldEntry(second);
    expect(worldNetworkOpen()).toBeNull();
  });
});
