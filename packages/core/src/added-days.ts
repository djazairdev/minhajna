// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A make-up, support or revision day the school sets (PRD §4.5, §7.7,
// R-4.5-08): sessions on the timetable of a chosen weekday, on a day of the
// school year, even a Saturday or a holiday. The teacher picks which of that
// weekday's sessions the day takes, so an A or B slot is never guessed, and
// they are kept by course, slot, group and A or B week, so a redrawn week keeps them. It
// is an entry of the school's layer, kept with the teacher's own entries.
// A make-up day can name the closure it makes up for; the closure's
// sessions stay lost to the calendar, as recorded, and the make-up sessions
// are new plan sessions. A day can never put two sessions in one slot.

import type { Context } from './context.ts';
import { compareDays, isWithin, type Day, type Weekday } from './day.ts';
import type { RecordEvent } from './events.ts';
import type { ClockSpan } from './bells.ts';
import type { ExtraSession } from './extra-records.ts';
import { compareSlots, slotKey, type TimetableEntry } from './records.ts';
import { ADDED_KINDS, type AddedKind, type CalendarEntry, type LocalizedText } from './reference.ts';
import { addedSessions, sessionsBetween, takeKey, versionOn, type Session } from './sessions.ts';

/** The longest source, in characters. */
export const SOURCE_MAX = 200;

export interface AddedDay {
  readonly id: string;
  readonly schoolId: string;
  readonly day: Day;
  readonly adds: AddedKind;
  readonly follows: Weekday;
  /** The weekday's sessions it takes, as `takeKey` gives them. */
  readonly takes: readonly string[];
  readonly replaces?: string;
  readonly name: LocalizedText;
  readonly source: string;
  readonly confidence: 'announced' | 'expected';
}

export interface FollowedEntry {
  readonly entry: TimetableEntry;
  /** The session as a day takes it: `takeKey` of the entry. */
  readonly take: string;
  /** Every week, or the A or B week that holds the day. */
  readonly inWeek: boolean;
}

/**
 * The timetable entries of the weekday `follows` at a school, from the
 * timetable in force on `day`, in slot order: what a day following it can take.
 */
export function followedEntries(context: Context, schoolId: string, day: Day, follows: Weekday): FollowedEntry[] {
  const { state, calendar } = context;
  const school = state.schools.get(schoolId);
  const version = versionOn(state.timetables, day);
  if (school === undefined || version === null) return [];
  const parity = calendar.parityOn(day, school);
  return version.entries
    .filter((entry) => {
      const course = state.courses.get(entry.courseId);
      return entry.weekday === follows && state.classes.get(course?.classId ?? '')?.schoolId === schoolId;
    })
    .sort((a, b) => compareSlots(a.slot, b.slot) || (a.id < b.id ? -1 : 1))
    .map((entry) => ({ entry, take: takeKey(entry), inWeek: entry.weeks === 'every' || entry.weeks === parity }));
}

/** The school's closures that started on or before `day`, latest first: what a make-up day can make up for. */
export function closuresBefore(context: Context, schoolId: string, day: Day): CalendarEntry[] {
  const school = context.state.schools.get(schoolId);
  if (school === undefined) return [];
  return context.calendar
    .entriesFor(school)
    .filter((entry) => entry.effect === 'closure' && compareDays(entry.from, day) <= 0)
    .sort((a, b) => compareDays(b.from, a.from));
}

/**
 * The event that adds the day, or corrects one added before under the same
 * ID. The day is in the school year; the weekday is a working day; the
 * sessions are that weekday's at the school; none falls in a slot the
 * teacher already teaches that day. The error messages name no class.
 */
