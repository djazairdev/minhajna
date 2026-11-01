// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A seeded school's term of signed weeks (#549, answer 626), worked out the
// same on every device from the world's ID, the bundled calendar with the
// world's made-up closure, the bells and each class's pinned pack, so a share
// prepared from it matches what was signed. For each course of the school, each
// teaching week from the year's first week to the world's date, the first
// term's end when the world starts, gives one week in the signed week's format
// (week-record.ts): the course's sessions of the class's week at their bells,
// the morning's hours of the level's template, or of the first template for a
// level with none, a session on a day with no school or after the world's date
// left out, and a week with none not made. A session on an exam day or a
// closure is not held, and a closure's are counted as closed; the teacher is
// absent on a few days drawn from the seed, the sessions then not held, half of
// them covered by a colleague and counted as covered; in the last week a few
// sessions await confirmation; the rest are held. A course moves through its
// pinned pack at the year's pace, its plan's budget spread over 95 percent of
// its sessions on the year's school days with no exam or closure, the rest kept
// as the plan's buffer, times a pace drawn for the course, slower or faster:
// each held session works on the current item and passes over any item it moves
// beyond, merged, so a week's totals list the items it worked on, by ID, how
// far the class has reached, in thousandths of the plan's budget, and whether
// the budget left is more than the year's remaining sessions give at the
// course's pace, a session of the week still to come or awaiting confirmation
// counted among them. A few weeks, never the last, are signed with a held
// session wrongly not held, then corrected at version 1 for an entry error, the
// correction keeping the week's totals as the teacher's own correction does.
// The made-up closure is one day of the ninth week, in the third wilaya, so
// neither the director's nor the small one.

import { clockMinutes, templateFor, type BellData } from './bells.ts';
import { CalendarView } from './calendar.ts';
import { addDays, compareDays, startOfWeek, type Day } from './day.ts';
import type { DemoClass, DemoSchool, DemoWorld } from './demo-world.ts';
import type { School, SchoolClass } from './records.ts';
import { packKey, type CalendarEntry, type LocalizedText, type Reference } from './reference.ts';
import { correctWeek, courseId, type WeekRecord, type WeekSession } from './week-record.ts';
import type { ItemFigures } from './week-totals.ts';
import type { WorldMac } from './world-keys.ts';

/** One course's week: version 0, then its correction when one is made. */
export interface SeededCourseWeek {
  readonly teacherId: string;
  readonly classId: string;
  readonly versions: readonly WeekRecord[];
}

export interface SeededTermInput {
  /** The world's ID, which every draw starts from. */
  readonly seed: string;
  readonly school: DemoSchool;
  /** The school's seeded space, under which its courses are named. */
  readonly space: string;
  readonly reference: Reference;
  /** The world's made-up closures, as its calendar publishes them. */
  readonly closures: readonly CalendarEntry[];
  readonly bells: BellData;
  /** The world's date, after which nothing has happened. */
  readonly until: Day;
}

const ABSENT = 0.02;
const COVERED = 0.5;
const AWAITING = 0.1;
const FIXED = 0.04;
/** The share of the year's sessions a plan fills, leaving the rest as its buffer. */
const BUFFER = 0.95;
/** The slowest and fastest a course moves through its plan, against the year's pace. */
const PACE = [0.9, 1.15] as const;

/** A number in [0, 1) drawn from the seed and a key, the same on every device. */
function draw(seed: string, key: string): number {
  let hash = 0x811c9dc5;
  const text = `${seed}\n${key}`;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  return (hash >>> 0) / 2 ** 32;
}

/** The world's made-up closure: one day of the year's ninth week, in its third wilaya, named in the app's words. */
export function demoClosure(
  world: Pick<DemoWorld, 'directorates'>,
  reference: Pick<Reference, 'year' | 'country'>,
  name: LocalizedText,
): CalendarEntry {
  const first = startOfWeek(reference.year.from, reference.country.weekStartsOn);
  const day = addDays(first, 7 * 8 + 2);
  return {
    id: 'demo-closure',
    layer: 'zone',
    zone: world.directorates[2]!.wilaya.code,
    from: day,
    to: day,
    effect: 'closure',
    name,
    source: 'Made up for the demo world',
    confidence: 'announced',
  };
}

/** A pack's plan as a course moves through it, each held session moving it on by `step` of the plan's budget. */
class Plan {
  readonly #items: readonly { readonly id: string; readonly from: number; readonly to: number }[];
  readonly #total: number;
  readonly #step: number;
  #at = 0;

  constructor(items: readonly { readonly id: string; readonly budget?: number }[], sessions: number) {
    let end = 0;
    this.#items = items.map((one) => ({ id: one.id, from: end, to: (end += Math.max(1, one.budget ?? 1)) }));
    this.#total = end;
    this.#step = sessions === 0 ? 0 : end / sessions;
  }

