// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo server's stand-in for the state's receiving system in the app's
// tests (#591), on the server's own code (#590): each world's receiving key,
// made when first asked, its opening of what a device sealed, its reading of
// the signed term export against the world's CA key on the world's date, and
// its receipts, newest first, the same receipt answered 200 for the same export
// sent again. A refusal answers as the server's does, with its reason, and a
// world keeps at most `most` receipts, the server's cap unless a test lowers
// it. Unlike the server, it takes the world's CA key as the relay keeps it,
// made when first asked.

import {
  deliveryInfo,
  newReceiverKey,
  openDelivery,
  receiverPoint,
} from '../../server/src/state-standins/receiving-system';
import { hasOnly, readDelivery } from '../../server/src/state-standins/term-export-read';
import { MAX_RECEIPTS, type Receipt } from '../../server/src/worlds/world-store';

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const refuse = (status: number, message: string) => reply(status, { message, statusCode: status });
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class StateStandIn {
  private readonly keys = new Map<string, string>();
  private readonly kept = new Map<string, Receipt[]>();
  most = MAX_RECEIPTS;

  reset(): void {
    this.keys.clear();
    this.kept.clear();
    this.most = MAX_RECEIPTS;
  }

  /** A world's receipts, newest first. */
  receipts(world: string): readonly Receipt[] {
    return this.kept.get(world) ?? [];
  }

  /** Answers GET receiver, POST and GET deliveries, the world's CA key given. */
  route(world: string, date: string, method: string, path: string, body: unknown, caKey: () => string): Response {
    if (path === 'receiver' && method === 'GET') {
      const key = this.keys.get(world) ?? newReceiverKey();
      this.keys.set(world, key);
      return reply(200, { standIn: true, publicKey: receiverPoint(key) });
    }
    if (path !== 'deliveries') return reply(404, {});
    if (method === 'GET') return reply(200, { receipts: this.receipts(world) });
    if (!hasOnly(body, ['kind', 'sealed'])) return refuse(400, 'a delivery has a kind and what is sealed');
    if (body['kind'] !== 'marks' && body['kind'] !== 'absences') {
      return refuse(400, 'a delivery’s kind is marks or absences');
    }
    if (body['kind'] === 'absences') return refuse(422, 'a world records no roll call');
    if (typeof body['sealed'] !== 'string' || !BASE64.test(body['sealed'])) {
      return refuse(400, 'what is sealed is base64');
    }
    const key = this.keys.get(world);
    const sealed = Buffer.from(body['sealed'], 'base64');
    const opened = key === undefined ? null : openDelivery(sealed, key, deliveryInfo(world, 'marks'));
    if (key === undefined || opened === null) return refuse(400, 'the delivery is not sealed for this stand-in');
    const read = readDelivery(opened, { id: world, date }, { ca: caKey(), receiver: key });
    if (typeof read === 'string') return refuse(400, read);
    const kept = this.receipts(world);
    const before = kept.find((one) => one.id === read.id);
    if (before !== undefined) return reply(200, before);
    if (kept.length >= this.most) return refuse(409, `the stand-in keeps at most ${this.most} receipts a world`);
    this.kept.set(world, [read, ...kept]);
    return reply(201, read);
  }
}
