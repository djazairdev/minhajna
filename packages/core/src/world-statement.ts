// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's progress statement inside a demo world (#630, answer 725). A
// world keeps no session records on the device and a teacher's signed weeks
// name no plan items, so what the plan has reached comes from the teacher: an
// item of the class's main queue, done or started. The rest follows the app's
// own pace (pacing.ts). Every main item before the one named counts as finished
// at its budget, a started one at one session. The sessions recorded are those
// of the whole class the signed weeks held or did not hold, on a day no
// calendar entry takes; a session awaiting confirmation is never an absence,
// and a class taught only in half-groups reads no delay, a week naming no TD
// session so that a half-group's is not told from the plan's. Expected is the
// sessions recorded, or, for a week pack, the plan up to the weeks with a
// recorded session and as far into the last as it recorded, each capped by the
// plan. What the buffers left is each buffer's unused share, of the next exam's
// term when one is known; delay is what they do not cover, and a week pack says
// it in plan weeks, from the plan week of the first open item. The last
// resource is the last lesson at or before the item named, and the last unit
// the last whose main items, buffers aside, are all finished; a unit passed
// over is not told apart, the teacher naming only where the class stands. The
// sessions not held are every group's, but for exam days, which replace lessons
// and are no losses, and TD counts none. A stale pack, an own list, an item
// outside the main queue, or a statement that would not read, gives none.
// Signing it names the world (statement-signature.ts).

import { compareDays, type Day } from './day.ts';
import { sessionDay, weeksInForce, type DeliveryReading } from './course-delivery.ts';
import { budgetInSessions, queueItems, type PackItem, type PlanPack } from './pack.ts';
import { readStatement, STATEMENT_FORMAT, type ProgressStatement, type StatementItem } from './statement-read.ts';
import type { WeekRecord } from './week-record.ts';

/** Where a class has reached in its plan, as its teacher says, or null before its first item. */
export type WorldStatementReach = { readonly item: string; readonly status: 'done' | 'started' } | null;

/** What a course's signed weeks say of its sessions over a span, as the pace reads them. */
export interface WorldCourseRecord {
  /** The whole class's sessions held or not held, on a day no calendar entry takes. */
  readonly recorded: number;
  /** The weeks with such a session. */
  readonly weeks: number;
  /** How many of them fell in the last of those weeks. */
  readonly lastWeek: number;
  readonly notHeld: { readonly calendar: number; readonly other: number };
}

/** A course's record from its signed weeks, each at the version in force, over a span. */
export function worldCourseRecord(
  weeks: readonly WeekRecord[],
  from: Day,
  to: Day,
  reading: Pick<DeliveryReading, 'takenBy'>,
): WorldCourseRecord {
  const taught = new Map<Day, number>();
  const notHeld = { calendar: 0, other: 0 };
  for (const week of weeksInForce(weeks)) {
    for (const session of week.sessions) {
      const day = sessionDay(week.week, session);
      if (compareDays(day, from) < 0 || compareDays(day, to) > 0) continue;
      const entry = reading.takenBy(day, session, week.class);
      if (session.state === 'not-held' && entry?.effect !== 'exam') notHeld[entry === null ? 'other' : 'calendar'] += 1;
      if (entry === null && session.group === '' && session.state !== 'awaiting') {
        taught.set(week.week, (taught.get(week.week) ?? 0) + 1);
      }
    }
  }
  const last = [...taught.keys()].sort(compareDays).at(-1);
  return {
    recorded: [...taught.values()].reduce((sum, count) => sum + count, 0),
    weeks: taught.size,
    lastWeek: last === undefined ? 0 : taught.get(last)!,
    notHeld,
  };
}

/** What a world's statement is worked out from. */
export interface WorldStatementInput {
  readonly level: string;
  /** The class's grade and name, as the school lists them. */
  readonly grade: string;
  readonly section: string;
  readonly stream?: string;
  readonly subject: string;
  /** The school year's ID. */
  readonly year: string;
  /** The pack the class pins for the subject. */
  readonly pack: PlanPack;
  readonly reached: WorldStatementReach;
  readonly record: WorldCourseRecord;
  /** How long the class's session lasts, for a plan budgeted in hours. */
  readonly sessionMinutes: number;
  /** The term of the next exams, when the calendar knows it. */
  readonly term?: number;
  readonly day: Day;
}

const named = (item: PackItem): StatementItem => ({ id: item.id, title: item.title });
const sum = (values: readonly number[]) => values.reduce((total, one) => total + one, 0);

/** The statement for a course on a day, or null when it would not read. */
export function worldStatement(input: WorldStatementInput): ProgressStatement | null {
  const { pack, reached, record, term, day } = input;
  if (pack.status === 'stale' || pack.release === 'own') return null;
  const main = queueItems(pack, 'main');
  const at = reached === null ? -1 : main.findIndex((one) => one.id === reached.item);
  if (reached !== null && at < 0) return null;
  const budget = (item: PackItem) => budgetInSessions(pack, item, input.sessionMinutes);
  const finished = (place: number) => place < at || (place === at && reached?.status === 'done');
  const spent = (item: PackItem, place: number) => (finished(place) ? budget(item) : place === at ? 1 : 0);
  const total = sum(main.map(budget));
  const weekly = (test: (week: number) => boolean) =>
    sum(main.filter((one) => one.week !== undefined && test(one.week)).map(budget));
  const planned =
    pack.anchor.kind === 'weeks'
      ? weekly((week) => week < record.weeks) +
        Math.min(
          weekly((week) => week === record.weeks),
          record.lastWeek,
        )
      : record.recorded;
  const left = sum(
    main.map((item, place) =>
      item.buffer === true && (term === undefined || item.term === undefined || item.term === term)
        ? budget(item) - spent(item, place)
        : 0,
    ),
  );
  const behind = Math.max(0, Math.min(total, planned) - sum(main.map(spent)));
  const sessions = Math.max(0, behind - left);
  const open = main.find((_, place) => !finished(place));
  const planWeeks = sessions > 0 && open?.week !== undefined ? Math.max(0, record.weeks - open.week) : 0;
  const lesson = main.reduce((last, one, place) => (place <= at && one.kind === 'lesson' ? place : last), -1);
  const unit = pack.items
    .filter((one) => one.kind === 'unit')
    .filter((one) => {
      const children = main.flatMap((child, place) => (child.unit === one.id && child.buffer !== true ? [place] : []));
      return children.length > 0 && children.every(finished);
    })
    .at(-1);
  const statement: ProgressStatement = {
    format: STATEMENT_FORMAT,
    version: { major: 1, minor: 0 },
    day,
    class: {
      level: input.level,
      grade: input.grade,
      section: input.section,
      subject: input.subject,
      year: input.year,
      ...(input.stream === undefined ? {} : { stream: input.stream }),
    },
    pack: { id: pack.id, release: pack.release },
    lastUnit: unit === undefined ? null : named(unit),
    lastResource:
      lesson < 0 ? null : { ...named(main[lesson]!), status: lesson === at && !finished(at) ? 'started' : 'done' },
    delay: {
      sessions,
      weeks: pack.anchor.kind === 'weeks' ? planWeeks : null,
      bufferUsed: Math.min(behind, left),
      bufferLeft: left - Math.min(behind, left),
    },
    notHeld: record.notHeld,
    td: { calendar: 0, other: 0 },
  };
  return readStatement(JSON.stringify(statement)).ok ? statement : null;
}
