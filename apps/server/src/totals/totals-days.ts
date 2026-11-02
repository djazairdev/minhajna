// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The days whose totals the server keeps worked out (#596, answer 628), in
// memory, as the demo runs one server. For each of the last MAX_DAYS days a
// share came in for or totals were asked for, it keeps the names the day's
// shares hold and their bytes, so a day holds the shares of at most
// MAX_DIRECTORATES directorates, MAX_SUBJECTS subjects and MAX_ITEMS plan items
// over them, its grades' counted with them, in MAX_DAY_BYTES of JSON, a share
// whose grades would bring it past MAX_DAY_GRADES grades of directorates'
// subjects in all kept without them (answer 631), its names taken with the same
// check that holds them so shares coming in together cannot pass it, and adding
// a day up stays quick and small; and, for the last of them whose shares take
// MAX_SUMS_BYTES in all, the day's sums, worked out once until a share comes
// in. A name once taken counts for the day while it is kept, even when the
// share that held it is replaced or refused by the store; a day no longer kept
// is read again from the store. A day is kept under its world's ID and
// starter's hash, so a world started again under the same ID never reads
// another's, and the sweeper forgets an erased world's days. Asking for other
// days may push a large day out, to be read and added up again when asked for,
// as anyone with the pass may: about a second for a day at its caps, under the
// relay's limits.

import { Injectable } from '@nestjs/common';
import type { World } from '../worlds/world-store.js';
import { shareBytes, type Share, type SubjectShare } from './share-read.js';
import { sumShares, type SummedShares } from './share-sums.js';

/** The most directorates whose shares a day holds: Algeria has about 60. */
export const MAX_DIRECTORATES = 64;
/** The most subjects a day's shares hold. */
export const MAX_SUBJECTS = 64;
/** The most plan items a day's shares hold, over every subject. */
export const MAX_ITEMS = 20_000;
/** The most grades of directorates' subjects a day's shares hold in all: the floors' check stays about a second. */
export const MAX_DAY_GRADES = 1024;
/** The most JSON a day's shares take, in bytes. */
export const MAX_DAY_BYTES = 64 * 1024 * 1024;
const MAX_DAYS = 64;
/** The most JSON the days whose sums are kept take in all: twice a day's. */
const MAX_SUMS_BYTES = 2 * MAX_DAY_BYTES;

/** What a day's shares hold. */
interface Day {
  readonly world: string;
  readonly directorates: Set<string>;
  readonly subjects: Set<string>;
  /** Each plan item, as JSON of its subject and name. */
  readonly items: Set<string>;
  /** Each directorate's grade in a subject, as JSON of the three. */
  readonly grades: Set<string>;
  /** Each share's bytes, by its ID. */
  readonly bytes: Map<string, number>;
  sums?: SummedShares;
}

/** Why the day cannot take the share, or null when it can. */
function refusal(day: Day, share: Share): string | null {
  const subjects = Object.keys(share.subjects);
  const items = subjects.flatMap((subject) => itemNames(subject, share.subjects[subject]!));
  const added = (held: ReadonlySet<string>, names: readonly string[]) =>
    new Set(names.filter((name) => !held.has(name))).size;
  if (day.directorates.size + added(day.directorates, [share.directorate]) > MAX_DIRECTORATES) {
    return `a day holds the shares of at most ${MAX_DIRECTORATES} directorates`;
  }
  if (day.subjects.size + added(day.subjects, subjects) > MAX_SUBJECTS) {
    return `a day’s shares hold at most ${MAX_SUBJECTS} subjects`;
  }
  if (day.items.size + added(day.items, items) > MAX_ITEMS) {
    return `a day’s shares hold at most ${MAX_ITEMS} plan items`;
  }
  let bytes = shareBytes(share);
  for (const [id, held] of day.bytes) if (id !== share.id) bytes += held;
  if (bytes > MAX_DAY_BYTES) return `a day’s shares take at most ${MAX_DAY_BYTES} bytes`;
  return null;
}

/** How many bytes the day's shares take. */
function bytesOf(day: Day): number {
  let bytes = 0;
  for (const held of day.bytes.values()) bytes += held;
  return bytes;
}

/** A subject's plan items, its grades' among them, each once, under its subject. */
function itemNames(subject: string, one: SubjectShare): string[] {
  const graded = Object.values(one.grades ?? {}).flatMap((grade) => Object.keys(grade.items));
  return [...new Set([...Object.keys(one.items), ...graded])].map((item) => JSON.stringify([subject, item]));
}

/** A share's grades, each under its directorate and subject. */
function gradeNames(share: Share): string[] {
  return Object.entries(share.subjects).flatMap(([subject, one]) =>
    Object.keys(one.grades ?? {}).map((grade) => JSON.stringify([share.directorate, subject, grade])),
  );
}

/** The share as the day can take it: without its grades when they would bring the day past MAX_DAY_GRADES. */
function fit(day: Day, share: Share): Share {
  const grades = gradeNames(share).filter((name) => !day.grades.has(name));
  if (day.grades.size + new Set(grades).size <= MAX_DAY_GRADES) return share;
  const subjects = Object.entries(share.subjects).map(([subject, one]) => {
    const kept: { -readonly [K in keyof SubjectShare]?: SubjectShare[K] } = { ...one };
    delete kept.grades;
    return [subject, kept];
  });
  return { ...share, subjects: Object.fromEntries(subjects) as Share['subjects'] };
}

function hold(day: Day, share: Share): void {
  for (const grade of gradeNames(share)) day.grades.add(grade);
  day.directorates.add(share.directorate);
  for (const [subject, one] of Object.entries(share.subjects)) {
    day.subjects.add(subject);
    for (const item of itemNames(subject, one)) day.items.add(item);
  }
  day.bytes.set(share.id, shareBytes(share));
}

@Injectable()
export class TotalsDays {
  private readonly days = new Map<string, Day>();
  private changes = 0;

  /**
   * Takes the share into its day, without its grades when they would bring the day past MAX_DAY_GRADES, and gives it
   * as taken, or says why the day cannot take it; `read` reads the day's shares.
   */
  async take(world: World, share: Share, read: () => Promise<Share[]>): Promise<Share | string> {
    const [day] = await this.day(world, share.day, read);
    const fitted = fit(day, share);
    const refused = refusal(day, fitted);
    if (refused !== null) return refused;
    hold(day, fitted);
    return fitted;
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
      let held = bytesOf(kept);
      for (const other of this.days.values()) if (other !== kept && other.sums !== undefined) held += bytesOf(other);
      for (const other of this.days.values()) {
        if (other === kept || other.sums === undefined || held <= MAX_SUMS_BYTES) continue;
        delete other.sums;
        held -= bytesOf(other);
      }
      kept.sums = sums;
    }
    return sums;
  }

  /** Forgets every day of these worlds. */
  forget(worlds: readonly string[]): void {
    const gone = new Set(worlds);
    for (const [key, day] of this.days) if (gone.has(day.world)) this.days.delete(key);
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
        kept = {
          world: world.id,
          directorates: new Set(),
          subjects: new Set(),
          items: new Set(),
          grades: new Set(),
          bytes: new Map(),
        };
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