export function addSessionsDay(context: Context, added: AddedDay): RecordEvent {
  const { ref, state } = context;
  const school = state.schools.get(added.schoolId);
  if (school === undefined) throw new RangeError('No such school');
  if (!ADDED_KINDS.includes(added.adds)) throw new RangeError('Unknown kind of day');
  if (!isWithin(added.day, ref.year.from, ref.year.to)) throw new RangeError('The day is outside the school year');
  if (!ref.country.workingDays.includes(added.follows)) throw new RangeError('The timetable followed is a working day');
  const followed = followedEntries(context, added.schoolId, added.day, added.follows).map((one) => one.entry);
  const chosen = [...new Set(added.takes)].map((take) => followed.find((entry) => takeKey(entry) === take));
  if (chosen.length === 0) throw new RangeError('The day takes at least one session');
  if (chosen.includes(undefined)) throw new RangeError("A session is not on that weekday's timetable");
  const slots = chosen.flatMap((entry) => (entry === undefined ? [] : [slotKey(entry.slot)]));
  const busy = busySlots(context, added.day, added.id);
  if (new Set(slots).size !== slots.length || slots.some((slot) => busy.has(slot))) {
    throw new RangeError('Two sessions would fall in one slot');
  }
  if (added.replaces !== undefined) {
    if (added.adds !== 'make-up') throw new RangeError('Only a make-up day replaces a closure');
    const closure = closuresBefore(context, added.schoolId, added.day).find((entry) => entry.id === added.replaces);
    if (closure === undefined) throw new RangeError('No such closure before the day');
  }
  const source = added.source.trim();
  if (source === '' || source.length > SOURCE_MAX) throw new RangeError('The source is one line of text');
  return { kind: 'calendar.set', entry: addedEntry({ ...added, source }) };
}

/** The calendar entry a day that adds sessions is, unchecked: what the screen shows before saving. */
export function addedEntry(added: AddedDay): CalendarEntry {
  return {
    id: added.id,
    layer: 'school',
    schoolId: added.schoolId,
    from: added.day,
    to: added.day,
    effect: 'adds-sessions',
    adds: added.adds,
    follows: added.follows,
    takes: [...new Set(added.takes)],
    ...(added.replaces !== undefined && { replaces: added.replaces }),
    name: added.name,
    source: added.source,
    confidence: added.confidence,
  };
}

/**
 * The slots the teacher already teaches or has a catch-up or support session
 * at on `day`, apart from the day `exceptId`, as `slotKey`s.
 */
export function busySlots(context: Context, day: Day, exceptId?: string): Set<string> {
  const taught = sessionsBetween(context, day, day).filter(
    (session) => session.calendar === null && (exceptId === undefined || session.added !== exceptId),
  );
  const supported = addedSessions(context, day, day, ['support', 'revision'])
    .map((one) => one.session)
    .filter((session) => session.calendar === null && session.added !== exceptId);
  const scheduled = [...context.state.catchUps.values()].filter((catchUp) => catchUp.day === day);
  return new Set([...taught, ...supported, ...scheduled].map((one) => slotKey(one.slot)));
}

/** The event that takes back a day the teacher added; the history keeps it. */
export function removeAddedDay(context: Context, id: string): RecordEvent {
  const entry = context.state.calendar.find((one) => one.id === id && one.effect === 'adds-sessions');
  if (entry === undefined) throw new RangeError('No such day');
  return { kind: 'calendar.removed', id, layer: entry.layer };
}

/**
 * The sessions of support and revision days from `from` to `to` that the
 * calendar leaves, as rows for the texts book's page for additional lessons,
 * timed by `timeOf` from the bells; a session with no time is left out.
 */
export function supportDayRows(
  context: Context,
  from: Day,
  to: Day,
  timeOf: (session: Session) => ClockSpan | null,
): ExtraSession[] {
  return addedSessions(context, from, to, ['support', 'revision']).flatMap(({ session, kind }) => {
    const time = session.calendar === null ? timeOf(session) : null;
    if (time === null) return [];
    const row: ExtraSession = {
      id: session.key,
      courseId: session.courseId,
      kind: kind === 'support' ? 'support' : 'review',
      day: session.day,
      from: time.from,
      to: time.to,
    };
    return [row];
  });
}
