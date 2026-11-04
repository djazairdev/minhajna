// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo server's observatories for the app's tests (#622), on the server's
// own memory store and its reading of a sending: the starter, whose token
// world-server.ts checks, opens a world's observatory with a body holding only
// up to 256 made-up sendings, no ID twice; each sending put after is answered
// 201 when new, 200 when it replaced its own, and 409 when the world holds no
// observatory, the ID is another token's or the world is full, as the server
// does. The starter ends a term's collection, its figures formed by the
// server's own figures.ts, read as the server gives them, 409 while it is open
// (#623). The server's limits by address are left out, and its school marks for
// the run: each opening's school-and-term code has a mark of its own, and MARK
// stands for every sending put after. What each world keeps is in `store`.

import { termFigures } from '../../server/src/insights/figures';
import { MemoryInsightStore, type SendingKept, type Term } from '../../server/src/insights/insight-store';
import { kept, readSending } from '../../server/src/insights/sending-read';

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

/** The school's mark each kept sending carries in place of its school-and-term code, the same for all here. */
export const MARK = 'made-up-mark';

/** The most sendings one opening keeps, as the server's. */
const SEED_SENDINGS = 256;

const isKept = (outcome: SendingKept | undefined) => outcome === 'added' || outcome === 'replaced';

export class WorldObservatory {
  store = new MemoryInsightStore();
  private readonly marks = new Map<string, string>();

  reset(): void {
    this.store = new MemoryInsightStore();
    this.marks.clear();
  }

  /** A made-up sending's mark, one for each school-and-term code, as the server's school marks would give it. */
  private markOf(code: string): string {
    const mark = this.marks.get(code) ?? `0a0b0c0d0a0b0c0d.${this.marks.size.toString(36)}`;
    this.marks.set(code, mark);
    return mark;
  }

  /** A request to `/worlds/<ID>/insights` and what follows, with whether it holds the starter token. */
  async route(world: string, method: string, rest: string, body: unknown, starter: boolean): Promise<Response> {
    if (rest === '' && method === 'POST') {
      if (!starter) return reply(403, {});
      const only = typeof body === 'object' && body !== null && Object.keys(body).join() === 'sendings';
      const list = only ? (body as { sendings?: unknown }).sendings : null;
      if (!Array.isArray(list) || list.length > SEED_SENDINGS) return reply(400, { error: 'not an opening' });
      const read = list.map(readSending);
      if (read.some((one) => typeof one === 'string')) return reply(400, { error: 'not a sending' });
      const ids = new Set(read.map((one) => (one as Exclude<typeof one, string>).id));
      if (ids.size !== read.length) return reply(400, { error: 'an ID given twice' });
      await this.store.open(world);
      const outcomes = await this.store.put(
        world,
        read.map((one) => {
          const sending = one as Exclude<typeof one, string>;
          return kept(sending, this.markOf(sending.schoolTerm));
        }),
      );
      return outcomes.every(isKept) ? reply(200, { kept: outcomes.length }) : reply(409, { error: 'refused' });
    }
    if (rest === '/sendings' && method === 'PUT') {
      const read = readSending(body);
      if (typeof read === 'string') return reply(400, { error: read });
      const [outcome] = await this.store.put(world, [kept(read, MARK)]);
      if (!isKept(outcome)) return reply(409, { error: outcome });
      return reply(outcome === 'added' ? 201 : 200, { id: read.id });
    }
    if (rest === '/closed' && method === 'POST') return this.close(world, body, starter);
    const figures = /^\/figures\?year=(\d{4}-\d{4})&term=([123])(?:&at=(\d+))?$/.exec(rest);
    if (figures !== null && method === 'GET') {
      const asked = { year: figures[1], term: Number(figures[2]) as 1 | 2 | 3 };
      return this.figures(world, asked, figures[3] === undefined ? undefined : Number(figures[3]));
    }
    return reply(404, {});
  }

  private async close(world: string, body: unknown, starter: boolean): Promise<Response> {
    if (!starter) return reply(403, {});
    const asked = body as Term;
    const ended = await this.store.end(world, asked);
    if (ended !== 'ended') return reply(409, { error: ended });
    await this.store.form(world, asked, (sendings) => termFigures(sendings, asked.year, asked.term));
    return reply(200, asked);
  }

  private async figures(world: string, asked: Term, at: number | undefined): Promise<Response> {
    const packs = await this.store.figures(world, asked);
    if (packs === undefined || packs === 'forming') return reply(409, { error: 'not ready' });
    if (at === undefined) return reply(200, { ...asked, packs });
    const figures = await this.store.pack(world, asked, at);
    return figures === undefined ? reply(400, {}) : reply(200, { ...asked, at, figures });
  }
}
