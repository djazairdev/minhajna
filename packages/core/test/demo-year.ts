// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A portable, synthetic load fixture, not app setup or an import format.
// Callers supply the validated bundled reference and platform cryptography.

import {
  MemoryStore,
  RecordBook,
  addDays,
  confirmSessions,
  makeContext,
  packKey,
  parseDay,
  pupilsFor,
  rollCallUnits,
  sessionsBetween,
  takeRollCall,
  type Context,
  type Details,
  type Entry,
  type HistoryDeps,
  type Marks,
  type RecordEvent,
  type Reference,
  type RollCallUnit,
  type Session,
} from '../src/index.ts';
import { demoPack, demoSetup, type DemoLevel } from './demo-year-setup.ts';

export type { DemoLevel } from './demo-year-setup.ts';

/** Append entries to an empty isolated store, then open it with RecordBook. */
export interface DemoYear {
  readonly reference: Reference;
  readonly classId: string;
  readonly entries: readonly Entry[];
}

/** Sparse exceptions, rotating through only the pupils eligible for this unit. */
function marksFor(context: Context, unit: RollCallUnit, index: number): Marks {
  const pupils = pupilsFor(context, unit);
  const absent = pupils[index % pupils.length];
  const late = pupils[(index + 1) % pupils.length];
  if (index % 4 === 0 || absent === undefined || late === undefined) return { absent: [], late: [] };
  return { absent: [{ pupilId: absent.id, justified: index % 2 === 0 }], late: [late.id] };
}

/** Text is invented and dates are clipped to the synthetic workload's range. */
function detailsFor(session: Session, index: number, ref: Reference): Details {
  if (index % 10 !== 0) return {};
  const due = addDays(session.day, 7);
  return {
    homework: { text: 'تمرين تجريبي — exercice inventé', due: due > ref.year.to ? ref.year.to : due },
    factual: 'Invented lesson detail for load testing.',
    ...(index % 30 === 0 && { test: 'Invented revision exercise.' }),
  };
}

/** A later teaching day corrects details and attendance, keeping both versions. */
function corrections(context: Context, session: Session, unit: RollCallUnit): RecordEvent[] {
  return [
    ...confirmSessions(context, [
      {
        session,
        details: { factual: 'Corrected invented lesson detail.' },
        reason: 'Synthetic correction: detail reviewed.',
      },
    ]),
    takeRollCall(context, unit, { absent: [], late: [] }, 'Synthetic correction: roll call reviewed.'),
  ];
}

/**
 * Makes a fresh 45-pupil demo year for #77, from 21 September 2026 to
 * 8 July 2027 inclusive. All teaching sessions are confirmed, with details
 * every tenth session and later-day corrections every twentieth teaching
 * day. Every required roll-call unit is taken; holidays and exams are not.
 * The caller must use the bundled 2026/27 profile and calendar in data/dz.
 * Generation and hashing are setup work, not part of a timed load check.
 */
export async function makeDemoYear(ref: Reference, deps: HistoryDeps, level: DemoLevel = 'cem'): Promise<DemoYear> {
  if (
    ref.year.id !== '2026-2027' ||
    ref.year.from !== parseDay('2026-09-21') ||
    ref.year.to !== parseDay('2027-07-08')
  ) {
    throw new RangeError('The demo year needs the bundled 2026/27 school year');
  }
  const book = await RecordBook.open(new MemoryStore(), deps);
  await book.recordAll(ref.year.from, demoSetup(ref, level));
  const classId = level === 'cem' ? 'k-1am2' : 'k-5apb';
  const initial = makeContext(ref, book.state);
  const sessions = sessionsBetween(initial, ref.year.from, ref.year.to).filter((session) => session.calendar === null);
  const units = rollCallUnits(initial, classId, ref.year.from, ref.year.to);
  const pack = demoPack(sessions, level);
  const reference = { ...ref, packs: new Map([...ref.packs, [packKey(pack.id, pack.release), pack]]) };
  const days = [...new Set(sessions.map((session) => session.day))];
  let previousSession: Session | undefined;
  let previousUnit: RollCallUnit | undefined;
  for (const [index, day] of days.entries()) {
    const context = makeContext(reference, book.state);
    const datedSessions = sessions.filter((session) => session.day === day);
    const datedUnits = units.filter((unit) => unit.day === day);
    const events =
      (index + 1) % 20 === 0 && previousSession !== undefined && previousUnit !== undefined
        ? corrections(context, previousSession, previousUnit)
        : [];
    events.push(
      ...confirmSessions(
        context,
        datedSessions.map((session) => ({
          session,
          details: detailsFor(session, sessions.indexOf(session) + 1, reference),
        })),
      ),
    );
    events.push(...datedUnits.map((unit) => takeRollCall(context, unit, marksFor(context, unit, units.indexOf(unit)))));
    await book.recordAll(day, events);
    previousSession = datedSessions[0];
    previousUnit = datedUnits[0];
  }
  return { reference, classId, entries: [...book.entries] };
}
