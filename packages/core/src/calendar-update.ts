// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signed calendar updates (#223, PRD §4.5, §4.8, R-4.5-15, R-4.8-03,
// R-7.10-06, answers 303 to 306): late news, such as Ramadan announced or
// an exam window moved, as a release of the national calendar after the
// one the app was built with. An update lists the entries it adds or
// replaces, whole, and the IDs it takes out; an entry it moves keeps the
// dates it had and why. It may hold entries for every wilaya: the
// calendar picks those of the teacher's own. The updates the teacher has
// applied lie over the built-in calendar in the order of their releases,
// one for each release, so applying one twice changes nothing, and one
// that came late still lies under the later releases. An update the app
// was built with, or one before it, no longer applies.

import type { Context } from './context.ts';
import { appliesTo } from './calendar.ts';
import { readEntry } from './calendar-read.ts';
import { canonicalJson } from './canonical.ts';
import { daysBetween, type Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import { classGrades, forGrade } from './joint.ts';
import { compareReleases } from './pack-catalogue.ts';
import { at, isFields, Reader, RELEASE, type ParseResult } from './read.ts';
import type { CalendarEntry, CountryProfile, Reference, SchoolYear } from './reference.ts';
import { ENTRY_ID } from './reference-fields.ts';
import { openSigned, readVersion, type TrustedKey, type Verifier } from './signed-read.ts';

export const CALENDAR_UPDATE_FORMAT = 'minhajna.calendar-update';

/** Before any release, for reference data that does not say which calendar release it holds. */
const NO_RELEASE = '0000.0';

export interface CalendarUpdate {
  readonly country: string;
  readonly year: string;
  readonly release: string;
  /** The day the update was published. */
  readonly published: Day;
  /** The entries it adds or replaces, whole. */
  readonly entries: readonly CalendarEntry[];
  /** The IDs of the entries it takes out. */
  readonly removed: readonly string[];
}

/** A calendar update as the teacher applied it: who signed it, and the signed file, to pass on as it came. */
export interface AppliedUpdate {
  readonly update: CalendarUpdate;
  readonly key: string;
  readonly file: string;
}

/** Reads a calendar update from a signed file's payload, for the year and country the app is built for. */
export function parseCalendarUpdate(
  input: unknown,
  profile: CountryProfile,
  year: SchoolYear,
): ParseResult<CalendarUpdate> {
  const reader = new Reader();
  if (!isFields(input) || input['format'] !== CALENDAR_UPDATE_FORMAT)
    return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  if (readVersion(input['version'])?.major !== 1)
    return { ok: false, problems: [{ path: 'version', problem: 'invalid' }] };
  if (input['country'] !== profile.code) reader.fail('country', 'unknown-reference');
  if (input['year'] !== year.id) reader.fail('year', 'unknown-reference');
  const release = reader.requiredText(input, 'release', '', RELEASE);
  const published = reader.day(input, 'published', '');
  const ids = new Set<string>();
  const entries = reader.list(
    input,
    'entries',
    '',
    (raw, path) => {
      const entry = readEntry(reader, raw, path, profile, year);
      if (entry !== undefined) {
        if (ids.has(entry.id)) reader.fail(at(path, 'id'), 'duplicate');
        if (entry.layer === 'school') reader.fail(at(path, 'layer'), 'invalid');
        if (entry.from < year.from || entry.to > year.to) reader.fail(at(path, 'from'), 'invalid');
        if (entry.moved !== undefined && (entry.moved.from < year.from || entry.moved.to > year.to))
          reader.fail(at(path, 'moved'), 'invalid');
        ids.add(entry.id);
      }
      return entry;
    },
    { nonEmpty: false },
  );
  const out = input['removed'] ?? [];
  const removed = Array.isArray(out) ? out : [];
  if (!Array.isArray(out)) reader.fail('removed', 'invalid');
  removed.forEach((id: unknown, index) => {
    if (typeof id !== 'string' || !ENTRY_ID.test(id) || ids.has(id))
      reader.fail(at('removed', String(index)), 'invalid');
  });
  if (entries.length === 0 && removed.length === 0) reader.fail('entries', 'required');
  if (reader.problems.length > 0 || published === undefined) return { ok: false, problems: reader.problems };
  return {
    ok: true,
    value: { country: profile.code, year: year.id, release, published, entries, removed: removed as string[] },
  };
}

/** The applied updates newer than the built-in release, in the order of their releases, one for each release. */
export function laterUpdates(builtIn: string, applied: readonly AppliedUpdate[]): AppliedUpdate[] {
  const byRelease = new Map<string, AppliedUpdate>();
  for (const one of applied)
    if (compareReleases(one.update.release, builtIn) > 0) byRelease.set(one.update.release, one);
  return [...byRelease.values()].sort((a, b) => compareReleases(a.update.release, b.update.release));
}

function layered(entries: readonly CalendarEntry[], updates: readonly CalendarUpdate[]): Map<string, CalendarEntry> {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const update of updates) {
    for (const id of update.removed) byId.delete(id);
    for (const entry of update.entries) byId.set(entry.id, entry);
  }
  return byId;
}

