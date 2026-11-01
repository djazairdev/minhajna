// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  pbkdf2Sync,
  randomBytes,
  sign,
  verify,
} from 'node:crypto';
import { holdsPass, holdsStarter, readLaterDays, readWorldStart } from '../../server/src/worlds/world-rules';
import type { WorldKit } from '../src/demo/world-session';
import { worldRequest, type WorldRequest } from '../src/network/world-network';
import { WorldRelay } from './world-relay';

/** A Node call as the platform's promise, failing rather than throwing. */
const later = <T>(make: () => T): Promise<T> => Promise.resolve().then(make);

/**
 * Node's PBKDF2, HMAC, AES-GCM and P-256 standing in for the platform's, the
 * derivation in one round for speed.
 */
export const nodeKit: WorldKit = {
  random: (length) => new Uint8Array(randomBytes(length)),
  kdf: (secret, salt) => later(() => new Uint8Array(pbkdf2Sync(secret, salt, 1, 32, 'sha256'))),
  mac: (key, data) => later(() => new Uint8Array(createHmac('sha256', key).update(data).digest())),
  cipher: {
    seal: (key, plain, additional) =>
      later(() => {
        const nonce = randomBytes(12);
        const seal = createCipheriv('aes-256-gcm', key, nonce).setAAD(additional);
        return new Uint8Array(Buffer.concat([nonce, seal.update(plain), seal.final(), seal.getAuthTag()]));
      }),
    open: (key, sealed, additional) =>
      later(() => {
        try {
          const bytes = Buffer.from(sealed);
          const open = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)).setAAD(additional);
          open.setAuthTag(bytes.subarray(-16));
          return new Uint8Array(Buffer.concat([open.update(bytes.subarray(12, -16)), open.final()]));
        } catch {
          return null;
        }
      }),
  },
  sign: (pkcs8, text) =>
    later(() => {
      const key = createPrivateKey({ key: Buffer.from(pkcs8, 'base64'), format: 'der', type: 'pkcs8' });
      return sign('sha256', Buffer.from(text), key).toString('base64');
    }),
  verify: (spki, payload, signature) =>
    later(() => {
      const key = createPublicKey({ key: Buffer.from(spki, 'base64'), format: 'der', type: 'spki' });
      return verify('sha256', Buffer.from(payload), key, Buffer.from(signature, 'base64'));
    }),
  newPair: () =>
    later(() => {
      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
      const spki = publicKey.export({ type: 'spki', format: 'der' });
      return {
        spki: spki.toString('base64'),
        pkcs8: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
        fingerprint: createHash('sha256').update(spki).digest('hex'),
      };
    }),
  newAgreement: () =>
    later(() => {
      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
      const { x = '', y = '' } = publicKey.export({ format: 'jwk' });
      const point = Buffer.concat([Buffer.from([4]), Buffer.from(x, 'base64url'), Buffer.from(y, 'base64url')]);
      return {
        publicKey: new Uint8Array(point),
        pkcs8: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
      };
    }),
  agree: (pkcs8, publicKey) =>
    later(() => {
      if (publicKey.length !== 65 || publicKey[0] !== 4) throw new RangeError('Not an uncompressed point');
      const bytes = Buffer.from(publicKey);
      const jwk = {
        kty: 'EC',
        crv: 'P-256',
        x: bytes.subarray(1, 33).toString('base64url'),
        y: bytes.subarray(33).toString('base64url'),
      };
      const theirs = createPublicKey({ key: jwk, format: 'jwk' });
      const own = createPrivateKey({ key: Buffer.from(pkcs8, 'base64'), format: 'der', type: 'pkcs8' });
      return new Uint8Array(diffieHellman({ privateKey: own, publicKey: theirs }));
    }),
};

export interface KeptWorld {
  sealed: string;
  date: string;
  announced: string[];
  readonly passHash: string;
  readonly starterHash: string;
}

export function answer(status: number, body?: unknown, headers?: Record<string, string>): Response {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers });
}

/**
 * The demo server's routes on a map, with the server's own rules for what a
 * start carries, its pass and its starter token, which moving the date and
 * seeding (#548) need, and its relay and stand-in CA (world-relay.ts):
 * `taken` answers 409 to that many starts, and `busy` 429 to every request
 * while it is set.
 */
export class DemoServer {
  readonly worlds = new Map<string, KeptWorld>();
  readonly seen: { method: string; path: string; headers: Record<string, string>; body?: string }[] = [];
  readonly relay = new WorldRelay();
  taken = 0;
  busy = false;

  readonly send = (request: WorldRequest) => worldRequest(request, (address, init) => this.fetch(address, init));

  fetch(address: string, init: RequestInit): Promise<Response> {
    return Promise.resolve().then(() => this.route(address, init));
  }

  reset(): void {
    this.worlds.clear();
    this.seen.length = 0;
    this.taken = 0;
    this.busy = false;
    this.relay.reset();
  }

  private route(address: string, init: RequestInit): Response | Promise<Response> {
    const url = new URL(address);
    const path = url.pathname;
    const headers = init.headers as Record<string, string>;
    this.seen.push({
      method: init.method ?? 'GET',
      path,
      headers,
      ...(typeof init.body === 'string' && { body: init.body }),
    });
    if (this.busy) return answer(429, { error: 'busy' }, { 'Retry-After': '12' });
    if (path === '/worlds' && init.method === 'POST') {
      const start = readWorldStart(JSON.parse(init.body as string));
      if (typeof start === 'string') return answer(400, { error: start });
      if (this.taken > 0 || this.worlds.has(start.id)) {
        this.taken -= 1;
        return answer(409, { error: 'taken' });
      }
      const starter = randomBytes(32).toString('base64url');
      const starterHash = createHash('sha256').update(starter).digest('hex');
      this.worlds.set(start.id, { ...start, announced: [...start.announcedDays], starterHash });
      return answer(201, { starter });
    }
    const [, , world, rest] = path.split('/');
    const kept = this.worlds.get(world);
    if (kept === undefined || !holdsPass(headers['X-World-Pass'], kept.passHash)) return answer(404, {});
    const announcedDays = kept.announced;
    if (rest === undefined && init.method === 'GET')
      return answer(200, { sealed: kept.sealed, date: kept.date, announcedDays });
    if (rest === 'date' && init.method === 'GET') return answer(200, { date: kept.date, announcedDays });
    if (rest === 'announced-days' && init.method === 'PUT') {
      const days = readLaterDays(JSON.parse(init.body as string), kept.date, kept.announced);
      if (typeof days === 'string') return answer(400, { error: days });
      kept.announced = days;
      return answer(200, { announcedDays: days });
    }
    if (rest === 'seed' && !holdsStarter(headers.Authorization, kept.starterHash)) return answer(403, {});
    if (rest !== undefined && rest !== 'date') {
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      const segments = path.split('/').slice(3);
      return this.relay.route({
        world,
        date: kept.date,
        method: init.method ?? 'GET',
        segments,
        query: url.searchParams,
        body,
      });
    }
    if (rest !== 'date' || !holdsStarter(headers.Authorization, kept.starterHash)) return answer(403, {});
    const next = kept.announced.find((day) => day > kept.date);
    if (next === undefined) return answer(409, { error: 'no day left' });
    kept.date = next;
    return answer(200, { date: next });
  }
}

/** The error code a promise fails with, or 'none'. */
export function codeOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => 'none',
    (error: { code?: unknown }) => error.code,
  );
}
