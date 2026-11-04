// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the server keeps a world's observatory (#621, answer 676): whether its
// starter opened one, and the insights sendings it took, each by its sending ID
// with its token and its school's mark for the run (answer 677), never with its
// school-and-term code, a sending sent again with the same ID and token
// replacing the first in its place, at most MAX_SENDINGS a world, every one
// erased with the world; and the terms whose collection its starter ended
// (answer 678), at most MAX_ENDED_TERMS a world, after which no sending of the
// term is kept or replaced, nor one replacing a sending of the term, so the
// term's sendings stand still. Its figures are formed after, apart from the
// sendings' turns, once, and kept by pack, those whose nation's figure is
// hidden left out, so no answer holds more than one pack's and none names a
// pack only a hidden few sent. This store keeps them in memory, for tests and
// development; storage/prisma-insights.ts keeps them in PostgreSQL.

import type { PackFigures } from './figures.js';
import type { KeptSending } from './sending-read.js';

/** The most sendings a world's observatory keeps. */
export const MAX_SENDINGS = 4096;
/** The most terms a world's observatory ends: four school years'. */
export const MAX_ENDED_TERMS = 12;

export type SendingKept = 'added' | 'replaced' | 'taken' | 'ended' | 'full' | 'closed' | 'no-world';

/** Why the store did not end a term: it ended as many as it may, the world holds no observatory, or is gone. */
export type Refused = 'full' | 'closed' | 'no-world';

/** What names a pack's figures. */
export type PackHeading = Pick<PackFigures, 'grade' | 'subject' | 'pack' | 'release'>;

/** An ended term's figures: still being formed, or the headings of its packs, in order. */
export type TermFigures = 'forming' | readonly PackHeading[];

/** The figures of the packs whose nation's figure is shown: the only ones kept. */
export const shownPacks = (figures: readonly PackFigures[]): PackFigures[] =>
  figures.filter((one) => one.nation !== null);

export const headingOf = ({ grade, subject, pack, release }: PackFigures): PackHeading => ({
  grade,
  subject,
  pack,
  release,
});

/** A school year and term. */
export interface Term {
  readonly year: string;
  readonly term: number;
}

export interface InsightStore {
  /**
   * Opens the world's observatory; true when it is open, false when the world is gone. The memory store marks it open
   * before it asks whether the world exists, so a sweep meanwhile, which forgets it, never leaves it open.
   */
  open(world: string): Promise<boolean>;
  /** Keeps the sendings in order, each replacing its own, until one is refused; answers each one's outcome. */
  put(world: string, sendings: readonly KeptSending[]): Promise<SendingKept[]>;
  /** The world's sendings in the order first kept. */
  sendings(world: string): Promise<KeptSending[]>;
  /** Ends the term's collection in the world's observatory, once for good, so its sendings stand still; or why not. */
  end(world: string, term: Term): Promise<'ended' | Refused>;
  /**
   * Forms an ended term's figures with `form`, from the term's sendings in the order first kept, and keeps those of the
   * packs whose nation's figure is shown, unless formed already or the term has not ended.
   */
  form(world: string, term: Term, form: (sendings: KeptSending[]) => PackFigures[]): Promise<void>;
  /** The term's figures: undefined while its collection is open, 'forming' until formed, else its packs' headings. */
  figures(world: string, term: Term): Promise<TermFigures | undefined>;
  /** The figures of the ended term's pack at `at` among its headings, if any. */
  pack(world: string, term: Term, at: number): Promise<PackFigures | undefined>;
  /** Erases the observatories of these worlds. */
  forget(worlds: readonly string[]): Promise<void>;
}

export const INSIGHT_STORE = Symbol('InsightStore');

/** A term as the stores keep it: its year and number. */
export const termKey = ({ year, term }: Term): string => `${year}/${term}`;

/**
 * What one sending does to a world's sendings, given the sending its ID holds there, if any, how many it holds, and
 * the keys of the terms it has ended.
 */
export function outcome(
  held: (Term & { readonly token: string }) | undefined,
  count: number,
  sending: KeptSending,
  ended: ReadonlySet<string>,
): SendingKept {
  if (held !== undefined && held.token !== sending.token) return 'taken';
  if (ended.has(termKey(sending)) || (held !== undefined && ended.has(termKey(held)))) return 'ended';
  if (held !== undefined) return 'replaced';
  return count >= MAX_SENDINGS ? 'full' : 'added';
}

/** A world's observatory in memory: its sendings by ID, and its ended terms' figures by term, null until formed. */
interface Observatory {
  readonly sendings: Map<string, KeptSending>;
  readonly ends: Map<string, PackFigures[] | null>;
}

export class MemoryInsightStore implements InsightStore {
  private readonly worlds = new Map<string, Observatory>();

  constructor(private readonly exists: (world: string) => Promise<boolean> = () => Promise.resolve(true)) {}

  async open(world: string): Promise<boolean> {
    const fresh = !this.worlds.has(world);
    if (fresh) this.worlds.set(world, { sendings: new Map(), ends: new Map() });
    if (await this.exists(world)) return true;
    if (fresh) this.worlds.delete(world);
    return false;
  }

  async put(world: string, sendings: readonly KeptSending[]): Promise<SendingKept[]> {
    const held = this.worlds.get(world);
    if (sendings.length === 0) return [];
    if (held === undefined) return [(await this.exists(world)) ? 'closed' : 'no-world'];
    const ended = new Set(held.ends.keys());
    const outcomes: SendingKept[] = [];
    for (const sending of sendings) {
      const one = outcome(held.sendings.get(sending.id), held.sendings.size, sending, ended);
      outcomes.push(one);
      if (one !== 'added' && one !== 'replaced') break;
      held.sendings.set(sending.id, sending);
    }
    return outcomes;
  }

  sendings(world: string): Promise<KeptSending[]> {
    return Promise.resolve([...(this.worlds.get(world)?.sendings.values() ?? [])]);
  }

  async end(world: string, term: Term): Promise<'ended' | Refused> {
    const held = this.worlds.get(world);
    if (held === undefined) return (await this.exists(world)) ? 'closed' : 'no-world';
    if (held.ends.has(termKey(term))) return 'ended';
    if (held.ends.size >= MAX_ENDED_TERMS) return 'full';
    held.ends.set(termKey(term), null);
    return 'ended';
  }

  form(world: string, term: Term, form: (sendings: KeptSending[]) => PackFigures[]): Promise<void> {
    const held = this.worlds.get(world);
    if (held?.ends.get(termKey(term)) !== null) return Promise.resolve();
    const sendings = [...held.sendings.values()].filter((one) => one.year === term.year && one.term === term.term);
    held.ends.set(termKey(term), shownPacks(form(sendings)));
    return Promise.resolve();
  }

  figures(world: string, term: Term): Promise<TermFigures | undefined> {
    const figures = this.worlds.get(world)?.ends.get(termKey(term));
    return Promise.resolve(figures === undefined ? undefined : figures === null ? 'forming' : figures.map(headingOf));
  }

  pack(world: string, term: Term, at: number): Promise<PackFigures | undefined> {
    return Promise.resolve(this.worlds.get(world)?.ends.get(termKey(term))?.[at]);
  }

  forget(worlds: readonly string[]): Promise<void> {
    for (const id of worlds) this.worlds.delete(id);
    return Promise.resolve();
  }
}