/** The national calendar's entries with the applied updates laid over them, in the order of their releases. */
export function updatedCalendar(
  entries: readonly CalendarEntry[],
  builtIn: string,
  applied: readonly AppliedUpdate[],
): CalendarEntry[] {
  const updates = laterUpdates(builtIn, applied);
  return updates.length === 0
    ? [...entries]
    : [
        ...layered(
          entries,
          updates.map((one) => one.update),
        ).values(),
      ];
}

/** The reference data with the applied calendar updates laid over its calendar, and the IDs they touched. */
export function updatedReference(ref: Reference, applied: readonly AppliedUpdate[]): Reference {
  const updates = laterUpdates(ref.calendarRelease ?? NO_RELEASE, applied);
  if (updates.length === 0) return ref;
  const ids = new Set(updates.flatMap(({ update }) => [...update.removed, ...update.entries.map((entry) => entry.id)]));
  return {
    ...ref,
    calendar: [
      ...layered(
        ref.calendar,
        updates.map((one) => one.update),
      ).values(),
    ],
    updatedIds: [...ids].sort(),
  };
}

export type UpdateStatus = 'new' | 'held' | 'older';

/**
 * Whether an update can still be applied: 'new' for a release after the
 * built-in one that the teacher has not applied, even one before an update
 * already applied, since each lies in the order of its release; 'held' for
 * the built-in release or one applied; 'older' for one before the built-in.
 */
export function updateStatus(context: Context, update: CalendarUpdate): UpdateStatus {
  const order = compareReleases(update.release, context.ref.calendarRelease ?? NO_RELEASE);
  if (order < 0) return 'older';
  const held = context.state.calendarUpdates.some((one) => one.update.release === update.release);
  return order === 0 || held ? 'held' : 'new';
}

export interface UpdateChange {
  readonly kind: 'added' | 'changed' | 'removed';
  /** The entry as it will be, or as it was for one taken out. */
  readonly entry: CalendarEntry;
  /** The entry as it was before, for one changed. */
  readonly before?: CalendarEntry;
}

/**
 * What applying an update changes in the calendar as it stands. An update
 * of a release before one already applied changes only what the later ones
 * leave alone, and an entry it repeats unchanged is left out.
 */
export function updateChanges(context: Context, update: CalendarUpdate): UpdateChange[] {
  const now = new Map(context.ref.calendar.map((entry) => [entry.id, entry]));
  const later = laterUpdates(update.release, context.state.calendarUpdates).map((one) => one.update);
  const after = layered(context.ref.calendar, [update, ...later]);
  const changes: UpdateChange[] = [];
  for (const [id, entry] of after) {
    const before = now.get(id);
    if (before === undefined) changes.push({ kind: 'added', entry });
    else if (canonicalJson(before) !== canonicalJson(entry)) changes.push({ kind: 'changed', entry, before });
  }
  for (const [id, entry] of now) if (!after.has(id)) changes.push({ kind: 'removed', entry });
  return changes;
}

