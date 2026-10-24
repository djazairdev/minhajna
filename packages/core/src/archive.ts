// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Minhajna archive (#248, R-3.10-19, R-5.9-01, answer 472): everything
// the teacher recorded, free, at any time, in an open format that every
// later version reads, described in docs/formats/archive.md. It holds every
// history entry exactly as it is stored, header, salt and body, so the chain
// checks again on another phone, and the bundled plan pack releases a class
// is pinned to, so a version that no longer bundles a release still reads
// it. Signed packs and calendar updates the teacher added are in the entries.
//
// The device layer, the teacher card's personal fields and the drawn
// signature, never leaves the phone (R-3.8-47), and private notes leave only
// when the teacher includes them. Their entries keep their header with no
// content and are listed as left out, so the chain still checks and a
// restore records them as erased.

import type { Day } from './day.ts';
import { ERASURE, type Entry } from './history.ts';
import { mayTravel, type Layer } from './layers.ts';
import { packKey } from './reference.ts';
import type { PlanPack } from './pack.ts';
import type { State } from './state.ts';

export const ARCHIVE_FORMAT = 'minhajna-archive';

/** The archive's version: a reader reads its own major version, and a newer minor one as far as it knows. */
export const ARCHIVE_VERSION = { major: 1, minor: 0 } as const;

/** The file the archive is kept in, inside its ZIP. */
export const ARCHIVE_FILE = 'minhajna-archive.json';

/** The kind of the entries that hold a session's private note (PRD §3.4). */
export const PRIVATE_NOTE_KIND = 'session.noted';

/** An entry as the archive holds it: its header, then its salt and body, both null when it has no content. */
export interface ArchivedEntry {
  readonly id: string;
  readonly seq: number;
  readonly day: Day;
  readonly layer: Layer;
  readonly kind: string;
  readonly digest: string;
  readonly previous: string;
  readonly hash: string;
  readonly salt: string | null;
  readonly body: unknown;
}

export interface Archive {
  readonly format: typeof ARCHIVE_FORMAT;
  readonly version: { readonly major: number; readonly minor: number };
  /** The day it was made. */
  readonly made: Day;
  /** The version of the app that made it, such as `0.5.0`. */
  readonly app: string;
  /** The country profile's ID, such as `dz`. */
  readonly country: string;
  /** The bundled calendar's release that the signed calendar updates in the entries follow. */
  readonly calendarRelease: string;
  /** Whether the teacher included the private notes. */
  readonly privateNotes: boolean;
  /** The entries whose content was left out by choice, in the history's order. */
  readonly leftOut: readonly string[];
  /** The bundled plan pack releases a class is pinned to, by ID and release. */
  readonly packs: readonly PlanPack[];
  readonly entries: readonly ArchivedEntry[];
}

export interface ArchiveOptions {
  readonly made: Day;
  readonly app: string;
  readonly country: string;
  readonly calendarRelease: string;
  readonly privateNotes: boolean;
  /** The plan packs the app bundles; signed ones the teacher added travel in the entries. */
  readonly bundledPacks: readonly PlanPack[];
}

/**
 * Whether an entry's content stays out of the archive: the device layer always, a private note unless included. An
 * erasure stays in, as it names entries only, so the entries it erased still check.
 */
export function leftOutOfArchive(entry: Pick<Entry, 'layer' | 'kind'>, privateNotes: boolean): boolean {
  if (entry.kind === ERASURE) return false;
  return !mayTravel(entry.layer, 'full-export') || (!privateNotes && entry.kind === PRIVATE_NOTE_KIND);
}

function archivedEntry(entry: Entry, leftOut: boolean): ArchivedEntry {
  const content = leftOut ? null : entry.content;
  const { id, seq, day, layer, kind, digest, previous, hash } = entry;
  return {
    id,
    seq,
    day,
    layer,
    kind,
    digest,
    previous,
    hash,
    salt: content?.salt ?? null,
    body: content?.body ?? null,
  };
}

/** The bundled releases the classes are pinned to, by key, without those the teacher added as signed files. */
function pinnedPacks(state: State, bundled: readonly PlanPack[]): PlanPack[] {
  const added = new Set(state.addedPacks.map((one) => packKey(one.update.pack.id, one.update.pack.release)));
  const pinned = new Set<string>();
  for (const course of state.courses.values())
    if (course.pack !== null) pinned.add(packKey(course.pack.id, course.pack.release));
  const byKey = new Map(bundled.map((pack) => [packKey(pack.id, pack.release), pack]));
  return [...pinned]
    .filter((key) => !added.has(key) && byKey.has(key))
    .sort()
    .map((key) => byKey.get(key)!);
}

/** The archive of a record book: its entries as stored, less what stays on the phone, and the pinned packs. */
export function archiveOf(entries: readonly Entry[], state: State, options: ArchiveOptions): Archive {
  const leftOut: string[] = [];
  const archived = entries.map((entry) => {
    const out = entry.content !== null && leftOutOfArchive(entry, options.privateNotes);
    if (out) leftOut.push(entry.id);
    return archivedEntry(entry, out);
  });
  return {
    format: ARCHIVE_FORMAT,
    version: { ...ARCHIVE_VERSION },
    made: options.made,
    app: options.app,
    country: options.country,
    calendarRelease: options.calendarRelease,
    privateNotes: options.privateNotes,
    leftOut,
    packs: pinnedPacks(state, options.bundledPacks),
    entries: archived,
  };
}

/** The archive as the text of its file, UTF-8 JSON. */
export function archiveText(archive: Archive): string {
  return JSON.stringify(archive);
}
