// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The network on a PC (#559, answer 570): the page's first import sets the
// guard, over fetch, XMLHttpRequest, WebSocket, EventSource and sendBeacon; its
// own files stay open; outside a demo world nothing else connects, the demo
// server included; inside one, only the demo server does; and an address cannot
// pass for the page's own or the server's by what it hides. No test connects:
// every request lands in a stand-in. The world and its pass are made up.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it } from 'node:test';
import { guardNetwork } from '../../android/src/network/guard.ts';
import {
  DEMO_SERVER,
  enterWorldNetwork,
  leaveWorldNetwork,
  worldNetworkOpen,
} from '../../android/src/network/world-network.ts';

const OWN = 'https://minhajna.djazair.dev';
const sent: string[] = [];

class Request {
  open(_method: string, address: string) {
    sent.push(address);
  }
}
class Socket {
  constructor(address: string) {
    sent.push(address);
  }
}

class Events {
  constructor(address: string) {
    sent.push(address);
  }
}

const page = {
  fetch: (address: string) => {
    sent.push(address);
    return Promise.resolve('answered');
  },
  XMLHttpRequest: Request,
  WebSocket: Socket,
  EventSource: Events,
  navigator: {
    sendBeacon: (address: string) => {
      sent.push(address);
      return true;
    },
  },
};
guardNetwork({ server: DEMO_SERVER, inWorld: () => worldNetworkOpen() !== null, own: OWN, others: false }, page);

/** Whether fetch, XMLHttpRequest, WebSocket, EventSource and sendBeacon all let the address through. */
async function passes(address: string): Promise<boolean> {
  const fetched = await page.fetch(address).then(
    () => true,
    () => false,
  );
  let opened = true;
  try {
    new page.XMLHttpRequest().open('GET', address);
  } catch {
    opened = false;
  }
  let socket = true;
  try {
    new page.WebSocket(address);
  } catch {
    socket = false;
  }
  let events = true;
  try {
    new page.EventSource(address);
  } catch {
    events = false;
  }
  const beacon = page.navigator.sendBeacon(address);
  assert.equal(new Set([fetched, opened, socket, events, beacon]).size, 1, address);
  return fetched;
}

afterEach(() => {
  leaveWorldNetwork();
  sent.length = 0;
});

describe('the guard on a PC', () => {
  it('is set by the page’s first import, with the page’s own origin', () => {
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.equal(read('../src/index.tsx').match(/^import .*$/mu)?.[0], "import './network-guard.ts';");
    assert.match(read('../src/network-guard.ts'), /\ninstallNetworkGuard\(location\.origin, false\);\n/u);
  });

  it('keeps the page’s own files and local addresses open, and nothing else outside a world', async () => {
    for (const address of [
      './build.json',
      '/licences.json',
      `${OWN}/sw.js`,
      'blob:https://minhajna.djazair.dev/1',
      'data:,x',
    ]) {
      assert.equal(await passes(address), true, address);
    }
    for (const address of [
      `${DEMO_SERVER}/worlds/7K3QX`,
      'https://example.com/',
      '//example.com/',
      '/\\example.com/',
      '\t//example.com/',
      'h\nttps://minhajna-demo.djazair.dev/worlds/7K3QX',
      `${OWN}.example.com/`,
      `${OWN}@example.com/`,
      OWN,
    ]) {
      assert.equal(await passes(address), false, address);
    }
    assert.ok(sent.every((address) => !address.includes('example.com') && !address.startsWith(DEMO_SERVER)));
  });

  it('lets the demo server through only while a world is open', async () => {
    enterWorldNetwork('7K3QX', 'made-up-pass'.padEnd(43, 'x'));
    assert.equal(await passes(`${DEMO_SERVER}/worlds/7K3QX`), true);
    assert.equal(await passes(`h\nttps://minhajna-demo.djazair.dev/worlds/7K3QX`), true);
    assert.equal(await passes(`${DEMO_SERVER}@example.com/`), false);
    assert.equal(await passes('https://example.com/'), false);
    leaveWorldNetwork();
    assert.equal(await passes(`${DEMO_SERVER}/worlds/7K3QX`), false);
  });
});