/**
 * Whether an applied update is what its signed file says, signed by the key
 * it names: for an update that came from another device or a backup, which
 * is checked again before it is taken in.
 */
export async function appliedUpdateHolds(
  applied: AppliedUpdate,
  keys: readonly TrustedKey[],
  verify: Verifier,
  profile: CountryProfile,
  year: SchoolYear,
): Promise<boolean> {
  const opened = await openSigned(applied.file, keys, verify);
  if (!opened.ok || opened.key.id !== applied.key || !opened.key.signs.includes('calendar')) return false;
  const read = parseCalendarUpdate(opened.payload, profile, year);
  return read.ok && canonicalJson(read.value) === canonicalJson(applied.update);
}

/** The applied updates that still lie over the calendar, in the order of their releases. */
export function appliedUpdates(context: Context): AppliedUpdate[] {
  return laterUpdates(context.ref.calendarRelease ?? NO_RELEASE, context.state.calendarUpdates);
}

/** The applied update an entry of the calendar comes from: the latest release that sets it, or none. */
export function entryUpdate(context: Context, id: string): AppliedUpdate | undefined {
  return appliedUpdates(context)
    .reverse()
    .find(({ update }) => update.entries.some((entry) => entry.id === id) || update.removed.includes(id));
}

/** Whether an entry covers one of the teacher's schools, or a grade one of their classes there teaches. */
export function concernsTeacher(context: Context, entry: CalendarEntry): boolean {
  const classes = [...context.state.classes.values()];
  return [...context.state.schools.values()].some(
    (school) =>
      appliesTo(entry, school) ||
      classes.some(
        (one) =>
          one.schoolId === school.id &&
          classGrades(one).some((grade) => appliesTo(entry, school, forGrade(one, grade))),
      ),
  );
}

/** An update's changes split into those that concern the teacher, listed, and how many others it holds. */
export function teacherChanges(context: Context, update: CalendarUpdate): { mine: UpdateChange[]; others: number } {
  const changes = updateChanges(context, update);
  const mine = changes.filter(
    (one) => concernsTeacher(context, one.entry) || (one.before !== undefined && concernsTeacher(context, one.before)),
  );
  return { mine, others: changes.length - mine.length };
}

/** The record of applying a checked update; refused unless the app can still apply it. */
export function applyCalendarUpdate(context: Context, update: CalendarUpdate, key: string, file: string): RecordEvent {
  if (updateStatus(context, update) !== 'new') throw new RangeError('Not a calendar release the app can apply');
  return { kind: 'calendar.updated', applied: { update, key, file } };
}

/** Whether an update moved an exam window less than two weeks before its new first day (R-7.10-06, answer 325). */
export function announcedLate(entry: CalendarEntry, published: Day): boolean {
  return entry.effect === 'exam' && entry.moved !== undefined && daysBetween(published, entry.from) < 14;
}

/** Whether a change gives its entry a move it did not have before, so that the move is this update's news. */
export function newMove(change: UpdateChange): boolean {
  const { entry, before } = change;
  if (change.kind === 'removed' || entry.moved === undefined) return false;
  return before?.moved === undefined || canonicalJson(before.moved) !== canonicalJson(entry.moved);
}

/** When the applied update that first gave an entry its present move was published; undefined for no such move. */
export function movePublished(context: Context, id: string): Day | undefined {
  let move: { key: string; published: Day } | undefined;
  for (const { update } of appliedUpdates(context)) {
    if (update.removed.includes(id)) move = undefined;
    const entry = update.entries.find((one) => one.id === id);
    if (entry === undefined) continue;
    const key = entry.moved === undefined ? undefined : canonicalJson(entry.moved);
    if (key !== move?.key) move = key === undefined ? undefined : { key, published: update.published };
  }
  return move?.published;
}
