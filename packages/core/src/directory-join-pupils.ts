// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A joined class's pupils (answer 808), as directory-join.ts records them: the
// registration numbers that move between the school's classes, and each
// class's new, changed, returning and gone pupils. Only a leaving a join could
// have made, for a class change or another reason, and already due, is undone
// when the school lists the pupil again; one dated later, or for a transfer,
// stays as the teacher recorded it.

import type { Pupil } from './attendance-records.ts';
import { canonicalJson } from './canonical.ts';
import { compareDays, type Day } from './day.ts';
import type { BookPupil, TeacherDelivery } from './directory-book.ts';
import type { RecordEvent } from './events.ts';
import { pendingDeparture } from './pupil-moves.ts';
import { isEnrolled } from './roll-call.ts';
import type { State } from './state.ts';

type Moves = ReturnType<typeof classMoves>;

/** Whether a record would be recorded again unchanged, whatever the order of its fields. */
export const same = (a: unknown, b: unknown) => b !== undefined && canonicalJson(a) === canonicalJson(b);

/** The reasons a join gives a leaving, which a later join may undo. */
const JOINED_REASONS: ReadonlySet<string> = new Set(['class-change', 'other']);

/** Each delivered registration number's class, each joined pupil's, and the numbers two pupils share. */
export function classMoves(
  state: State,
  delivery: TeacherDelivery,
  prefix: string,
  today: Day,
  shut: (classId: string) => boolean,
) {
  const delivered = new Map<string, string>();
  const shared = new Set<string>();
  for (const one of delivery.classes.filter((each) => !shut(each.id))) {
    for (const { registration } of one.pupils) {
      if (registration === undefined) continue;
      if (delivered.has(registration)) shared.add(registration);
      delivered.set(registration, `${prefix}c.${one.id}`);
    }
  }
  const listed = new Map<string, string>();
  for (const pupil of state.pupils.values()) {
    if (pupil.registration !== undefined && pupil.classId.startsWith(prefix) && isEnrolled(pupil, today)) {
      listed.set(pupil.registration, pupil.classId);
    }
  }
  return { delivered, listed, shared };
}

/** A class's pupils as delivered: new ones, changed ones, ones gone, and those whose leaving stands. */
export function pupilEvents(
  had: readonly Pupil[],
  classId: string,
  pupils: readonly BookPupil[],
  today: Day,
  known: boolean,
  moves: Moves,
) {
  const events: RecordEvent[] = [];
  const counts = { arriving: 0, leaving: 0, stillListed: 0 };
  const byId = new Map(had.map((pupil) => [pupil.id, pupil]));
  const delivered = new Set<string>();
  for (const one of pupils) {
    const id = `${classId}.p.${one.id}`;
    delivered.add(id);
    const before = byId.get(id);
    if (before !== undefined && !isEnrolled(before, today)) {
      counts.stillListed += 1;
      continue;
    }
    const waiting = before === undefined ? null : pendingDeparture(before);
    const due = waiting !== null && compareDays(waiting.day, today) <= 0 && JOINED_REASONS.has(waiting.reason);
    const pending = due ? waiting : null;
    if (waiting !== null && !due) counts.stillListed += 1;
    const number = one.registration;
    const usable = number !== undefined && /^\d+$/u.test(number) && !moves.shared.has(number);
    const moved = usable && (moves.listed.get(number) ?? classId) !== classId;
    const arrival = { day: today, kind: 'in' as const, reason: moved ? 'class-change' : 'transfer' };
    const pupil: Pupil = {
      groups: [],
      movements: known || moved ? [arrival] : [],
      ...before,
      id,
      classId,
      name: one.name,
      sex: one.sex,
      ...(usable && { registration: number }),
    };
    if ((before === undefined && (known || moved)) || pending !== null) counts.arriving += 1;
    if (!same(pupil, before)) events.push({ kind: 'pupil.set', pupil });
    if (pending !== null) {
      const back = { day: today, kind: 'in' as const, reason: pending.reason };
      events.push({ kind: 'pupil.moved', pupilId: id, movement: back });
    }
  }
  for (const pupil of had) {
    if (delivered.has(pupil.id) || !isEnrolled(pupil, today) || pendingDeparture(pupil) !== null) continue;
    const number = pupil.registration;
    const elsewhere = number !== undefined && !moves.shared.has(number) && moves.delivered.get(number);
    const moved = typeof elsewhere === 'string' && elsewhere !== classId;
    const movement = { day: today, kind: 'out' as const, reason: moved ? 'class-change' : 'other' };
    events.push({ kind: 'pupil.moved', pupilId: pupil.id, movement });
    counts.leaving += 1;
  }
  return { events, ...counts };
}
