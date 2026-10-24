// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading a Minhajna archive (#248, R-5.9-02, answer 472). The file is
// untrusted: it is read strictly against its format, every entry's fields
// checked, no ID used twice, and its history must check as a chain. The only
// content that may be missing without an erasure is the content the archive
// lists as left out: the device layer's, or a private note's. A newer minor
// version is read as far as this one knows; a newer major one is refused.

import { ARCHIVE_FORMAT, ARCHIVE_VERSION, PRIVATE_NOTE_KIND, type Archive, type ArchivedEntry } from './archive.ts';
import { isDay } from './day.ts';
import { verifyHistory, type Digest, type Entry } from './history.ts';
import { LAYERS, mayTravel } from './layers.ts';
import { parsePlanPack, type PlanPack } from './pack.ts';
import { isFields, isOneOf } from './read.ts';
import { readVersion } from './signed-read.ts';

/** The most an archive may weigh, in UTF-16 code units, as the phone reads it whole. */
export const ARCHIVE_LIMIT = 64 * 1024 * 1024;

export const ARCHIVE_PROBLEMS = ['invalid', 'version', 'chain'] as const;

export type ArchiveProblem = (typeof ARCHIVE_PROBLEMS)[number];

export type OpenedArchive =
  | { readonly ok: true; readonly archive: Archive; readonly entries: readonly Entry[] }
  | { readonly ok: false; readonly problem: ArchiveProblem };

const FIELDS = [
  'format',
  'version',
  'made',
  'app',
  'country',
  'calendarRelease',
  'privateNotes',
  'leftOut',
  'packs',
  'entries',
];
const ENTRY_FIELDS = ['id', 'seq', 'day', 'layer', 'kind', 'digest', 'previous', 'hash', 'salt', 'body'];
const HEX = /^[0-9a-f]{64}$/;
const SALT = /^[0-9a-f]{32}$/;
const NAME = /^[A-Za-z0-9._-]{1,64}$/;

function text(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value);
}

function hasOnly(fields: Readonly<Record<string, unknown>>, known: readonly string[], loose: boolean): boolean {
  return (
    known.every((name) => Object.hasOwn(fields, name)) &&
    (loose || Object.keys(fields).every((name) => known.includes(name)))
  );
}

/** One archived entry, read strictly, as a history entry; null when a field is wrong. */
function readEntry(raw: unknown, index: number, loose: boolean): { archived: ArchivedEntry; entry: Entry } | null {
  if (!isFields(raw) || !hasOnly(raw, ENTRY_FIELDS, loose)) return null;
  const { id, seq, day, layer, kind, digest, previous, hash, salt, body } = raw;
  const header =
    text(id, NAME) &&
    seq === index &&
    typeof day === 'string' &&
    isDay(day) &&
    isOneOf(LAYERS, layer) &&
    text(kind, NAME) &&
    text(digest, HEX) &&
    (previous === '' || text(previous, HEX)) &&
    text(hash, HEX);
  if (!header) return null;
  const empty = salt === null && body === null;
  if (!empty && (!text(salt, SALT) || body === null || body === undefined)) return null;
  const head = { id, seq, day, layer, kind, digest, previous, hash };
  return {
    archived: { ...head, salt: empty ? null : salt, body: empty ? null : body },
    entry: { ...head, content: empty ? null : { salt: salt as string, body } },
  };
}

function readPacks(raw: unknown): PlanPack[] | null {
  if (!Array.isArray(raw)) return null;
  const packs: PlanPack[] = [];
  for (const one of raw) {
    const read = parsePlanPack(one);
    if (!read.ok) return null;
    packs.push(read.value);
  }
  return packs;
}

/**
 * Whether the content missing from every entry the archive lists as left out
 * may be missing: each one is listed once, has no content, and is of the
 * device layer or a private note.
 */
function leftOutHolds(leftOut: readonly string[], entries: readonly Entry[]): boolean {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return (
    new Set(leftOut).size === leftOut.length &&
    leftOut.every((id) => {
      const entry = byId.get(id);
      return (
        entry !== undefined &&
        entry.content === null &&
        (!mayTravel(entry.layer, 'full-export') || entry.kind === PRIVATE_NOTE_KIND)
      );
    })
  );
}

/** Reads an archive's text, checking its format and its history's chain with `digest`. */
export async function readArchive(input: string, digest: Digest): Promise<OpenedArchive> {
  if (input.length > ARCHIVE_LIMIT) return { ok: false, problem: 'invalid' };
  let raw: unknown;
  try {
    raw = JSON.parse(input) as unknown;
  } catch {
    return { ok: false, problem: 'invalid' };
  }
  if (!isFields(raw) || raw['format'] !== ARCHIVE_FORMAT) return { ok: false, problem: 'invalid' };
  const version = readVersion(raw['version']);
  if (version?.major !== ARCHIVE_VERSION.major) return { ok: false, problem: 'version' };
  const loose = version.minor > ARCHIVE_VERSION.minor;
  const { made, app, country, calendarRelease, privateNotes, leftOut, entries } = raw;
  const fine =
    hasOnly(raw, FIELDS, loose) &&
    typeof made === 'string' &&
    isDay(made) &&
    text(app, NAME) &&
    text(country, NAME) &&
    text(calendarRelease, NAME) &&
    typeof privateNotes === 'boolean' &&
    Array.isArray(leftOut) &&
    leftOut.every((id) => text(id, NAME)) &&
    Array.isArray(entries);
  const packs = fine ? readPacks(raw['packs']) : null;
  if (!fine || packs === null) return { ok: false, problem: 'invalid' };
  const read = (entries as unknown[]).map((one, index) => readEntry(one, index, loose));
  if (read.some((one) => one === null)) return { ok: false, problem: 'invalid' };
  const history = read.map((one) => one!.entry);
  if (new Set(history.map((entry) => entry.id)).size !== history.length) return { ok: false, problem: 'invalid' };
  if (!leftOutHolds(leftOut, history)) return { ok: false, problem: 'invalid' };
  const out = new Set(leftOut);
  const problems = await verifyHistory(digest, history);
  const kept = problems.filter((problem) => problem.kind !== 'missing-content' || !out.has(history[problem.seq]!.id));
  if (kept.length > 0) return { ok: false, problem: 'chain' };
  const archive: Archive = {
    format: ARCHIVE_FORMAT,
    version,
    made,
    app,
    country,
    calendarRelease,
    privateNotes,
    leftOut,
    packs,
    entries: read.map((one) => one!.archived),
  };
  return { ok: true, archive, entries: history };
}
