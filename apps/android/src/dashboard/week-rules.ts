// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's week on D-Classes' third panel tab (answer 809): the school's
// working days by the morning's and afternoon's slots, as the level's bell
// template counts them, or the middle school's where the level has none; each
// cell one of the class's subjects, or none. A subject whose teacher already
// teaches another class at that time is refused, naming that class.

import type { BellData, BookSession, SchoolBook, Slot, Weekday } from '@minhajna/core';
import { idsOf, newId } from './school-rules';

/** How many slots each half-day has for a level. */
export function slotCounts(bells: BellData, level: string): { morning: number; afternoon: number } {
  const template =
    bells.templates.find((one) => one.level === level) ?? bells.templates.find((one) => one.level === 'cem');
  return { morning: template?.morning.length ?? 5, afternoon: template?.afternoon.length ?? 4 };
}

/** Every slot of a day, the morning's then the afternoon's. */
export function slotsOf(counts: { morning: number; afternoon: number }): Slot[] {
  const of = (half: Slot['half'], count: number) => Array.from({ length: count }, (_, at) => ({ half, index: at + 1 }));
  return [...of('morning', counts.morning), ...of('afternoon', counts.afternoon)];
}

const at = (session: BookSession, weekday: Weekday, slot: Slot) =>
  session.weekday === weekday && session.slot.half === slot.half && session.slot.index === slot.index;

/** The class's session at a time, if any. */
export function sessionAt(book: SchoolBook, classId: string, weekday: Weekday, slot: Slot): BookSession | undefined {
  return book.week.find((session) => session.classId === classId && at(session, weekday, slot));
}

/** The other class whose session at that time the same teacher gives, if any. */
export function busyElsewhere(
  book: SchoolBook,
  classId: string,
  subject: string,
  weekday: Weekday,
  slot: Slot,
): string | null {
  const teacher = book.classes.find((one) => one.id === classId)?.teachers[subject];
  if (teacher === undefined) return null;
  const other = book.week.find(
    (session) =>
      session.classId !== classId &&
      at(session, weekday, slot) &&
      book.classes.find((one) => one.id === session.classId)?.teachers[session.subject] === teacher,
  );
  return other === undefined ? null : (book.classes.find((one) => one.id === other.classId)?.name ?? null);
}

/** The book with the class's cell set to a subject, or emptied. */
export function withCell(
  book: SchoolBook,
  classId: string,
  weekday: Weekday,
  slot: Slot,
  subject: string | null,
): SchoolBook {
  const week = book.week.filter((session) => !(session.classId === classId && at(session, weekday, slot)));
  if (subject === null) return { ...book, week };
  const kept = sessionAt(book, classId, weekday, slot);
  const id = kept?.id ?? newId('s', idsOf(book));
  return { ...book, week: [...week, { id, classId, subject, weekday, slot }] };
}