  /** The item a held session works on and those it passes over, merged; none once the plan is done. */
  teach(): { readonly item: string | null; readonly merged: readonly string[] } {
    const from = this.#at;
    const current = this.#items.find((one) => one.to > from);
    if (current === undefined || this.#step === 0) return { item: null, merged: [] };
    this.#at = Math.min(this.#total, from + this.#step);
    const merged = this.#items.filter((one) => one.from >= current.to && one.to <= this.#at).map((one) => one.id);
    return { item: current.id, merged };
  }

  get reached(): number {
    return this.#total === 0 ? 0 : Math.floor((1000 * this.#at) / this.#total);
  }

  /** Whether the plan's budget left is more than these sessions give at the course's pace. */
  runsLong(sessions: number): boolean {
    return this.#total - this.#at > sessions * this.#step + 1e-9;
  }
}

function classOf(school: DemoSchool, one: DemoClass): SchoolClass {
  const groups = [{ id: `${one.id}-whole`, kind: 'whole' as const, name: one.name }];
  return { id: one.id, schoolId: school.id, level: school.level, grade: one.grade, name: one.name, groups };
}

/** The school's term of signed weeks to the world's date, course by course, oldest week first. */
export async function seededTerm(input: SeededTermInput, mac: WorldMac): Promise<SeededCourseWeek[]> {
  const { seed, school, space, reference, closures, bells, until } = input;
  const view = new CalendarView(reference, closures);
  const place: School = { id: school.id, name: school.name, levels: [school.level], subjects: [], zone: school.wilaya };
  const template = templateFor(bells, school.level, 'single') ?? bells.templates[0];
  if (template === undefined) throw new RangeError('The bells hold no template');
  const { weekStartsOn } = reference.country;
  const first = startOfWeek(reference.year.from, weekStartsOn);
  const teaching = view.teachingWeeks(place);
  const weeks = teaching.filter((one) => compareDays(one.start, first) >= 0 && compareDays(one.start, until) <= 0);
  const lastWeek = weeks.at(-1)?.start;
  const out: SeededCourseWeek[] = [];
  for (const one of school.classes) {
    const schoolClass = classOf(school, one);
    for (const subject of [...new Set(school.week.filter((s) => s.classId === one.id).map((s) => s.subject))]) {
      const slots = school.week.filter((s) => s.classId === one.id && s.subject === subject);
      const teacherId = slots[0]!.teacherId;
      const pinned = one.packs[subject];
      const pack = pinned === undefined ? undefined : reference.packs.get(packKey(pinned.id, pinned.release));
      const course = await courseId(space, one.name, subject, mac);
      const lessons = (start: Day) =>
        slots.filter((slot) => {
          const info = view.info(addDays(start, (slot.weekday - weekStartsOn + 7) % 7), place, schoolClass);
          return info.schoolDay && info.closure === null && info.exam === null;
        }).length;
      const planned = new Map(teaching.map((week) => [week.start, lessons(week.start)]));
      const year = [...planned.values()].reduce((sum, count) => sum + count, 0);
      const pace = PACE[0] + (PACE[1] - PACE[0]) * draw(seed, `pace\n${course}`);
      const plan = new Plan(pack?.items ?? [], (year * BUFFER) / pace);
      for (const { start } of weeks) {
        const sessions: WeekSession[] = [];
        const taught = new Map<string, number>();
        const merged = new Set<string>();
        let [covered, closed, pending] = [0, 0, 0];
        for (const slot of slots) {
          const day = addDays(start, (slot.weekday - weekStartsOn + 7) % 7);
          const info = view.info(day, place, schoolClass);
          if (compareDays(day, until) > 0) {
            if (info.schoolDay && info.closure === null && info.exam === null) pending += 1;
            continue;
          }
          if (!info.schoolDay) continue;
          const span = template.morning[slot.slot.index - 1] ?? template.morning.at(-1)!;
          const at = { day: slot.weekday, start: clockMinutes(span.from), end: clockMinutes(span.to) };
          let state: WeekSession['state'] = 'held';
          if (info.closure !== null) [state, closed] = ['not-held', closed + 1];
          else if (info.exam !== null) state = 'not-held';
          else if (draw(seed, `absent\n${teacherId}\n${day}`) < ABSENT) {
            state = 'not-held';
            if (draw(seed, `cover\n${one.id}\n${subject}\n${day}\n${at.start}`) < COVERED) covered += 1;
          } else if (start === lastWeek && draw(seed, `awaiting\n${course}\n${day}\n${at.start}`) < AWAITING)
            [state, pending] = ['awaiting', pending + 1];
          if (state === 'held') {
            const step = plan.teach();
            if (step.item !== null) taught.set(step.item, (taught.get(step.item) ?? 0) + 1);
            for (const item of step.merged) merged.add(item);
          }
          sessions.push({ ...at, group: '', week: 'both', state });
        }
        if (sessions.length === 0) continue;
        const items: ItemFigures[] = [
          ...[...taught].map(([item, count]) => ({ item, sessions: count, outcome: 'taught' as const })),
          ...[...merged].map((item) => ({ item, sessions: 0, outcome: 'merged' as const })),
        ].sort((a, b) => (a.item < b.item ? -1 : a.item > b.item ? 1 : 0));
        const later = teaching.filter((week) => compareDays(week.start, start) > 0);
        const rest = later.reduce((sum, week) => sum + (planned.get(week.start) ?? 0), pending);
        const totals = { subject, items, reached: plan.reached, runsLong: plan.runsLong(rest), covered, closed };
        const week: WeekRecord = { course, week: start, version: 0, totals, class: one.name, subject, sessions };
        const wrong = sessions.find((s) => s.state === 'held');
        const fix = start !== lastWeek && wrong !== undefined && draw(seed, `fix\n${course}\n${start}`) < FIXED;
        if (!fix) {
          out.push({ teacherId, classId: one.id, versions: [week] });
          continue;
        }
        const signed = {
          ...week,
          sessions: sessions.map((s) => (s === wrong ? { ...s, state: 'not-held' as const } : s)),
        };
        out.push({ teacherId, classId: one.id, versions: [signed, correctWeek(signed, wrong, 'held', 'entry-error')] });
      }
    }
  }
  return out;
}
