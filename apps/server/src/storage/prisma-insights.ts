// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each world's observatory in PostgreSQL (#621, answer 676), through Prisma's
// client, under the memory store's rules: the observatory a row of its own,
// each sending kept by its world and sending ID with its token, its school's
// mark for the run in its body, never with its school-and-term code, a sending
// sent again with the same ID and token replacing the first in its place, at
// most MAX_SENDINGS a world; each term whose collection ended a row of its own,
// at most MAX_ENDED_TERMS a world, and its figures a row a pack once formed.
// Sendings and ends of one world take turns, its observatory's row locked
// meanwhile, so the cap holds and no sending of a term slips in after its end;
// those that wait too long for their turn are refused as busy (in-turn.ts). The
// figures are formed apart, from the term's sendings, which stand still once it
// ended, and kept a pack at a time in one turn that marks them formed, given a
// minute, so two formings keep one. They are kept as JSON as written, their
// keys in the order formed. Erasing a world erases its observatory, sendings,
// ended terms and figures in the database itself, so forgetting a world here
// does nothing more.

import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import type { PackFigures } from '../insights/figures.js';
import {
  headingOf,
  MAX_ENDED_TERMS,
  outcome,
  shownPacks,
  termKey,
  type InsightStore,
  type Refused,
  type SendingKept,
  type Term,
  type TermFigures,
} from '../insights/insight-store.js';
import type { KeptSending } from '../insights/sending-read.js';
import { inTurn, type StoreOptions } from './in-turn.js';

/** How long keeping a term's figures may take, a pack at a time, as a full world's may weigh tens of megabytes. */
const FORMING_MS = 60_000;

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
    if (sendings.length === 0) return Promise.resolve([]);
    return inTurn(this.client, this.options, async (tx) => {
      const open = await tx.$queryRaw<unknown[]>`SELECT 1 FROM observatory WHERE "worldId" = ${world} FOR UPDATE`;
      if (open.length === 0) {
        if (sendings.length === 0) return [];
        return [(await tx.world.count({ where: { id: world } })) > 0 ? 'closed' : 'no-world'];
      }
      const ids = Prisma.join(sendings.map((sending) => sending.id));
      const rows = await tx.$queryRaw<(Term & { id: string; token: string })[]>`SELECT id, token,
        body->>'year' AS year, (body->>'term')::int AS term FROM sending WHERE "worldId" = ${world} AND id IN (${ids})`;
      const kept = new Map<string, Term & { token: string }>(rows.map(({ id, ...held }) => [id, held]));
      const ends = await tx.endedTerm.findMany({ where: { worldId: world }, select: { year: true, term: true } });
      const ended = new Set(ends.map(termKey));
      let held = await tx.sending.count({ where: { worldId: world } });
      const outcomes: SendingKept[] = [];
      for (const sending of sendings) {
        const one = outcome(kept.get(sending.id), held, sending, ended);
        outcomes.push(one);
        const body = sending as unknown as Prisma.InputJsonObject;
        const key = { worldId_id: { worldId: world, id: sending.id } };
        if (one === 'replaced') {
          await tx.sending.update({ where: key, data: { body } });
          kept.set(sending.id, sending);
          continue;
        }
        if (one !== 'added') break;
        await tx.sending.create({ data: { worldId: world, id: sending.id, token: sending.token, body } });
        kept.set(sending.id, sending);
        held += 1;
      }
      return outcomes;
    });
  }

  async sendings(world: string): Promise<KeptSending[]> {
    const rows = await this.client.sending.findMany({ where: { worldId: world }, orderBy: { seq: 'asc' } });
    return rows.map((row) => row.body as unknown as KeptSending);
  }

  end(world: string, { year, term }: Term): Promise<'ended' | Refused> {
    return inTurn(this.client, this.options, async (tx): Promise<'ended' | Refused> => {
      const open = await tx.$queryRaw<unknown[]>`SELECT 1 FROM observatory WHERE "worldId" = ${world} FOR UPDATE`;
      if (open.length === 0) return (await tx.world.count({ where: { id: world } })) > 0 ? 'closed' : 'no-world';
      const where = { worldId_year_term: { worldId: world, year, term } };
      if ((await tx.endedTerm.count({ where: where.worldId_year_term })) > 0) return 'ended';
      if ((await tx.endedTerm.count({ where: { worldId: world } })) >= MAX_ENDED_TERMS) return 'full';
      await tx.endedTerm.create({ data: { worldId: world, year, term } });
      return 'ended';
    });
  }

  async form(world: string, { year, term }: Term, form: (sendings: KeptSending[]) => PackFigures[]): Promise<void> {
    const where = { worldId: world, year, term, formed: false };
    if ((await this.client.endedTerm.count({ where })) === 0) return;
    const rows = await this.client.$queryRaw<{ body: KeptSending }[]>`SELECT body FROM sending
      WHERE "worldId" = ${world} AND body->>'year' = ${year} AND body->'term' = to_jsonb(${term}::int) ORDER BY seq`;
    const packs = shownPacks(form(rows.map((row) => row.body)));
    const options = { ...this.options, timeout: Math.max(this.options.timeout ?? 0, FORMING_MS) };
    await inTurn(this.client, options, async (tx) => {
      if ((await tx.endedTerm.updateMany({ where, data: { formed: true } })).count === 0) return;
      for (const [at, one] of packs.entries()) {
        const figures = one as unknown as Prisma.InputJsonObject;
        await tx.termPack.create({ data: { worldId: world, year, term, at, ...headingOf(one), figures } });
      }
    });
  }

  async figures(world: string, { year, term }: Term): Promise<TermFigures | undefined> {
    const ended = await this.client.endedTerm.findUnique({
      where: { worldId_year_term: { worldId: world, year, term } },
      select: { formed: true },
    });
    if (ended === null) return undefined;
    if (!ended.formed) return 'forming';
    return this.client.termPack.findMany({
      where: { worldId: world, year, term },
      orderBy: { at: 'asc' },
      select: { grade: true, subject: true, pack: true, release: true },
    });
  }

  async pack(world: string, { year, term }: Term, at: number): Promise<PackFigures | undefined> {
    const where = { worldId_year_term_at: { worldId: world, year, term, at } };
    const row = await this.client.termPack.findUnique({ where, select: { figures: true } });
    return row === null ? undefined : (row.figures as unknown as PackFigures);
  }

  forget(): Promise<void> {
    return Promise.resolve();
  }
}
