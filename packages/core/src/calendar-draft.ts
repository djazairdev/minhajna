// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's draft of a calendar update in a demo world (#607, §4.5, §7.10,
// R-4.5-18, R-7.10-06, answer 623): the entries it adds or changes, whole, and
// the IDs of the release's entries it takes out, laid over the world's calendar
// as an update is. Changing the days of an entry of the release keeps the days
// it had and why, as an update's moved entry; setting them back keeps what the
// entry had; a change that leaves an entry as the release has it drops out of
// the draft. Taking out a new entry drops it, and taking out one of the release
// lists it. A draft is read as a calendar update without its release and day,
// by the reader of signed updates, so a draft that reads could not fail to
// publish; it must also keep each changed entry's layer and wilaya, give a new
// or changed effect only among those the editor offers, an exam window its term
// and no other effect one, name a new entry in Arabic, with French and English
// if given, keep what the editor does not show, such as an exam's grades or
// Ramadan's times, as the release has it, or drop it with a change of effect,
// give a new entry none of it, take out only the release's national and wilaya
// entries, keep names, sources and reasons short and on one line, and weigh,
// signed, no more than a signed calendar update may. The draft is kept in the
// world's store on the Ministry's PC; the latest kept counts, and is set aside
// when it no longer reads against the world's calendar. Nothing here sends it.

import { SOURCE_MAX } from './added-days.ts';
import { canonicalJson } from './canonical.ts';
import { CALENDAR_UPDATE_FORMAT, parseCalendarUpdate } from './calendar-update.ts';
import type { CalendarDraft } from './device-events.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import { toHex, type RandomBytes } from './id.ts';
import type { ParseProblem } from './read.ts';
import { SIGNED_BYTES, SIGNED_FORMAT, utf8Length } from './signed-read.ts';
import { WORLD_ID_LENGTH } from './world-code.ts';
import type { CalendarEffect, CalendarEntry, CountryProfile, SchoolYear } from './reference.ts';

export type { CalendarDraft } from './device-events.ts';

/** A draft with nothing in it. */
export const EMPTY_DRAFT: CalendarDraft = { entries: [], removed: [] };
/** The effects a new or changed entry may take: a holiday, a closure, an exam window and a marker. */
export const DRAFT_EFFECTS = ['no-school', 'closure', 'exam', 'marker'] as const satisfies readonly CalendarEffect[];
/** The most characters of an entry's name in one language. */
export const DRAFT_NAME_MOST = 120;
/** The most characters of the reason an entry's days moved. */
export const DRAFT_REASON_MOST = 300;
/** The most entries a draft adds, changes or takes out. */
export const DRAFT_MOST = 128;

/** What the draft does to an entry: adds it, changes it, takes it out, or nothing. */
export type DraftMark = 'new' | 'changed' | 'removed' | null;

const same = (a: unknown, b: unknown) => canonicalJson(a ?? null) === canonicalJson(b ?? null);
const moves = (was: CalendarEntry, entry: CalendarEntry) => entry.from !== was.from || entry.to !== was.to;

/** A new entry's ID, made up at random. */
export function newDraftId(random: RandomBytes): string {
  return `world-${toHex(random(8))}`;
}

/** The world's calendar with the draft laid over it, as an update would lay it. */
export function draftedCalendar(base: readonly CalendarEntry[], draft: CalendarDraft): CalendarEntry[] {
  const byId = new Map(base.map((entry) => [entry.id, entry]));
  for (const id of draft.removed) byId.delete(id);
  for (const entry of draft.entries) byId.set(entry.id, entry);
  return [...byId.values()];
}

/** What the draft does to the entry with this ID. */
export function draftMark(base: readonly CalendarEntry[], draft: CalendarDraft, id: string): DraftMark {
  if (draft.removed.includes(id)) return 'removed';
  if (!draft.entries.some((entry) => entry.id === id)) return null;
  return base.some((entry) => entry.id === id) ? 'changed' : 'new';
}

