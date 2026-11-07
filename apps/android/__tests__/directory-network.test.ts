// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directory's client and the guard (answer 809): outside a world the guard
// lets only the directory's plain paths through, whatever an address hides, and
// keeps the rest of the server shut; the client sends what it is given and no
// cookie, cache or referrer, reads each status as its own error, and goes again
// calmly while the server wakes, for a time. No test connects: every request
// lands in a stand-in. The codes are made up.

import { DIRECTORY_PATH, mayConnect, type NetworkRules } from '../src/network/guard';
import {
  directoryGet,
  directoryPost,
  directoryPut,
  isEditCode,
  WAKE_MS,
  WAKE_WAIT_MS,
} from '../src/network/directory-network';
import { DEMO_SERVER, MOST_ANSWER, TIMEOUT_MS } from '../src/network/world-network';

const OUTSIDE: NetworkRules = { server: DEMO_SERVER, inWorld: () => false, own: null, others: false };

function answering(status: number, text = '{}', headers: Record<string, string> = {}) {
  const response = { status, text: () => Promise.resolve(text), headers: new Headers(headers) } as Response;
  return jest.fn((_address: string, _init: RequestInit) => Promise.resolve(response));
}

describe('the guard outside a world', () => {
  it('lets the directory through', () => {
    for (const path of [
      '/directory/reference',
      '/directory/reference/claimed',
      '/directory/schools/made-up_1/book',
      '/directory/schools/a+b/teachers/t1/code',
      '/directory/join',
    ]) {
      expect(mayConnect(`${DEMO_SERVER}${path}`, OUTSIDE)).toBe(true);
    }
    expect(mayConnect(` \t${DEMO_SERVER}/directory/join\n`, OUTSIDE)).toBe(true);
  });

  it('keeps the rest of the server shut, whatever an address hides', () => {
    for (const address of [
      `${DEMO_SERVER}/worlds/7K3QX`,
      `${DEMO_SERVER}/health`,
      `${DEMO_SERVER}/directory`,
      `${DEMO_SERVER}/directory/`,
      `${DEMO_SERVER}/directory//join`,
      `${DEMO_SERVER}/directory/../worlds/7K3QX`,
      `${DEMO_SERVER}/directory/./../health`,
      `${DEMO_SERVER}/directory/join/..`,
      `${DEMO_SERVER}/directory/..\\worlds`,
      `${DEMO_SERVER}/directory/\t../worlds`,
      `${DEMO_SERVER}/directory/%2e%2e/worlds`,
      `${DEMO_SERVER}/directory/join?to=x`,
      `${DEMO_SERVER}/directory/join#x`,
      `${DEMO_SERVER}.example.com/directory/join`,
      `${DEMO_SERVER}@example.com/directory/join`,
      `${DEMO_SERVER}:8443/directory/join`,
      'https://example.com/directory/join',
      '/directory/join',
    ]) {
      expect(mayConnect(address, OUTSIDE)).toBe(false);
    }
  });

  it('keeps the directory open while a world is open, and no other address', () => {
    const inside = { ...OUTSIDE, inWorld: () => true };
    expect(mayConnect(`${DEMO_SERVER}/directory/join`, inside)).toBe(true);
    expect(mayConnect('https://example.com/directory/join', inside)).toBe(false);
  });
});

