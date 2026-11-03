// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo server's relay and stand-in CA for the app's tests (#564), on the
// server's own code: its memory store of spaces and sealed batches, its rules
// for what a space and an upload carry, and its CA, whose key each world gets
// when first asked and which certifies on the world's date, its seeding
// requests (#548), whose starter token world-server.ts checks, and its stand-in
// for the state's receiving system (state-standin.ts, #591).

import { isSpaceId, MAX_PAGE, readSpace, readUpload } from '../../server/src/spaces/space-rules';
import { MemorySpaceStore } from '../../server/src/spaces/space-store';
import { readSeedBatches, readSeedCertificates } from '../../server/src/worlds/seed-rules';
import { caPublicKey, issueCertificate, newCaKey, readCertificateRequest } from '../../server/src/worlds/stand-in-ca';
import { StateStandIn } from './state-standin';

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

/** A world's request after its ID, as the relay and the CA take it. */
export interface RelayRequest {
  readonly world: string;
  /** The world's date, which certificates are issued on. */
  readonly date: string;
  readonly method: string;
  /** The path's segments after the world's ID. */
  readonly segments: readonly string[];
  readonly query: URLSearchParams;
  readonly body: unknown;
}

export class WorldRelay {
  spaces = new MemorySpaceStore();
  readonly state = new StateStandIn();
  private readonly cas = new Map<string, string>();

  reset(): void {
    this.spaces = new MemorySpaceStore();
    this.cas.clear();
    this.state.reset();
  }

  /** The world's CA key, made when first asked. */
  caKey(world: string): string {
    const key = this.cas.get(world) ?? newCaKey();
    this.cas.set(world, key);
    return key;
  }

  async route({ world, date, method, segments, query, body }: RelayRequest): Promise<Response> {
    const [first, space = '', last, ...more] = segments;
    if (first === 'ca' && segments.length === 1 && method === 'GET') {
      return reply(200, { publicKey: caPublicKey(this.caKey(world)) });
    }
    if (first === 'certificates' && segments.length === 1 && method === 'POST') {
      const read = readCertificateRequest(body, world);
      return typeof read === 'string'
        ? reply(400, { error: read })
        : reply(201, issueCertificate(read, date, this.caKey(world)));
    }
    if (first === 'seed' && last === undefined && method === 'POST') return this.seed(world, date, space, body);
    if (first === 'state' && last === undefined) {
      return this.state.route(world, date, method, space, body, () => this.caKey(world));
    }
    if (first !== 'spaces' || more.length > 0) return reply(404, {});
    if (last === undefined && method === 'PUT') {
      const read = readSpace(space, body);
      if ('problem' in read) return reply(400, { error: read.problem });
      const added = await this.spaces.addSpace(world, space, read.kind);
      return added === 'added' || added === 'same' ? reply(200, read) : reply(409, { error: added });
    }
    if (last !== 'batches' || !isSpaceId(space) || (await this.spaces.kindOf(world, space)) === undefined) {
      return reply(404, {});
    }
    if (method === 'GET') {
      const kept = await this.spaces.batchesAfter(world, space, Number(query.get('after') ?? '0'), MAX_PAGE + 1);
      const batches = kept
        .slice(0, MAX_PAGE)
        .map((one) => ({ ...one, bytes: Buffer.from(one.bytes).toString('base64url') }));
      return reply(200, { batches, more: kept.length > MAX_PAGE });
    }
    const upload = readUpload(body);
    if (typeof upload === 'string') return reply(400, { error: upload });
    const added = await this.spaces.addBatches(world, space, upload.stream, upload.first, upload.batches);
    return added === 'added' ? reply(201, { added: upload.batches.length }) : reply(409, { error: added });
  }

  /** A seeding's certificates or spaces and streams, as the server takes them; its starter token is checked before. */
  private async seed(world: string, date: string, part: string, body: unknown): Promise<Response> {
    if (part === 'certificates') {
      const read = readSeedCertificates(body, world);
      if (typeof read === 'string') return reply(400, { error: read });
      return reply(201, { certificates: read.map((one) => issueCertificate(one, date, this.caKey(world))) });
    }
    const read = part === 'batches' ? readSeedBatches(body) : 'no such seeding';
    if (typeof read === 'string') return reply(part === 'batches' ? 400 : 404, { error: read });
    for (const { space, kind } of read.spaces) {
      const opened = await this.spaces.addSpace(world, space, kind);
      if (opened !== 'added' && opened !== 'same') return reply(409, { error: opened });
    }
    for (const { space, stream, first, batches } of read.streams) {
      if ((await this.spaces.kindOf(world, space)) === undefined) return reply(400, { error: 'no such space' });
      const added = await this.spaces.addBatches(world, space, stream, first, batches);
      if (added !== 'added') return reply(409, { error: added });
    }
    return reply(201, {
      opened: read.spaces.length,
      added: read.streams.reduce((sum, one) => sum + one.batches.length, 0),
    });
  }
}