/**
 * The draft with the entry added or changed. Changing the days of an entry of
 * the release needs the reason, which its moved days keep; otherwise it keeps
 * the release's own moved days, if any.
 */
export function setDraftEntry(
  base: readonly CalendarEntry[],
  draft: CalendarDraft,
  entry: CalendarEntry,
  reason = '',
): CalendarDraft {
  const was = base.find((one) => one.id === entry.id);
  const kept: { -readonly [K in keyof CalendarEntry]: CalendarEntry[K] } = { ...entry };
  delete kept.moved;
  if (was !== undefined && moves(was, entry)) {
    const why = reason.trim();
    if (why === '' || why.length > DRAFT_REASON_MOST || /[\r\n]/u.test(why))
      throw new RangeError('A moved entry needs its reason, on one line');
    kept.moved = { from: was.from, to: was.to, reason: why };
  } else if (was?.moved !== undefined) {
    kept.moved = was.moved;
  }
  const others = draft.entries.filter((one) => one.id !== entry.id);
  const removed = draft.removed.filter((id) => id !== entry.id);
  return { entries: was !== undefined && same(kept, was) ? others : [...others, kept], removed };
}

/** The draft with the entry taken out: a new one dropped, one of the release listed. */
export function takeOutDraftEntry(base: readonly CalendarEntry[], draft: CalendarDraft, id: string): CalendarDraft {
  const entries = draft.entries.filter((one) => one.id !== id);
  const listed = base.some((one) => one.id === id) && !draft.removed.includes(id);
  return { entries, removed: listed ? [...draft.removed, id] : draft.removed };
}

/** The draft without any change to the entry, which then reads as the release has it, or not at all. */
export function undoDraftEntry(draft: CalendarDraft, id: string): CalendarDraft {
  return { entries: draft.entries.filter((one) => one.id !== id), removed: draft.removed.filter((one) => one !== id) };
}

const NAMES = ['ar', 'fr', 'en'];
/** What the editor neither shows nor offers on a new entry, which a change keeps as the release has it. */
const HIDDEN = ['grades', 'times', 'hours', 'lunar', 'adds', 'follows', 'replaces'] as const;

function entryProblems(entry: CalendarEntry, was: CalendarEntry | undefined, fail: (key: string) => void) {
  const names = Object.keys(entry.name);
  const known = was === undefined ? NAMES : [...NAMES, ...Object.keys(was.name)];
  if (names.some((one) => !known.includes(one)) || (entry.name['ar'] === undefined && was?.name['ar'] !== undefined))
    fail('name');
  if (Object.values(entry.name).some((text) => text.length > DRAFT_NAME_MOST)) fail('name');
  if (was === undefined && entry.name['ar'] === undefined) fail('name');
  if (entry.source.length > SOURCE_MAX || /[\r\n]/u.test(entry.source)) fail('source');
  if (entry.effect !== was?.effect && !(DRAFT_EFFECTS as readonly string[]).includes(entry.effect)) fail('effect');
  const keepsTerm = was !== undefined && entry.effect === was.effect && entry.term === was.term;
  if (!keepsTerm && (entry.effect === 'exam') !== (entry.term !== undefined)) fail('term');
  for (const key of HIDDEN) {
    const kept =
      was !== undefined && (same(entry[key], was[key]) || (entry.effect !== was.effect && entry[key] === undefined));
    if (entry[key] !== undefined ? !kept : was !== undefined && !kept) fail(key);
  }
  if (entry.moved !== undefined && /[\r\n]/u.test(entry.moved.reason)) fail('moved');
  if (was === undefined) {
    if (entry.moved !== undefined) fail('moved');
    return;
  }
  if (entry.layer !== was.layer || entry.zone !== was.zone) fail('layer');
  const moved = moves(was, entry)
    ? entry.moved?.from === was.from && entry.moved.to === was.to
    : same(entry.moved, was.moved);
  if (!moved) fail('moved');
}

