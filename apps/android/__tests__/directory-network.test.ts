// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directory's client (answer 809): it sends what it is given and no cookie,
// cache or referrer, reads each status as its own error, and goes again calmly
// while the server wakes, for a time; a read or a join goes again after no
// answer in time, and a save never does. No test connects: every request lands
// in a stand-in. The codes are made up.

import { DIRECTORY_PATH } from '../src/network/guard';
import {
  directoryGet,
  directoryPost,
  directoryPut,
  isEditCode,
  MOST_DIRECTORY_ANSWER,
  WAKE_MS,
  WAKE_WAIT_MS,
} from '../src/network/directory-network';
import { DEMO_SERVER, MOST_ANSWER, TIMEOUT_MS } from '../src/network/world-network';

function answering(status: number, text = '{}', headers: Record<string, string> = {}) {
  const response = { status, text: () => Promise.resolve(text), headers: new Headers(headers) } as Response;
  return jest.fn<Promise<Response>, [string, RequestInit]>(() => Promise.resolve(response));
}

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
      const fetcher = answering(status);
      await expect(directoryGet('/directory/reference', undefined, { fetcher })).rejects.toMatchObject({ code });
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
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('sends a save again as it was, and tells nothing when the server was awake', async () => {
    const asleep = { status: 503, text: () => Promise.resolve('{}'), headers: new Headers() };
    const saved = { status: 200, text: () => Promise.resolve('{"revision":2}'), headers: new Headers() };
    const fetcher = jest
      .fn<Promise<Response>, [string, RequestInit]>()
      .mockResolvedValueOnce(asleep as Response)
      .mockResolvedValueOnce(saved as Response);
    const wait = jest.fn(() => Promise.resolve());
    await directoryPut('/directory/reference/draft', { expected: 1 }, 'made-up-code', { fetcher, wait });
    expect(wait.mock.calls).toEqual([[WAKE_WAIT_MS]]);
    expect(fetcher.mock.calls[1][1].body).toBe(fetcher.mock.calls[0][1].body);
    expect(fetcher.mock.calls[1][1].headers).toEqual(fetcher.mock.calls[0][1].headers);
    const onWaking = jest.fn();
    await directoryGet('/directory/reference', undefined, { fetcher: answering(200), onWaking });
    expect(onWaking).not.toHaveBeenCalled();
  });

  it('holds any wait the server names between a second and the calm wait, and survives a page’s failure', async () => {
    for (const [named, waited] of [
      ['0', 1000],
      ['3600', WAKE_WAIT_MS],
      ['Wed, 21 Oct 2026 07:28:00 GMT', WAKE_WAIT_MS],
      ['-1', WAKE_WAIT_MS],
    ] as const) {
      const asleep = { status: 503, text: () => Promise.resolve(''), headers: new Headers({ 'Retry-After': named }) };
      const awake = { status: 200, text: () => Promise.resolve(''), headers: new Headers() };
      const fetcher = jest
        .fn<Promise<Response>, [string, RequestInit]>()
        .mockResolvedValueOnce(asleep as Response)
        .mockResolvedValueOnce(awake as Response);
      const wait = jest.fn(() => Promise.resolve());
      const onWaking = () => {
        throw new Error('a page’s own failure');
      };
      await expect(directoryGet('/directory/reference', undefined, { fetcher, wait, onWaking })).resolves.toBeNull();
      expect(wait.mock.calls).toEqual([[waited]]);
    }
  });

  it('goes again after no answer in time while the server wakes, for a read or a join, never a save', async () => {
    jest.useFakeTimers();
    try {
      const awake = { status: 200, text: () => Promise.resolve('{}'), headers: new Headers() } as Response;
      const asleep = { status: 503, text: () => Promise.resolve(''), headers: new Headers() } as Response;
      const silentOnce = () => {
        let calls = 0;
        return jest.fn<Promise<Response>, [string, RequestInit]>((_a, init) => {
          calls += 1;
          if (calls === 1) return Promise.resolve(asleep);
          if (calls > 2) return Promise.resolve(awake);
          return new Promise<Response>((_done, fail) => {
            init.signal?.addEventListener('abort', () => fail(new Error('aborted')));
          });
        });
      };
      const read = silentOnce();
      const onWaking = jest.fn();
      const reading = directoryGet('/directory/reference', undefined, { fetcher: read, onWaking });
      await jest.advanceTimersByTimeAsync(WAKE_WAIT_MS + TIMEOUT_MS);
      await expect(reading).resolves.toEqual({});
      expect(read).toHaveBeenCalledTimes(3);
      expect(onWaking).toHaveBeenCalledTimes(1);
      const join = silentOnce();
      const joining = directoryPost('/directory/join', { code: 'MADE-UP' }, undefined, { fetcher: join });
      await jest.advanceTimersByTimeAsync(WAKE_WAIT_MS + TIMEOUT_MS);
      await expect(joining).resolves.toEqual({});
      const save = silentOnce();
      const saving = directoryPut('/directory/reference/draft', {}, 'made-up-code', { fetcher: save });
      const seen = expect(saving).rejects.toMatchObject({ code: 'E_DIRECTORY_NETWORK' });
      await jest.advanceTimersByTimeAsync(WAKE_WAIT_MS + TIMEOUT_MS);
      await seen;
      expect(save).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('stops when the page has left, on its way or between tries', async () => {
    const control = new AbortController();
    const hanging = jest.fn<Promise<Response>, [string, RequestInit]>(
      (_a, init) =>
        new Promise<Response>((_done, fail) => {
          init.signal?.addEventListener('abort', () => fail(new Error('aborted')));
        }),
    );
    const going = directoryGet('/directory/reference', undefined, { fetcher: hanging, signal: control.signal });
    control.abort();
    await expect(going).rejects.toMatchObject({ code: 'E_DIRECTORY_LEFT' });
    const fetcher = answering(200);
    await expect(
      directoryGet('/directory/reference', undefined, { fetcher, signal: control.signal }),
    ).rejects.toMatchObject({ code: 'E_DIRECTORY_LEFT' });
    expect(fetcher).not.toHaveBeenCalled();
    const between = new AbortController();
    const sleepy = answering(503, '', { 'Retry-After': '15' });
    const waiting = directoryGet('/directory/reference', undefined, { fetcher: sleepy, signal: between.signal });
    await Promise.resolve();
    await new Promise((done) => setTimeout(done, 0));
    between.abort();
    await expect(waiting).rejects.toMatchObject({ code: 'E_DIRECTORY_LEFT' });
    expect(sleepy).toHaveBeenCalledTimes(1);
  });

  it('stops trying once the server has slept past the time, and never waits past the calm wait', async () => {
    let clock = 0;
    const fetcher = answering(503, '{}', { 'Retry-After': '3600' });
    const onWaking = jest.fn();
    const wait = jest.fn((ms: number) => {
      clock += ms;
      return Promise.resolve();
    });
    await expect(
      directoryGet('/directory/reference', undefined, { fetcher, wait, onWaking, now: () => clock }),
    ).rejects.toMatchObject({ code: 'E_DIRECTORY_WAKING' });
    expect(wait).toHaveBeenCalledWith(WAKE_WAIT_MS);
    expect(clock).toBeLessThan(WAKE_MS);
    expect(clock).toBeGreaterThan(WAKE_MS - WAKE_WAIT_MS * 2);
    expect(onWaking).toHaveBeenCalledTimes(1);
  });

  it('reads no network, no answer in time, a long answer and a strange one as the network', async () => {
    const offline = jest.fn<Promise<Response>, [string, RequestInit]>(() =>
      Promise.reject(new TypeError('Network request failed')),
    );
    await expect(directoryGet('/directory/reference', undefined, { fetcher: offline })).rejects.toMatchObject({
      code: 'E_DIRECTORY_NETWORK',
    });
    expect(MOST_DIRECTORY_ANSWER).toBeGreaterThan(MOST_ANSWER);
    await expect(
      directoryGet('/directory/reference', undefined, { fetcher: answering(200, `"${'x'.repeat(MOST_ANSWER)}"`) }),
    ).resolves.toHaveLength(MOST_ANSWER);
    const long = answering(200, 'x'.repeat(MOST_DIRECTORY_ANSWER + 1));
    await expect(directoryGet('/directory/reference', undefined, { fetcher: long })).rejects.toMatchObject({
      code: 'E_DIRECTORY_NETWORK',
    });
    const told = answering(200, '{}', { 'Content-Length': String(MOST_DIRECTORY_ANSWER + 1) });
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
    const guarded = jest.fn<Promise<Response>, [string, RequestInit]>(() =>
      Promise.reject(Object.assign(new TypeError('no'), { code: 'E_REFUSED' })),
    );
    await expect(directoryGet('/directory/reference', undefined, { fetcher: guarded })).rejects.toMatchObject({
      code: 'E_REFUSED',
    });
  });
});