describe('the directory client', () => {
  it('sends what it is given and nothing else', async () => {
    const fetcher = answering(200, '{"claimed":true}');
    const body = { code: 'MADE-UP-CODE' };
    await expect(directoryPost('/directory/join', body, undefined, { fetcher })).resolves.toEqual({ claimed: true });
    const [address, init] = fetcher.mock.calls[0];
    expect(address).toBe(`${DEMO_SERVER}/directory/join`);
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify(body),
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
    expect(init.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' });
  });

  it('carries an edit code as a bearer token, and a read carries no body', async () => {
    const fetcher = answering(200);
    await directoryGet('/directory/reference/state', 'made-up-code', { fetcher });
    const init = fetcher.mock.calls[0][1];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).toEqual({ Accept: 'application/json', Authorization: 'Bearer made-up-code' });
    await directoryPut('/directory/reference/draft', { expected: 1 }, 'made-up-code', { fetcher });
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'PUT', body: '{"expected":1}' });
  });

  it('reads each refusal as its own error', async () => {
    const seen: [number, string][] = [
      [401, 'E_DIRECTORY_REFUSED'],
      [403, 'E_DIRECTORY_REFUSED'],
      [404, 'E_DIRECTORY_MISSING'],
      [409, 'E_DIRECTORY_STALE'],
      [400, 'E_DIRECTORY_BAD'],
      [429, 'E_DIRECTORY_BUSY'],
      [413, 'E_DIRECTORY_FULL'],
      [507, 'E_DIRECTORY_FULL'],
      [500, 'E_DIRECTORY_NETWORK'],
      [302, 'E_DIRECTORY_NETWORK'],
    ];
    for (const [status, code] of seen) {
      await expect(directoryGet('/directory/reference', undefined, { fetcher: answering(status) })).rejects.toMatchObject(
        { code },
      );
    }
  });

  it('gives the server’s own sentence for a bad shape', async () => {
    const fetcher = answering(400, '{"statusCode":400,"message":"a level needs a code and options"}');
    await expect(directoryPut('/directory/reference/draft', {}, 'made-up-code', { fetcher })).rejects.toMatchObject({
      code: 'E_DIRECTORY_BAD',
      message: 'a level needs a code and options',
    });
    await expect(
      directoryPut('/directory/reference/draft', {}, 'made-up-code', { fetcher: answering(400, '<html>') }),
    ).rejects.toMatchObject({ code: 'E_DIRECTORY_BAD', message: 'The server would not read this' });
  });

  it('refuses what is not a directory path or an edit code, and sends nothing', async () => {
    const fetcher = answering(200);
    for (const path of ['/worlds/7K3QX', '/directory/../worlds', '/directory/a?b=c', 'https://example.com/']) {
      await expect(directoryGet(path, undefined, { fetcher })).rejects.toMatchObject({ code: 'E_DIRECTORY_MISSING' });
    }
    for (const code of ['short', 'with a space', 'x'.repeat(65), 'رمز-ليس-صالحا', 'made-up\ncode']) {
      await expect(directoryGet('/directory/reference/state', code, { fetcher })).rejects.toMatchObject({
        code: 'E_DIRECTORY_REFUSED',
      });
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(isEditCode('made-up-code')).toBe(true);
    expect(DIRECTORY_PATH.test('/directory/join')).toBe(true);
  });

  it('goes again while the server wakes, says so once, and answers when it has woken', async () => {
    const asleep = { status: 503, text: () => Promise.resolve('{}'), headers: new Headers({ 'Retry-After': '5' }) };
    const awake = { status: 200, text: () => Promise.resolve('{"format":1}'), headers: new Headers() };
    const fetcher = jest
      .fn<Promise<Response>, [string, RequestInit]>()
      .mockResolvedValueOnce(asleep as Response)
      .mockResolvedValueOnce(asleep as Response)
      .mockResolvedValueOnce(awake as Response);
    const onWaking = jest.fn();
    const wait = jest.fn(() => Promise.resolve());
    await expect(directoryGet('/directory/reference', undefined, { fetcher, onWaking, wait })).resolves.toEqual({
      format: 1,
    });
    expect(onWaking).toHaveBeenCalledTimes(1);
    expect(wait.mock.calls).toEqual([[5000], [5000]]);
  });

  it('stops trying once the server has slept past the time, and never waits past the calm wait', async () => {
    let clock = 0;
    const fetcher = answering(503, '{}', { 'Retry-After': '3600' });
    const wait = jest.fn((ms: number) => {
      clock += ms;
      return Promise.resolve();
    });
    await expect(
      directoryGet('/directory/reference', undefined, { fetcher, wait, now: () => clock }),
    ).rejects.toMatchObject({ code: 'E_DIRECTORY_WAKING' });
    expect(wait).toHaveBeenCalledWith(WAKE_WAIT_MS);
    expect(clock).toBeGreaterThanOrEqual(WAKE_MS);
    expect(clock).toBeLessThan(WAKE_MS + WAKE_WAIT_MS * 2);
  });

  it('reads no network, no answer in time, a long answer and a strange one as the network', async () => {
    const offline = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    await expect(directoryGet('/directory/reference', undefined, { fetcher: offline })).rejects.toMatchObject({
      code: 'E_DIRECTORY_NETWORK',
    });
    const long = answering(200, 'x'.repeat(MOST_ANSWER + 1));
    await expect(directoryGet('/directory/reference', undefined, { fetcher: long })).rejects.toMatchObject({
      code: 'E_DIRECTORY_NETWORK',
    });
    const told = answering(200, '{}', { 'Content-Length': String(MOST_ANSWER + 1) });
    await expect(directoryGet('/directory/reference', undefined, { fetcher: told })).rejects.toMatchObject({
      code: 'E_DIRECTORY_NETWORK',
    });
    const strange = answering(200, '<html>');
    await expect(directoryGet('/directory/reference', undefined, { fetcher: strange })).rejects.toMatchObject({
      code: 'E_DIRECTORY_NETWORK',
    });
    jest.useFakeTimers();
    try {
      const silent = (_address: string, init: RequestInit) =>
        new Promise<Response>((_done, fail) => {
          init.signal?.addEventListener('abort', () => fail(new Error('aborted')));
        });
      const late = directoryGet('/directory/reference', undefined, { fetcher: silent });
      const seen = expect(late).rejects.toMatchObject({ code: 'E_DIRECTORY_NETWORK', message: 'No answer in time' });
      await jest.advanceTimersByTimeAsync(TIMEOUT_MS);
      await seen;
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the guard’s own refusal', async () => {
    const guarded = jest.fn(() => Promise.reject(Object.assign(new TypeError('no'), { code: 'E_REFUSED' })));
    await expect(directoryGet('/directory/reference', undefined, { fetcher: guarded })).rejects.toMatchObject({
      code: 'E_REFUSED',
    });
  });
});
