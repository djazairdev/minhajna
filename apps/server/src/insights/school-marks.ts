// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Counting a world's schools without keeping the school-and-term code (#626,
// choice D6, answer 677). On receipt, the code is turned into a hash under a
// key this process draws when it starts and never writes anywhere, and the
// hash into the school's mark for this run: the run's own random prefix and a
// number drawn in turn, never drawn twice in a run, kept with the sending in
// place of the code. The hash stays in memory only, to give a school's later
// sendings the same mark, under its world and the world's start, so a later
// world of the same ID never shares it, and is forgotten with the world; the
// code goes no further. A mark drawn for a sending the store refuses is given
// back. A mark names no school and cannot be worked back to its code, and
// links one school's sendings within one run of the server only. A restart
// draws a new prefix, so a school sending before and after it holds two marks;
// schoolsIn therefore counts a figure's schools as the most distinct marks of
// any one run among its sendings kept, so a figure counts fewer schools than
// it holds at worst, never more, and a sending sent again takes its new mark in
// place of its old. A world holds at most MAX_SENDINGS marks and every world
// together GLOBAL_MARKS, past which a school is marked UNCOUNTED and counts as
// none, which can only hide more.

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

export class SchoolMarks {
  private readonly key = randomBytes(32);
  private readonly run = randomBytes(8).toString('hex');
  private readonly worlds = new Map<string, Map<string, Map<string, string>>>();
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

  /** The school's mark in the world, whose `start` tells it apart from another world of its ID. */
  mark(world: string, start: string, code: string): Marked {
    const school = createHmac('sha256', this.key).update(code).digest('hex');
    const starts = this.worlds.get(world) ?? new Map<string, Map<string, string>>();
    const held = starts.get(start) ?? new Map<string, string>();
    const known = held.get(school);
    if (known !== undefined) return { mark: known, school, fresh: false };
    if (held.size >= this.worldMarks || this.total >= this.globalMarks)
      return { mark: UNCOUNTED, school, fresh: false };
    const mark = `${this.run}.${(this.drawn += 1).toString(36)}`;
    held.set(school, mark);
    starts.set(start, held);
    this.worlds.set(world, starts);
    this.total += 1;
    return { mark, school, fresh: true };
  }

  /** Gives back a mark this call drew for a sending the store refused, so a refusal uses up no room. */
  release(world: string, start: string, school: string): void {
    if (this.worlds.get(world)?.get(start)?.delete(school)) this.total -= 1;
  }

  /** Forgets the marks of these worlds, of every start. */
  forget(worlds: readonly string[]): void {
    for (const world of worlds) {
      for (const held of this.worlds.get(world)?.values() ?? []) this.total -= held.size;
      this.worlds.delete(world);
    }
  }
}

/** A figure's schools: the most distinct marks of any one run among its sendings' marks, UNCOUNTED left out. */
export function schoolsIn(marks: Iterable<unknown>): number {
  const runs = new Map<string, Set<string>>();
  for (const mark of marks) {
    if (typeof mark !== 'string' || !MARK.test(mark)) continue;
    const run = mark.slice(0, 16);
    runs.set(run, (runs.get(run) ?? new Set<string>()).add(mark));
  }
  return Math.max(0, ...[...runs.values()].map((set) => set.size));
}
