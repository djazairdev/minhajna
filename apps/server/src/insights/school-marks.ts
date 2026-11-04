// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Counting a world's schools without keeping the school-and-term code (#626,
// choice D6, answer 677). On receipt, the code is turned into a hash under a
// key this process draws when it starts and never writes anywhere, and the hash
// into the school's mark for this run: the run's own random prefix and a number
// drawn in turn, never drawn twice in a run, kept with the sending in place of
// the code. The hash, its first 128 bits, stays in memory only, beside the
// mark's number, to give a school's later sendings the same mark, under its
// world and the world's start, so a later world of the same ID never shares it,
// and is forgotten with the world; the code goes no further. A mark drawn for a
// sending the store refuses is given back, unless another call took it
// meanwhile, whose sending may be kept, or the store failed, which may have
// kept it. A mark names no school and cannot be worked back to its code, and
// links one school's sendings within one run of the server only. A restart
// draws a new prefix, so a school sending before and after it holds two marks;
// schoolsIn therefore counts a figure's schools as the most distinct marks of
// any one run among its sendings kept, so a figure counts fewer schools than it
// holds at worst, never more, and a sending sent again takes its new mark in
// place of its old. As the code is a school's for one term, a figure counts
// schools within one year and term only. A world holds at most MAX_SENDINGS
// marks and every world together GLOBAL_MARKS, past which a school is marked
// UNCOUNTED and counts as none, which can only hide more; the caps count the
// marks held, and a mark whose sendings were all replaced or refused after
// another call took it stays held until its world is forgotten, which also only
// hides more. Each start of a world notes the turn it was first marked at. A
// sweep forgets the starts of the worlds it erased marked before it began,
// then, once it has looked up which world holds each ID now, those marked
// before it looked but that one's, so a world started meanwhile under the same
// ID keeps its marks, and one first marked while its own sweep ran loses them.

import { createHmac, randomBytes } from 'node:crypto';
import { MAX_SENDINGS } from './insight-store.js';

/** The most schools every world's marks hold together. */
export const GLOBAL_MARKS = 1 << 20;
/** The mark of a school past the caps: never counted. */
export const UNCOUNTED = '';
/** A mark: a run's prefix, 16 hex digits, a dot and a number in base 36. */
export const MARK = /^[0-9a-f]{16}\.[0-9a-z]{1,11}$/;

/** A school's mark, the hash it was drawn for, and whether this call drew it. */
export interface Marked {
  readonly mark: string;
  readonly school: string;
  readonly fresh: boolean;
}

/** One start of a world: the turn it was first marked at, and each school's mark number, negative once shared. */
interface Start {
  readonly since: number;
  readonly held: Map<string, number>;
}

export class SchoolMarks {
  private readonly key = randomBytes(32);
  private readonly run = randomBytes(8).toString('hex');
  private readonly worlds = new Map<string, Map<string, Start>>();
  private drawn = 0;
  private total = 0;

  constructor(
    private readonly worldMarks = MAX_SENDINGS,
    private readonly globalMarks = GLOBAL_MARKS,
  ) {}

  /** How many marks every world holds together. */
  get size(): number {
    return this.total;
  }

  /** How many marks this run has drawn: a sweep's turn, taken before it begins. */
  get turn(): number {
    return this.drawn;
  }

  /** The school's mark in the world, whose `start` tells it apart from another world of its ID. */
  mark(world: string, start: string, code: string): Marked {
    const school = createHmac('sha256', this.key).update(code).digest().subarray(0, 16).toString('base64url');
    const starts = this.worlds.get(world) ?? new Map<string, Start>();
    const held = starts.get(start)?.held ?? new Map<string, number>();
    const known = held.get(school);
    if (known !== undefined) {
      held.set(school, -Math.abs(known));
      return { mark: this.named(Math.abs(known)), school, fresh: false };
    }
    if (held.size >= this.worldMarks || this.total >= this.globalMarks)
      return { mark: UNCOUNTED, school, fresh: false };
    if (!starts.has(start)) starts.set(start, { since: this.drawn, held });
    this.worlds.set(world, starts);
    this.drawn += 1;
    held.set(school, this.drawn);
    this.total += 1;
    return { mark: this.named(this.drawn), school, fresh: true };
  }

  /**
   * Gives back a mark this call drew for a sending the store refused, so a refusal uses up no room; a mark another call
   * took meanwhile stays, as that call's sending may hold it; so does another mark drawn for the school since.
   */
  release(world: string, start: string, { school, mark }: Marked): void {
    const starts = this.worlds.get(world);
    const held = starts?.get(start)?.held;
    const number = held?.get(school);
    if (held === undefined || number === undefined || number < 0 || this.named(number) !== mark) return;
    held.delete(school);
    this.total -= 1;
    if (held.size > 0) return;
    starts!.delete(start);
    if (starts!.size === 0) this.worlds.delete(world);
  }

  /** Those of these worlds that hold marks. */
  holding(worlds: readonly string[]): string[] {
    return worlds.filter((world) => this.worlds.has(world));
  }

  /**
   * Forgets the marks of these worlds, of every start first marked before `turn`, but the start `live` names as a
   * world's that holds its ID now.
   */
  forget(
    worlds: readonly string[],
    turn = Infinity,
    live: (world: string) => string | undefined = () => undefined,
  ): void {
    for (const world of worlds) {
      const starts = this.worlds.get(world);
      for (const [start, { since, held }] of starts ?? []) {
        if (since >= turn || start === live(world)) continue;
        this.total -= held.size;
        starts!.delete(start);
      }
      if (starts?.size === 0) this.worlds.delete(world);
    }
  }

  private named(number: number): string {
    return `${this.run}.${number.toString(36)}`;
  }
}

/**
 * A figure's schools: the most distinct marks of any one run among its sendings' marks, UNCOUNTED left out. The
 * sendings are of one year and term, as a school's code is a new one each term.
 */
export function schoolsIn(marks: Iterable<unknown>): number {
  const runs = new Map<string, Set<string>>();
  for (const mark of marks) {
    if (typeof mark !== 'string' || !MARK.test(mark)) continue;
    const run = mark.slice(0, 16);
    runs.set(run, (runs.get(run) ?? new Set<string>()).add(mark));
  }
  return Math.max(0, ...[...runs.values()].map((set) => set.size));
}
