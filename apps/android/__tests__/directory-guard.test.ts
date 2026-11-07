// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The guard and the directory (answer 809): outside a world it lets only the
// directory's plain paths through, whatever an address hides, and keeps the
// rest of the server shut, also through React Native's own fetch, which stamps
// a read that is never cached. No test connects: every request lands in a
// stand-in.

import { directoryGet } from '../src/network/directory-network';
import { guardNetwork, mayConnect, type NetworkRules } from '../src/network/guard';
import { DEMO_SERVER } from '../src/network/world-network';

const OUTSIDE: NetworkRules = { server: DEMO_SERVER, inWorld: () => false, own: null, others: false };

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
    expect(mayConnect(`${DEMO_SERVER}/directory/reference?_=1762534800000`, OUTSIDE)).toBe(true);
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
      `${DEMO_SERVER}/directory/%2E%2E/worlds`,
      `${DEMO_SERVER}/directory/.../worlds`,
      `${DEMO_SERVER}/directoryx/join`,
      `${DEMO_SERVER}/directory/join/`,
      `${DEMO_SERVER}/directory/join?to=x`,
      `${DEMO_SERVER}/directory/join?_=1&to=x`,
      `${DEMO_SERVER}/directory/../worlds?_=1`,
      `${DEMO_SERVER}/worlds/7K3QX?_=1`,
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

  it('holds on a PC too, where only the page’s own files stay open besides', () => {
    const pc = { ...OUTSIDE, own: 'https://minhajna.djazair.dev' };
    expect(mayConnect(`${DEMO_SERVER}/directory/join`, pc)).toBe(true);
    expect(mayConnect(`${DEMO_SERVER}/worlds/7K3QX`, pc)).toBe(false);
    expect(mayConnect('https://minhajna.djazair.dev/build.json', pc)).toBe(true);
  });

  it('lets a real read of React Native’s fetch through the guarded request', async () => {
    const opened: string[] = [];
    class Stand {
      status = 200;
      statusText = 'OK';
      response = '{"claimed":false}';
      responseURL = '';
      onload: (() => void) | null = null;
      open(_method: string, address: string) {
        opened.push(address);
      }
      setRequestHeader() {}
      getAllResponseHeaders() {
        return '';
      }
      send() {
        this.onload?.();
      }
    }
    const scope: { XMLHttpRequest?: unknown } = { XMLHttpRequest: Stand };
    guardNetwork(OUTSIDE, scope);
    const global = globalThis as { XMLHttpRequest?: unknown };
    const before = global.XMLHttpRequest;
    global.XMLHttpRequest = scope.XMLHttpRequest;
    try {
      const { fetch: fetcher } = jest.requireActual<{
        fetch: (address: string, init: RequestInit) => Promise<Response>;
      }>('whatwg-fetch');
      await expect(directoryGet('/directory/reference/claimed', undefined, { fetcher })).resolves.toEqual({
        claimed: false,
      });
      expect(opened).toHaveLength(1);
      expect(opened[0]).toMatch(/\/directory\/reference\/claimed\?_=\d+$/u);
      await expect(fetcher(`${DEMO_SERVER}/worlds/7K3QX`, { cache: 'no-store' })).rejects.toMatchObject({
        code: 'E_REFUSED',
      });
      expect(opened).toHaveLength(1);
    } finally {
      global.XMLHttpRequest = before;
    }
  });
});
