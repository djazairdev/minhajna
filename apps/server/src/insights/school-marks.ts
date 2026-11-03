// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Counting a world's schools without keeping the school-and-term code (#626,
// choice D6, answer 677). On receipt, the code is turned into a hash under a
// key this process draws when it starts and never writes anywhere, and the
// hash into the school's mark for this run: the run's own random prefix and a
// number drawn in turn, kept with the sending in place of the code. The hash
// stays in memory only, to give a school's later sendings the same mark, and
// is forgotten with the world; the code goes no further. A mark names no
// school and cannot be worked back to its code, and links one school's
// sendings within one run of the server only. A restart draws a new prefix, so
// a school sending before and after it holds two marks; schoolsIn therefore
// counts a figure's schools as the most distinct marks of any one run among
// its sendings kept, so a figure counts fewer schools than it holds at worst,
// never more, and a sending sent again takes its new mark in place of its old.
// A world holds at most MAX_SENDINGS marks and every world together
// GLOBAL_MARKS, past which a school is marked UNCOUNTED and counts as none,
// which can only hide more.

import { createHmac, randomBytes } from 'node:crypto';
import { MAX_SENDINGS } from './insight-store.js';

/** The most schools every world's marks hold together. */
export const GLOBAL_MARKS = 1 << 20;
/** The mark of a school past the caps: never counted. */
export const UNCOUNTED = '';
/** A mark: a run's prefix, 8 hex digits, a dot and a number in base 36. */
export const MARK = /^[0-9a-f]{8}\.[0-9a-z]{1,8}$/;

export class SchoolMarks {
  private readonly key = randomBytes(32);
  private readonly run = randomBytes(4).toString('hex');
  private readonly worlds = new Map<string, { start: string; marks: Map<string, string> }>();
  private total = 0;

  constructor(
    private readonly worldMarks = MAX_SENDINGS,
    private readonly globalMarks = GLOBAL_MARKS,
  ) {}

  /** The school's mark in the world, which `start` tells apart from an earlier world of its ID. */
  mark(world: string, start: string, code: string): string {
    if (this.worlds.get(world)?.start !== start) this.forget([world]);
    const held = this.worlds.get(world) ?? { start, marks: new Map<string, string>() };
    this.worlds.set(world, held);
    const school = createHmac('sha256', this.key).update(code).digest('hex');
    const known = held.marks.get(school);
    if (known !== undefined) return known;
    if (held.marks.size >= this.worldMarks || this.total >= this.globalMarks) return UNCOUNTED;
    const mark = `${this.run}.${held.marks.size.toString(36)}`;
    held.marks.set(school, mark);
    this.total += 1;
    return mark;
  }

  /** Forgets the marks of these worlds. */
  forget(worlds: readonly string[]): void {
    for (const world of worlds) {
      this.total -= this.worlds.get(world)?.marks.size ?? 0;
      this.worlds.delete(world);
    }
  }
}

/** A figure's schools: the most distinct marks of any one run among its sendings' marks, UNCOUNTED left out. */
export function schoolsIn(marks: Iterable<string>): number {
  const runs = new Map<string, Set<string>>();
  for (const mark of marks) {
    if (mark === UNCOUNTED) continue;
    const run = mark.slice(0, 8);
    runs.set(run, (runs.get(run) ?? new Set<string>()).add(mark));
  }
  return Math.max(0, ...[...runs.values()].map((set) => set.size));
}
