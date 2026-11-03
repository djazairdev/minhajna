// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each world's observatory in PostgreSQL (#621, answer 676), through Prisma's
// client, under the memory store's rules: the observatory a row of its own,
// each sending kept by its world and sending ID with its token, never with its
// school-and-term code, a sending sent again with the same ID and token
// replacing the first in its place, at most MAX_SENDINGS a world. Sendings to
// one world take turns, its observatory's row locked while they are kept, so
// the cap holds, and those that wait too long for their turn are refused as
// busy (in-turn.ts). Erasing a world erases its observatory and sendings in the
// database itself, so forgetting a world here does nothing more.

import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { outcome, type InsightStore, type SendingKept } from '../insights/insight-store.js';
import type { KeptSending } from '../insights/sending-read.js';
import { inTurn, type StoreOptions } from './in-turn.js';

export class PrismaInsightStore implements InsightStore {
  constructor(
    private readonly client: PrismaClient,
    private readonly options: StoreOptions = {},
  ) {}

  open(world: string): Promise<boolean> {
    return inTurn(this.client, this.options, async (tx) => {
      const held = await tx.$queryRaw<unknown[]>`SELECT 1 FROM world WHERE id = ${world} FOR KEY SHARE`;
      if (held.length === 0) return false;
      await tx.$executeRaw`INSERT INTO observatory ("worldId") VALUES (${world}) ON CONFLICT DO NOTHING`;
      return true;
    });
  }

  put(world: string, sendings: readonly KeptSending[]): Promise<SendingKept[]> {
    return inTurn(this.client, this.options, async (tx) => {
      const open = await tx.$queryRaw<unknown[]>`SELECT 1 FROM observatory WHERE "worldId" = ${world} FOR UPDATE`;
      if (open.length === 0) {
        if (sendings.length === 0) return [];
        return [(await tx.world.count({ where: { id: world } })) > 0 ? 'closed' : 'no-world'];
      }
      const ids = sendings.map((sending) => sending.id);
      const rows = await tx.sending.findMany({
        where: { worldId: world, id: { in: ids } },
        select: { id: true, token: true },
      });
      const tokens = new Map(rows.map((row) => [row.id, row.token]));
      let held = await tx.sending.count({ where: { worldId: world } });
      const outcomes: SendingKept[] = [];
      for (const sending of sendings) {
        const one = outcome(tokens.get(sending.id), held, sending);
        outcomes.push(one);
        const body = sending as unknown as Prisma.InputJsonObject;
        const key = { worldId_id: { worldId: world, id: sending.id } };
        if (one === 'replaced') {
          await tx.sending.update({ where: key, data: { body } });
          continue;
        }
        if (one !== 'added') break;
        await tx.sending.create({ data: { worldId: world, id: sending.id, token: sending.token, body } });
        tokens.set(sending.id, sending.token);
        held += 1;
      }
      return outcomes;
    });
  }

  async sendings(world: string): Promise<KeptSending[]> {
    const rows = await this.client.sending.findMany({ where: { worldId: world }, orderBy: { seq: 'asc' } });
    return rows.map((row) => row.body as unknown as KeptSending);
  }

  forget(): Promise<void> {
    return Promise.resolve();
  }
}
