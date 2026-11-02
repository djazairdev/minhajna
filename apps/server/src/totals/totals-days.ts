// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The days whose totals the server keeps worked out (#596, answer 628), in
// memory, as the demo runs one server. For each of the last MAX_DAYS days a
// share came in for or totals were asked for, it keeps the names the day's
// shares hold and their bytes, so a day holds the shares of at most
// MAX_DIRECTORATES directorates, MAX_SUBJECTS subjects and MAX_ITEMS plan items
// over them, in MAX_DAY_BYTES of JSON, and adding a day up stays quick and
// small; and, for the last MAX_SUMS of them, the day's sums, worked out once
// until a share comes in. A name once taken counts for the day while it is
// kept, even when the share that held it is replaced or refused by the store;
// a day no longer kept is read again from the store. A day is kept under its
// world's ID and starter's hash, so a world started again under the same ID
// never reads another's, and the sweeper forgets an erased world's days.

import { Injectable } from '@nestjs/common';
import type { World } from '../worlds/world-store.js';
import { shareBytes, type Share } from './share-read.js';
import { sumShares, type SummedShares } from './share-sums.js';

/** The most directorates whose shares a day holds: Algeria has about 60. */
export const MAX_DIRECTORATES = 64;
/** The most subjects a day's shares hold. */
export const MAX_SUBJECTS = 64;
/** The most plan items a day's shares hold, over every subject. */
export const MAX_ITEMS = 20_000;
/** The most JSON a day's shares take, in bytes. */
export const MAX_DAY_BYTES = 64 * 1024 * 1024;
const MAX_DAYS = 64;
const MAX_SUMS = 8;

/** What a day's shares hold. */
interface Day {
  readonly world: string;
  readonly directorates: Set<string>;
  readonly subjects: Set<string>;
  /** Each plan item, as JSON of its subject and name. */
  readonly items: Set<string>;
  /** Each share's bytes, by its ID. */
  readonly bytes: Map<string, number>;
  sums?: SummedShares;
}

/** Why the day cannot take the share, or null when it can. */
function refusal(day: Day, share: Share): string | null {
  const subjects = Object.keys(share.subjects);
  const items = subjects.flatMap((subject) =>
    Object.keys(share.subjects[subject]!.items).map((item) => JSON.stringify([subject, item])),
  );
  const added = (held: ReadonlySet<string>, names: readonly string[]) =>
    new Set(names.filter((name) => !held.has(name))).size;
  if (day.directorates.size + added(day.directorates, [share.directorate]) > MAX_DIRECTORATES) {
    return `a day holds the shares of at most ${MAX_DIRECTORATES} directorates`;
  }
  if (day.subjects.size + added(day.subjects, subjects) > MAX_SUBJECTS) {
    return `a day’s shares hold at most ${MAX_SUBJECTS} subjects`;
  }
  if (day.items.size + added(day.items, items) > MAX_ITEMS)
    return `a day’s shares hold at most ${MAX_ITEMS} plan items`;
  let bytes = shareBytes(share);
  for (const [id, held] of day.bytes) if (id !== share.id) bytes += held;
  if (bytes > MAX_DAY_BYTES) return `a day’s shares take at most ${MAX_DAY_BYTES} bytes`;
  return null;
}

function hold(day: Day, share: Share): void {
  day.directorates.add(share.directorate);
  for (const [subject, one] of Object.entries(share.subjects)) {
    day.subjects.add(subject);
    for (const item of Object.keys(one.items)) day.items.add(JSON.stringify([subject, item]));
  }
  day.bytes.set(share.id, shareBytes(share));
}

@Injectable()
export class TotalsDays {
  private readonly days = new Map<string, Day>();
  private changes = 0;

  /** Takes the share's names into its day, or says why the day cannot take it; `read` reads the day's shares. */
  async take(world: World, share: Share, read: () => Promise<Share[]>): Promise<string | null> {
    const [day] = await this.day(world, share.day, read);
    const refused = refusal(day, share);
    if (refused === null) hold(day, share);
    return refused;
  }

  /** Forgets the day's sums once a share came in for it. */
  changed(world: World, day: string): void {
    this.changes += 1;
    const kept = this.days.get(keyOf(world, day));
    if (kept !== undefined) delete kept.sums;
  }

  /** The day's sums, worked out once until a share comes in. */
  async sums(world: World, day: string, read: () => Promise<Share[]>): Promise<SummedShares> {
    const before = this.changes;
    const [kept, shares] = await this.day(world, day, read);
    if (kept.sums !== undefined) return kept.sums;
    const sums = sumShares(day, shares ?? (await read()));
    if (this.changes === before) {
      for (const other of this.days.values()) if (other !== kept && this.summed() >= MAX_SUMS) delete other.sums;
      kept.sums = sums;
    }
    return sums;
  }

  /** Forgets every day of these worlds. */
  forget(worlds: readonly string[]): void {
    const gone = new Set(worlds);
    for (const [key, day] of this.days) if (gone.has(day.world)) this.days.delete(key);
  }

  private summed(): number {
    return [...this.days.values()].filter((day) => day.sums !== undefined).length;
  }

  /** The day kept, made from the store's shares when it was not, with those shares. */
  private async day(world: World, day: string, read: () => Promise<Share[]>): Promise<[Day, Share[] | null]> {
    const key = keyOf(world, day);
    let kept = this.days.get(key);
    let shares: Share[] | null = null;
    if (kept === undefined) {
      shares = await read();
      kept = this.days.get(key);
      if (kept === undefined) {
        kept = { world: world.id, directorates: new Set(), subjects: new Set(), items: new Set(), bytes: new Map() };
        for (const share of shares) hold(kept, share);
      }
    }
    this.days.delete(key);
    this.days.set(key, kept);
    for (const old of this.days.keys()) if (this.days.size > MAX_DAYS) this.days.delete(old);
    return [kept, shares];
  }
}

const keyOf = (world: World, day: string) => JSON.stringify([world.id, world.starterHash, day]);