function scopeProblems(base: readonly CalendarEntry[], entries: readonly CalendarEntry[], removed: readonly string[]) {
  const problems: ParseProblem[] = [];
  entries.forEach((entry, at) => {
    const was = base.find((one) => one.id === entry.id);
    entryProblems(entry, was, (key) => {
      const path = `entries[${at}].${key}`;
      if (!problems.some((one) => one.path === path)) problems.push({ path, problem: 'invalid' });
    });
  });
  removed.forEach((id, at) => {
    const was = base.find((one) => one.id === id);
    if (was?.layer !== 'national' && was?.layer !== 'zone')
      problems.push({ path: `removed.${at}`, problem: 'invalid' });
  });
  return problems;
}

/**
 * The UTF-8 bytes of the draft as a signed calendar update at its largest:
 * the longest key ID, a world named and the longest signature, with a release
 * of up to six digits after its year unless the one to sign is given.
 */
export function draftBytes(
  draft: CalendarDraft,
  profile: CountryProfile,
  year: SchoolYear,
  release = '9999.999999',
): number {
  const payload = JSON.stringify({
    format: CALENDAR_UPDATE_FORMAT,
    version: { major: 1, minor: 0 },
    country: profile.code,
    year: year.id,
    release,
    published: year.to,
    entries: draft.entries,
    removed: draft.removed,
  });
  const file = JSON.stringify({
    format: SIGNED_FORMAT,
    version: { major: 1, minor: 0 },
    key: 'k'.repeat(40),
    world: 'w'.repeat(WORLD_ID_LENGTH),
    payload,
    signature: 'A'.repeat(200),
  });
  return utf8Length(file) ?? Infinity;
}

/**
 * The draft as the reader of signed updates reads it, against the world's
 * calendar: its entries as read, or the problems found, none for an empty one.
 */
export function readCalendarDraft(
  value: unknown,
  base: readonly CalendarEntry[],
  profile: CountryProfile,
  year: SchoolYear,
): { readonly draft: CalendarDraft } | { readonly problems: readonly ParseProblem[] } {
  const fields = value as { entries?: unknown; removed?: unknown } | null;
  const invalid = { problems: [{ path: '', problem: 'invalid' as const }] };
  if (
    typeof fields !== 'object' ||
    fields === null ||
    Object.keys(fields).some((key) => !['entries', 'removed'].includes(key))
  )
    return invalid;
  const { entries, removed } = fields;
  if (!Array.isArray(entries) || !Array.isArray(removed) || entries.length + removed.length > DRAFT_MOST)
    return invalid;
  if (entries.length === 0 && removed.length === 0) return { draft: EMPTY_DRAFT };
  const read = parseCalendarUpdate(
    {
      format: CALENDAR_UPDATE_FORMAT,
      version: { major: 1, minor: 0 },
      country: profile.code,
      year: year.id,
      release: '0000.0',
      published: year.from,
      entries,
      removed,
    },
    profile,
    year,
  );
  if (!read.ok) return { problems: read.problems };
  const problems = scopeProblems(base, read.value.entries, read.value.removed);
  if (problems.length > 0) return { problems };
  const draft = { entries: read.value.entries, removed: read.value.removed };
  return draftBytes(draft, profile, year) > SIGNED_BYTES
    ? { problems: [{ path: 'size', problem: 'invalid' }] }
    : { draft };
}

/** The draft kept last in the world's store, set aside, as empty, when it no longer reads. */
export function keptCalendarDraft(
  entries: readonly Entry[],
  base: readonly CalendarEntry[],
  profile: CountryProfile,
  year: SchoolYear,
): { readonly draft: CalendarDraft; readonly setAside: boolean } {
  let last: unknown = null;
  for (const entry of entries) {
    const event = eventOf(entry);
    if (event?.kind === 'ministry.calendar') last = event.draft;
  }
  if (last === null) return { draft: EMPTY_DRAFT, setAside: false };
  const read = readCalendarDraft(last, base, profile, year);
  return 'draft' in read ? { draft: read.draft, setAside: false } : { draft: EMPTY_DRAFT, setAside: true };
}
