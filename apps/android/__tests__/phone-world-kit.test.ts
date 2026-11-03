// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The phone's world kit (#561) over its native modules, here stood in for by
// Node's crypto behind the modules' own shapes: a build that may not connect
// gets none (answer 575); bytes cross as lowercase hex and come back as bytes,
// key agreement's too (#570); the derivation is asked for the world's 600,000
// rounds; random bytes come from the storage's SecureRandom; a seal that does
// not open is null; a world started through it is joined through it; and a
// failing module's E_WORLD_KIT stops a world with the network shut. The
// device's own test checks the native code against Node's vectors.

import { createHash, createHmac } from 'node:crypto';
import { toHex, WORLD_KDF_ROUNDS, type SchoolCalendar } from '@minhajna/core';
import { phoneWorldKit } from '../src/demo/phone-world-kit';
import { joinWorld, startWorld } from '../src/demo/world-session';
import type { Spec as KitSpec } from '../src/native/NativeMinhajnaWorldKit';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { fromHex } from '../src/storage/history';
import { codeOf, DemoServer, nodeKit } from '../jest/world-server';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const calendar: SchoolCalendar = read.calendar;
const server = new DemoServer();
const HEX = /^(?:[0-9a-f]{2})*$/u;

/** The native module's shape over Node's crypto, keeping every call it was given. */
function nodeModule(calls: unknown[][]): KitSpec {
  const hex = (...args: string[]) => args.every((arg) => HEX.test(arg)) || Promise.reject(new Error('Not hex'));
  return {
    canConnect: () => true,
    derive: async (secret, salt, rounds) => {
      calls.push(['derive', secret, salt, rounds]);
      await hex(secret, salt);
      return toHex(await nodeKit.kdf(fromHex(secret), fromHex(salt), rounds));
    },
    mac: async (key, data) => (await hex(key, data), toHex(await nodeKit.mac(fromHex(key), fromHex(data)))),
    seal: async (key, plain, additional) =>
      toHex(await nodeKit.cipher.seal(fromHex(key), fromHex(plain), fromHex(additional))),
    open: async (key, sealed, additional) => {
      const plain = await nodeKit.cipher.open(fromHex(key), fromHex(sealed), fromHex(additional));
      return plain === null ? null : toHex(plain);
    },
    sign: (pkcs8, text) => (calls.push(['sign']), nodeKit.sign(pkcs8, text)),
    newPair: () => (calls.push(['newPair']), nodeKit.newPair()),
    newAgreement: async () => {
      const pair = await nodeKit.newAgreement();
      return { publicKey: toHex(pair.publicKey), pkcs8: pair.pkcs8 };
    },
    agree: async (pkcs8, publicKey) => (await hex(publicKey), toHex(await nodeKit.agree(pkcs8, fromHex(publicKey)))),
  };
}

const storage = { randomBytes: (length: number) => '0a'.repeat(length) };
const signature = { verify: nodeKit.verify };

/** The phone's kit over a module that may connect. */
function made(module: KitSpec, random: { randomBytes: (length: number) => string } = storage, check = signature) {
  const kit = phoneWorldKit(module, random, check);
  if (kit === null) throw new Error('The module may connect');
  return kit;
}

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

test('key agreement crosses as hex and comes back as bytes', async () => {
  const kit = made(nodeModule([]));
  const [one, other] = [await kit.newAgreement(), await kit.newAgreement()];
  expect(one.publicKey).toHaveLength(65);
  expect(await kit.agree(one.pkcs8, other.publicKey)).toEqual(await kit.agree(other.pkcs8, one.publicKey));
});

test('a build that may not connect gets no kit', () => {
  expect(phoneWorldKit({ ...nodeModule([]), canConnect: () => false }, storage, signature)).toBeNull();
});

test('random bytes come from the storage, bytes cross as hex, and a seal that does not open is null', async () => {
  const kit = made(nodeModule([]), storage, signature);
  expect(kit.random(3)).toEqual(new Uint8Array([10, 10, 10]));
  const key = new Uint8Array(32).fill(1);
  const plain = new TextEncoder().encode('{"made":"up"}');
  const sealed = await kit.cipher.seal(key, plain, new Uint8Array([1]));
  expect(await kit.cipher.open(key, sealed, new Uint8Array([1]))).toEqual(plain);
  expect(await kit.cipher.open(key, sealed, new Uint8Array([2]))).toBeNull();
  expect(toHex(await kit.mac(key, plain))).toBe(createHmac('sha256', key).update(plain).digest('hex'));
});

test('a world started through the phone kit is joined through it, with the world’s own rounds', async () => {
  const calls: unknown[][] = [];
  const kit = made(nodeModule(calls), { randomBytes: (length) => toHex(nodeKit.random(length)) }, signature);
  const started = await startWorld('teachers', calendar, kit, server.send);
  leaveWorldNetwork();
  const joined = await joinWorld(started.code, kit, server.send);
  expect(joined).toEqual({ keys: started.keys, date: started.date, sealing: started.sealing });
  const derived = calls.filter(([name]) => name === 'derive');
  expect(derived).toHaveLength(2);
  for (const [, secret, salt, rounds] of derived) {
    expect([secret, salt]).toEqual([expect.stringMatching(HEX), expect.stringMatching(HEX)]);
    expect(rounds).toBe(WORLD_KDF_ROUNDS);
  }
  expect(calls.filter(([name]) => name === 'newPair')).toHaveLength(1);
  expect(calls.some(([name]) => name === 'sign')).toBe(true);
});

test('a new pair’s fingerprint is the SHA-256 of its SPKI’s bytes', async () => {
  const pair = await made(nodeModule([]), storage, signature).newPair();
  expect(pair.fingerprint).toBe(createHash('sha256').update(Buffer.from(pair.spki, 'base64')).digest('hex'));
});

test('a failing module stops starting and joining with E_WORLD_KIT and the network shut', async () => {
  const kitFailure = () =>
    Promise.reject(Object.assign(new Error('The world’s cryptography failed'), { code: 'E_WORLD_KIT' }));
  const failing = { ...nodeModule([]), newPair: kitFailure };
  const kit = made(failing, storage, signature);
  expect(await codeOf(startWorld('national', calendar, kit, server.send))).toBe('E_WORLD_KIT');
  expect(worldNetworkOpen()).toBeNull();
  const started = await startWorld('national', calendar, made(nodeModule([]), storage, signature), server.send);
  leaveWorldNetwork();
  const unsealing = made({ ...nodeModule([]), open: kitFailure }, storage, signature);
  expect(await codeOf(joinWorld(started.code, unsealing, server.send))).toBe('E_WORLD_KIT');
  expect(worldNetworkOpen()).toBeNull();
});
