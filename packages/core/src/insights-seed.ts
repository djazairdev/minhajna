// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The made-up sendings a teachers' world's observatory opens with (#625, §1.6,
// §8.4, answers 678 and 699), so its report shows figures and hiding before any
// class has sent. For every pack the world's classes pin and every term of the
// year, six wilayas hold made-up teachers: the first three, the teacher's own
// first, over both floors (at least 10 teachers and 3 schools); the fourth over
// the teachers' floor only, the fifth over the schools' only, and the world's
// last, already its small one (answer 626), under both, so at least two parts
// stay hidden and subtraction uncovers none. The other wilayas hold nothing.
// Each sending goes through the same builder as a class's, from one made-up
// week holding its term. A class moves through its pack as a seeded course does
// (seeded-plan.ts), at a pace drawn for it, over the lessons the calendar gives
// its pack's first class in the term, less the share a seeded teacher is
// absent, so its sessions compare with the world's teacher's. A few of the
// pack's items are changed by most or some of its classes, by their place in
// the pack, as CHANGES says, and a few take most of them longer than the plan
// gives, as LONGER says, so the report and a class's comparison have something
// to show. Nothing here is real or derived from anything real: IDs, tokens and
// school-and-term codes are all drawn at random, a token kept by one made-up
// teacher for one term, a code by one made-up school for one term. Batches keep
// to what one request may carry.

import { CalendarView } from './calendar.ts';
import { addDays, isWithin } from './day.ts';
import type { DemoClass, DemoSchool, DemoWorld } from './demo-world.ts';
import { toHex, type RandomBytes } from './id.ts';
import { insightsSending, newSendingId, newTermToken, type InsightsSending } from './insights.ts';
import type { PackItem } from './pack.ts';
import type { PinnedPack } from './records.ts';
import { packKey, type Reference, type Term } from './reference.ts';
import { ABSENT, isLessonDay, PACE, Plan, PLAN_SHARE } from './seeded-plan.ts';
import { demoSchoolClass, demoSchoolPlace } from './seeded-term.ts';
import type { ItemFigures } from './week-totals.ts';

/** The most sendings one request carries, as the server takes them. */
export const SEED_SENDINGS = 256;
/** The most JSON one request carries, in bytes, under the server's megabyte. */
export const SEED_BYTES = 900 * 1024;

/** What `{"sendings":[]}` takes around the sendings. */
const ENVELOPE = 15;

/** A wilaya's made-up teachers and schools, in the order of the wilayas that hold them. */
const CELLS: readonly { readonly teachers: number; readonly schools: number }[] = [
  { teachers: 16, schools: 4 },
  { teachers: 13, schools: 4 },
  { teachers: 11, schools: 3 },
  { teachers: 12, schools: 2 },
  { teachers: 8, schools: 3 },
  { teachers: 4, schools: 2 },
];

/** Every this many teachers, one teaches two classes. */
const TWO_CLASSES = 3;

/** Which items are changed, by their place in the pack, and by what share of the classes. */
const CHANGES: readonly {
  readonly every: number;
  readonly at: number;
  readonly share: number;
  readonly change: 'merged' | 'skipped' | 'retaught' | 'split';
}[] = [
  { every: 17, at: 5, share: 0.97, change: 'skipped' },
  { every: 13, at: 3, share: 0.6, change: 'merged' },
  { every: 11, at: 7, share: 0.2, change: 'retaught' },
  { every: 19, at: 9, share: 0.08, change: 'split' },
];

type SeedTerm = Term & { readonly number: 1 | 2 | 3 };

/** Which items most classes spend longer on than their plan gives, by their place in the pack, and how much longer. */
const LONGER = { every: 7, at: 2, share: 0.9, more: 0.4 } as const;

interface SeedPack {
  readonly pinned: PinnedPack;
  readonly grade: string;
  readonly subject: string;
  readonly items: readonly PackItem[];
  /** The lessons of the subject its first class has in each term, by the calendar. */
  readonly lessons: ReadonlyMap<number, number>;
}

/** The year's terms as insights count them. */
const termsOf = (reference: Reference) =>
  reference.year.terms.filter((one): one is SeedTerm => [1, 2, 3].includes(one.number));

/** The first class's lessons of a subject in each term, as a seeded course of its school counts them. */
function termLessons(
  view: CalendarView,
  school: DemoSchool,
  one: DemoClass,
  subject: string,
  terms: readonly SeedTerm[],
  weekStartsOn: number,
): ReadonlyMap<number, number> {
  const place = demoSchoolPlace(school);
  const schoolClass = demoSchoolClass(school, one);
  const slots = school.week.filter((slot) => slot.classId === one.id && slot.subject === subject);
  const days = view
    .teachingWeeks(place)
    .flatMap(({ start }) => slots.map((slot) => addDays(start, (slot.weekday - weekStartsOn + 7) % 7)))
    .filter((day) => isLessonDay(view, place, schoolClass, day));
  return new Map(terms.map((term) => [term.number, days.filter((day) => isWithin(day, term.from, term.to)).length]));
}

/** A class's lessons of a subject over the year, as a seeded course of its school counts them. */
export function yearLessons(reference: Reference, school: DemoSchool, one: DemoClass, subject: string): number {
  const view = new CalendarView(reference, []);
  const terms = termsOf(reference);
  const lessons = termLessons(view, school, one, subject, terms, reference.country.weekStartsOn);
  return [...lessons.values()].reduce((sum, count) => sum + count, 0);
}

