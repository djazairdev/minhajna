// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The world's calendar in a demo world (#608, §4.5, §7.10, choice D4, answers
// 568, 572 and 624). The Ministry's draft becomes an update, the release after
// the latest the world holds, published on the world's date, signed with the
// world's key as a file naming the world, and no heavier than a signed
// calendar update may be. The files travel on one stream of the world's
// national space, under a key derived from the world's secret, so only devices
// holding the code read them; each is kept when it opens with a world key that
// signs calendars and names this world, reads as an update of the world's
// country and year, and is after the bundled release, the first for each
// release counting. The world's calendar is the bundled one with those updates
// laid over it in the order of their releases, and its announced days are the
// later terms' ends and each exam window's first day, in any layer, after the
// world's date, as that calendar gives them. A publisher checks that the
// update counting for its release is its own, since two devices may publish
// the same release and the first put counts. A file that names a world, or is
// signed with a world's key, is told apart so real mode can say why it refuses
// it.

import { compareDays, type Day } from './day.ts';
import type { CalendarDraft } from './device-events.ts';
import {
  CALENDAR_UPDATE_FORMAT,
  layeredCalendar,
  parseCalendarUpdate,
  type CalendarUpdate,
} from './calendar-update.ts';
import { canonicalJson } from './canonical.ts';
import { compareReleases } from './pack-catalogue.ts';
import { keySigns } from './pack-update.ts';
import { RELEASE } from './read.ts';
import type { CalendarEntry, CountryProfile, SchoolYear } from './reference.ts';
import { openRecords, placeOf, sealRecord, type Place } from './sealed-stream.ts';
import type { SealedBatch } from './batches.ts';
import {
  openSigned,
  SIGNED_BYTES,
  utf8Length,
  WORLD_KEY_PREFIX,
  type TrustedKey,
  type Verifier,
} from './signed-read.ts';
import { worldSignedFile, type WorldCipher, type WorldKeys, type WorldMac, type WorldSigner } from './world-keys.ts';

/** The most batches one signed file takes on the stream, its characters past ASCII escaped. */
export const WORLD_CALENDAR_BATCHES = 16;

/** The release after one, such as `2026.4` after `2026.3`; a release that does not read is a RangeError. */
export function nextRelease(release: string): string {
  if (!RELEASE.test(release)) throw new RangeError('Not a release');
  const [year = '0', fix = '0'] = release.split('.');
  return `${year}.${Number(fix) + 1}`;
}

/** The update a draft makes, as the release after the latest, published on the world's date. */
export function draftUpdate(
  draft: CalendarDraft,
  profile: Pick<CountryProfile, 'code'>,
  year: Pick<SchoolYear, 'id'>,
  latest: string,
  published: Day,
): CalendarUpdate {
  return {
    country: profile.code,
    year: year.id,
    release: nextRelease(latest),
    published,
    entries: draft.entries,
    removed: draft.removed,
  };
}

/** An update as the payload of a signed file. */
export function updatePayload(update: CalendarUpdate): string {
  return JSON.stringify({ format: CALENDAR_UPDATE_FORMAT, version: { major: 1, minor: 0 }, ...update });
}

/** The update signed with a world's key as a file naming the world; refused when heavier than one may be. */
export async function worldCalendarFile(
  keys: WorldKeys,
  key: string,
  update: CalendarUpdate,
  sign: WorldSigner,
): Promise<string> {
  const file = await worldSignedFile(keys, key, updatePayload(update), sign);
  if ((utf8Length(file) ?? Infinity) > SIGNED_BYTES) throw new RangeError('An update this heavy cannot travel');
  return file;
}

/** Where the world's calendar travels: a stream of its national space, sealed under its secret. */
export function worldCalendarPlace(sealing: Uint8Array, mac: WorldMac): Promise<Place> {
  return placeOf(sealing, 'world-calendar', mac);
}

/** A signed file's batches on the world's calendar stream, numbered from `first`. */
export function sealWorldCalendar(
  place: Place,
  file: string,
  first: number,
  cipher: WorldCipher,
): Promise<SealedBatch[]> {
  return sealRecord(place, { file }, first, WORLD_CALENDAR_BATCHES, cipher);
}

/** The signed files on the world's calendar stream, as they were put. */
export async function worldCalendarFiles(
  place: Place,
  batches: readonly SealedBatch[],
  cipher: WorldCipher,
): Promise<string[]> {
  const records = await openRecords(place, batches, WORLD_CALENDAR_BATCHES, cipher);
  return records.flatMap((one) => {
    const file = (one as { file?: unknown } | null)?.file;
    return typeof file === 'string' ? [file] : [];
  });
}

/** The updates of the files that open with the world's keys, after the bundled release, one for each release. */
export async function worldCalendarUpdates(
  files: readonly string[],
  world: { readonly world: string; readonly trusted: readonly TrustedKey[] },
  verify: Verifier,
  calendar: { readonly release: string; readonly year: SchoolYear },
  profile: CountryProfile,
): Promise<CalendarUpdate[]> {
  const byRelease = new Map<string, CalendarUpdate>();
  for (const file of files) {
    const opened = await openSigned(file, world.trusted, verify, SIGNED_BYTES, world.world);
    if (!opened.ok || !keySigns(opened.key, 'calendar')) continue;
    const read = parseCalendarUpdate(opened.payload, profile, calendar.year);
    if (!read.ok || compareReleases(read.value.release, calendar.release) <= 0) continue;
    if (!byRelease.has(read.value.release)) byRelease.set(read.value.release, read.value);
  }
  return [...byRelease.values()].sort((a, b) => compareReleases(a.release, b.release));
}

/** The bundled entries with the updates laid over them, and the latest release the world holds. */
export function worldCalendar(
  entries: readonly CalendarEntry[],
  release: string,
  updates: readonly CalendarUpdate[],
): { readonly entries: CalendarEntry[]; readonly release: string } {
  const later = updates
    .filter((update) => compareReleases(update.release, release) > 0)
    .sort((a, b) => compareReleases(a.release, b.release));
  const latest = later.at(-1)?.release ?? release;
  return { entries: [...layeredCalendar(entries, later).values()], release: latest };
}

/** Whether the update that counts for its release is this one, as its publisher checks once it is put. */
export function updateCounts(updates: readonly CalendarUpdate[], update: CalendarUpdate): boolean {
  const counting = updates.find((one) => one.release === update.release);
  return counting !== undefined && canonicalJson(counting) === canonicalJson(update);
}

/** The announced days after a date: the later terms' ends and each exam window's first day, in any layer. */
export function announcedDaysOf(year: SchoolYear, entries: readonly CalendarEntry[], date: Day): Day[] {
  const ends = year.terms.slice(1).map((term) => term.to);
  const exams = entries.filter((entry) => entry.effect === 'exam').map((entry) => entry.from);
  return [...new Set([...ends, ...exams])].filter((day) => compareDays(day, date) > 0).sort(compareDays);
}

/** Whether a signed file names a world or is signed with a world's key, which real mode refuses. */
export function namesWorld(text: string): boolean {
  try {
    const raw = JSON.parse(text) as { world?: unknown; key?: unknown } | null;
    return raw?.world !== undefined || (typeof raw?.key === 'string' && raw.key.startsWith(WORLD_KEY_PREFIX));
  } catch {
    return false;
  }
}
