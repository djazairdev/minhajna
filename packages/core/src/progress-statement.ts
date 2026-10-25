// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A statement is a projection, never a dump of a history or a class (#436).
// Session records pass the statement route; only their plan coverage and
// aggregate counts survive. Private calendar entries affect only the
// anonymous 'other' count, never their text, dates or identifiers. Main
// calendar losses come from pace, including rotation's class-equivalent
// cost; TD counts its own slots, as the engine does. Exams replace lessons
// and are not losses. Confirmed teaching on a blocked day is not a loss. A
// main half-session not held that pace already counts as rotation's cost is
// not counted again. A unit completes when every non-buffer main item is
// finished for the whole class, an item left out or skipped by a layer
// counting as finished, and at least one was taught: a unit left out
// whole never qualifies, and a skipped lesson is never the last resource
// (answer 484). Delay figures are whole sessions, rounded as the class
// screen rounds them, so print, QR and reader agree, and no plan week is
// behind when no session is. A teacher's own list is named by its level and
// subject, never by the class's local ID; its items keep the random IDs the
// list gave them, which name nothing. A statement that would not sign, such
// as one with a pack title too long, is null.

import { courseSetup } from './choices.ts';
import type { Context } from './context.ts';
import type { Day } from './day.ts';
import { walkCourse } from './engine.ts';
import { layerOf } from './events.ts';
import { courseGrade } from './joint.ts';
import { mayTravelAs } from './layers.ts';
import { carriedId } from './pack-migration.ts';
import { queueItems, stageCount, type PackItem } from './pack.ts';
import { pace, queueOf } from './pacing.ts';
import { wholeGroup } from './records.ts';
import { sessionCredits } from './rotation-sessions.ts';
import { sessionsBetween } from './sessions.ts';
import { current } from './state.ts';
import {
  STATEMENT_FORMAT,
  readStatement,
  type ProgressStatement,
  type StatementItem,
  type StatementLosses,
} from './statement-read.ts';

const named = (item: PackItem): StatementItem => ({ id: item.id, title: item.title });

/** A class's allowlisted statement as of `today`, or null without an available, usable pack. Never writes. */
export function progressStatement(context: Context, courseId: string, today: Day): ProgressStatement | null {
  const setup = courseSetup(context, courseId);
  const pack = setup.pack;
  const paced = pace(context, courseId, today);
  if (pack === null || paced === null) return null;
  const { course, schoolClass } = setup;
  const progress = walkCourse(context, courseId, today).progress;
  const whole = wholeGroup(schoolClass).id;
  const complete = (item: PackItem) =>
    !progress.skipped(item.id) && progress.firstOpen(item.id, whole) >= stageCount(pack, item);
  const main = queueItems(pack, 'main');
  const unit = pack.items
    .filter((one) => {
      if (one.kind !== 'unit') return false;
      const children = main.filter((child) => child.unit === one.id && child.buffer !== true);
      return children.every((child) => progress.isFinished(pack, child, whole)) && children.some(complete);
    })
    .at(-1);
  const records = new Map(
    [...context.state.sessions.values()].flatMap((versions) => {
      const record = current(versions);
      if (record === null) return [];
      const event = { kind: 'session.recorded', record } as const;
      return mayTravelAs(layerOf(event), event.kind, 'statement') ? [[record.session.key, record] as const] : [];
    }),
  );
  const sessions = sessionsBetween(context, context.ref.year.from, today, new Set([courseId]));
  const ordinary = sessions.filter((session) => session.calendar === null && queueOf(context, session) === 'main');
  const credits = new Map(sessionCredits(ordinary).map((credit, index) => [ordinary[index]!.key, credit]));
  const items = new Map([...pack.items, ...(pack.retired ?? [])].map((one) => [one.id, one]));
  let lastResource: ProgressStatement['lastResource'] = null;
  let mainOther = 0;
  const rest: { calendar: number; other: number } = { calendar: 0, other: 0 };
  const td: { calendar: number; other: number } = { calendar: 0, other: 0 };
  for (const session of sessions) {
    const record = records.get(session.key);
    const queue = queueOf(context, session);
    const cause: keyof StatementLosses | null =
      session.calendar === 'teacher'
        ? 'other'
        : session.calendar === 'holiday' || session.calendar === 'closure' || session.calendar === 'rotation'
          ? 'calendar'
          : session.calendar === null && record?.outcome === 'not-held'
            ? 'other'
            : null;
    if (queue === 'main') {
      if (cause === 'other' && session.calendar === null && credits.get(session.key) === 1) mainOther += 1;
    } else if (cause !== null) rest[cause] += 1;
    if (queue === 'td' && cause !== null) td[cause] += 1;
    if (queue !== 'main' || record === undefined || record.outcome === 'not-held') continue;
    for (const coverage of record.coverage) {
      const item = items.get(carriedId(setup.migration, coverage.item) ?? coverage.item);
      if (coverage.op === 'skipped' || item?.kind !== 'lesson') continue;
      lastResource = { ...named(item), status: complete(item) ? 'done' : 'started' };
    }
  }
  const behind = Math.round(paced.delay);
  const statement: ProgressStatement = {
    format: STATEMENT_FORMAT,
    version: { major: 1, minor: 0 },
    day: today,
    class: {
      level: schoolClass.level,
      grade: courseGrade(course, schoolClass),
      section: schoolClass.name,
      subject: course.subject,
      year: course.year,
      ...(schoolClass.stream !== undefined && { stream: schoolClass.stream }),
    },
    pack: { id: pack.release === 'own' ? pack.id.replace(/\.own-[^.]*$/u, '.own') : pack.id, release: pack.release },
    lastUnit: unit === undefined ? null : named(unit),
    lastResource,
    delay: {
      sessions: behind,
      weeks: paced.weeksBehind === null ? null : behind > 0 ? paced.weeksBehind : 0,
      bufferUsed: Math.round(paced.bufferUsed),
      bufferLeft: Math.round(paced.bufferLeft),
    },
    notHeld: {
      calendar: paced.lost.holiday + paced.lost.closure + paced.lost.rotation + rest.calendar,
      other: paced.lost.teacher + mainOther + rest.other,
    },
    td,
  };
  return readStatement(JSON.stringify(statement)).ok ? statement : null;
}