/** Each pack the world's classes pin, once, with the grade, the subject and the lessons of its first class. */
function packsOf(world: DemoWorld, reference: Reference, terms: readonly SeedTerm[]): SeedPack[] {
  const view = new CalendarView(reference, []);
  const packs = new Map<string, SeedPack>();
  for (const school of world.schools) {
    for (const one of school.classes) {
      for (const [subject, pinned] of Object.entries(one.packs)) {
        const key = packKey(pinned.id, pinned.release);
        const items = reference.packs.get(key)?.items ?? [];
        if (packs.has(key) || items.length === 0) continue;
        const lessons = termLessons(view, school, one, subject, terms, reference.country.weekStartsOn);
        packs.set(key, { pinned, grade: one.grade, subject, items, lessons });
      }
    }
  }
  return [...packs.values()];
}

/** A number in [0, 1), drawn at random. */
function chance(random: RandomBytes): number {
  const [high, low] = random(2);
  return ((high ?? 0) * 256 + (low ?? 0)) / 65536;
}

/** A class's sessions over a term, by item, its plan moving on as it goes. */
function teachTerm(plan: Plan, sessions: number): ReadonlyMap<string, number> {
  const taught = new Map<string, number>();
  for (let at = 0; at < sessions; at += 1) {
    const { item, merged } = plan.teach();
    if (item !== null) taught.set(item, (taught.get(item) ?? 0) + 1);
    for (const passed of merged) taught.set(passed, taught.get(passed) ?? 0);
  }
  return taught;
}

/** The items of a term as a class ends them, with those its plan layer split. */
function termItems(
  items: readonly PackItem[],
  taught: ReadonlyMap<string, number>,
  random: RandomBytes,
): { readonly figures: readonly ItemFigures[]; readonly split: readonly string[] } {
  const figures: ItemFigures[] = [];
  const split: string[] = [];
  for (const [place, { id }] of items.entries()) {
    const sessions = taught.get(id);
    if (sessions === undefined) continue;
    const change = CHANGES.find((one) => place % one.every === one.at && chance(random) < one.share)?.change;
    if (change === 'split') split.push(id);
    if (change === 'skipped') figures.push({ item: id, sessions: 0, outcome: 'skipped' });
    else if (change === 'retaught') figures.push({ item: id, sessions: Math.max(1, sessions), outcome: 'retaught' });
    else if (change === 'merged' || sessions === 0) figures.push({ item: id, sessions: 0, outcome: 'merged' });
    else {
      const longer = place % LONGER.every === LONGER.at && chance(random) < LONGER.share;
      const spent = longer ? sessions + Math.ceil(sessions * LONGER.more) : sessions;
      figures.push({ item: id, sessions: spent, outcome: 'taught' });
    }
  }
  figures.sort((a, b) => (a.item < b.item ? -1 : 1));
  return { figures, split };
}

/** The made-up sendings of a teachers' world, for every pack it pins and every term of its year. */
export function seedInsights(world: DemoWorld, reference: Reference, random: RandomBytes): InsightsSending[] {
  const terms = termsOf(reference);
  const packs = packsOf(world, reference, terms);
  const wilayas = [...world.directorates.slice(0, CELLS.length - 1), ...world.directorates.slice(-1)];
  const sendings: InsightsSending[] = [];
  const codes = new Map<string, string>();
  const codeOf = (key: string): string => {
    const code = codes.get(key) ?? toHex(random(32));
    codes.set(key, code);
    return code;
  };
  for (const pack of packs) {
    const year = terms.reduce((sum, term) => sum + (pack.lessons.get(term.number) ?? 0), 0);
    for (const [place, cell] of CELLS.entries()) {
      const wilaya = wilayas[place]?.wilaya.code;
      if (wilaya === undefined) continue;
      for (let teacher = 0; teacher < cell.teachers; teacher += 1) {
        const tokens = terms.map(() => newTermToken(random));
        const plans = Array.from({ length: teacher % TWO_CLASSES === 0 ? 2 : 1 }, () => {
          const pace = PACE[0] + (PACE[1] - PACE[0]) * chance(random);
          return new Plan(pack.items, (year * PLAN_SHARE) / pace);
        });
        for (const plan of plans) {
          for (const [at, term] of terms.entries()) {
            const taught = teachTerm(plan, Math.round((pack.lessons.get(term.number) ?? 0) * (1 - ABSENT)));
            const { figures, split } = termItems(pack.items, taught, random);
            const sending = insightsSending({
              id: newSendingId(random),
              token: tokens[at]!,
              schoolTerm: codeOf(`${wilaya}\n${teacher % cell.schools}\n${term.number}`),
              year: reference.year.id,
              term: term.number,
              wilaya,
              grade: pack.grade,
              subject: pack.subject,
              pack: pack.pinned,
              from: term.from,
              to: term.to,
              weeks: [
                {
                  course: 'made-up',
                  week: term.from,
                  version: 0,
                  totals: {
                    subject: pack.subject,
                    items: figures,
                    reached: plan.reached,
                    runsLong: false,
                    covered: 0,
                    closed: 0,
                  },
                },
              ],
              split,
            });
            if (typeof sending === 'string') throw new RangeError(`A made-up sending does not read: ${sending}`);
            sendings.push(sending);
          }
        }
      }
    }
  }
  return sendings;
}

/** The sendings cut into what one request may carry, in order; at least one batch, so an opening is always made. */
export function seedBatches(sendings: readonly InsightsSending[]): (readonly InsightsSending[])[] {
  const batches: InsightsSending[][] = [[]];
  let bytes = ENVELOPE;
  for (const sending of sendings) {
    const size = JSON.stringify(sending).length + 1;
    if (batches.at(-1)!.length === SEED_SENDINGS || bytes + size > SEED_BYTES) {
      batches.push([]);
      bytes = ENVELOPE;
    }
    batches.at(-1)!.push(sending);
    bytes += size;
  }
  return batches;
}
