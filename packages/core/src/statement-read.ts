// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Progress statement 1.0 (#436, PRD §3.10, §4.9, §5.9). `format` and `version`
// identify this public format; `day` is the issue date, never a clock time.
// `class` holds level, grade, section label, subject, year and optional stream,
// never local IDs or pupil data. `pack` identifies the pinned release (`own`
// for a teacher's list, whose ID ends in `.own`). `lastUnit` names the last
// completed main-plan unit in plan order; `lastResource` names the latest
// main-plan lesson taught, with its whole-class completion status. Either is
// null before any qualifies. Items carry only ID and title, never notes.
// `delay` holds main-plan sessions and, only for week packs, plan weeks behind
// after buffers, plus buffers used and left, as pace gives them, rounded to
// whole sessions. `notHeld` totals calendar causes and other causes; `td` is
// the TD subset, not an extra amount to add. Neither carries reasons or dates.
// Unknown fields are discarded at every level. New minor versions retain their
// number so a reader can disclose omissions; new major versions fail.

import { canonicalJson } from './canonical.ts';
import { isOneLine } from './calendar-notice-read.ts';
import { isDay, type Day } from './day.ts';
import { isFields, RELEASE, type Fields, type ParseResult } from './read.ts';
import { readVersion, utf8Length } from './signed-read.ts';

/** The versioned progress statement, before its signed envelope. */
export const STATEMENT_FORMAT = 'minhajna.statement';

/** The maximum UTF-8 size of either a statement payload or its signed file. */
export const STATEMENT_BYTES = 65_536;

/** A public plan item, with none of the teacher's lesson notes. */
export interface StatementItem {
  readonly id: string;
  readonly title: string;
}

/** Counts only: calendar includes rotation; other conceals every private cause. */
export interface StatementLosses {
  readonly calendar: number;
  readonly other: number;
}

/** The explicit allowlist shared by print, PDF, QR and reader mode. */
export interface ProgressStatement {
  readonly format: typeof STATEMENT_FORMAT;
  readonly version: { readonly major: 1; readonly minor: number };
  readonly day: Day;
  readonly class: {
    readonly level: string;
    readonly grade: string;
    readonly section: string;
    readonly subject: string;
    readonly year: string;
    readonly stream?: string;
  };
  readonly pack: { readonly id: string; readonly release: string };
  readonly lastUnit: StatementItem | null;
  readonly lastResource: (StatementItem & { readonly status: 'done' | 'started' }) | null;
  readonly delay: {
    readonly sessions: number;
    readonly weeks: number | null;
    readonly bufferUsed: number;
    readonly bufferLeft: number;
  };
  readonly notHeld: StatementLosses;
  readonly td: StatementLosses;
}

function text(raw: Fields, key: string, limit = 64): string | null {
  const value = raw[key];
  return isOneLine(value, limit) && ![...value].some((char) => char.charCodeAt(0) >= 128 && char.charCodeAt(0) <= 159)
    ? value
    : null;
}

function count(value: unknown, integer = false): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1_000_000 &&
    (!integer || Number.isSafeInteger(value))
  );
}

function losses(value: unknown): StatementLosses | null {
  return isFields(value) && count(value['calendar'], true) && count(value['other'], true)
    ? { calendar: value['calendar'], other: value['other'] }
    : null;
}

function item(value: unknown): StatementItem | null {
  if (!isFields(value)) return null;
  const id = text(value, 'id', 128);
  const title = text(value, 'title', 512);
  return id === null || title === null ? null : { id, title };
}

function statement(value: unknown): ProgressStatement | null {
  if (!isFields(value) || value['format'] !== STATEMENT_FORMAT) return null;
  const version = readVersion(value['version']);
  const day = value['day'];
  if (version?.major !== 1 || typeof day !== 'string' || !isDay(day)) return null;
  const cls = value['class'];
  const pack = value['pack'];
  const delay = value['delay'];
  if (!isFields(cls) || !isFields(pack) || !isFields(delay)) return null;
  const level = text(cls, 'level');
  const grade = text(cls, 'grade');
  const section = text(cls, 'section', 128);
  const subject = text(cls, 'subject');
  const year = text(cls, 'year');
  const stream = cls['stream'] === undefined ? undefined : text(cls, 'stream');
  const id = text(pack, 'id', 192);
  const release = text(pack, 'release');
  if (
    level === null ||
    grade === null ||
    section === null ||
    subject === null ||
    year === null ||
    stream === null ||
    id === null ||
    release === null ||
    (release !== 'own' && !RELEASE.test(release))
  )
    return null;
  const lastUnit = item(value['lastUnit']);
  const resource = value['lastResource'];
  const lastResource = item(resource);
  if (value['lastUnit'] !== null && lastUnit === null) return null;
  if (
    resource !== null &&
    (lastResource === null ||
      !isFields(resource) ||
      (resource['status'] !== 'done' && resource['status'] !== 'started'))
  )
    return null;
  const { sessions, weeks, bufferUsed, bufferLeft } = delay;
  if (
    !count(sessions, true) ||
    (weeks !== null && !count(weeks, true)) ||
    !count(bufferUsed, true) ||
    !count(bufferLeft, true)
  )
    return null;
  const notHeld = losses(value['notHeld']);
  const td = losses(value['td']);
  if (notHeld === null || td === null || td.calendar > notHeld.calendar || td.other > notHeld.other) return null;
  return {
    format: STATEMENT_FORMAT,
    version: { major: 1, minor: version.minor },
    day,
    class: { level, grade, section, subject, year, ...(stream !== undefined && { stream }) },
    pack: { id, release },
    lastUnit,
    lastResource:
      lastResource === null
        ? null
        : {
            ...lastResource,
            status: (resource as Fields)['status'] as 'done' | 'started',
          },
    delay: { sessions, weeks, bufferUsed, bufferLeft },
    notHeld,
    td,
  };
}

/** Reads untrusted JSON with bounded text and numbers, retaining only the documented fields. */
export function readStatement(text: string): ParseResult<ProgressStatement> {
  try {
    const bytes = text.length > STATEMENT_BYTES ? null : utf8Length(text);
    const value = bytes === null || bytes > STATEMENT_BYTES ? null : statement(JSON.parse(text) as unknown);
    if (value !== null) return { ok: true, value };
  } catch {
    return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  }
  return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
}

/** Canonical version-1.0 text to sign: extra runtime properties can never leave with it. */
export function statementPayload(value: ProgressStatement): string {
  let read: ParseResult<ProgressStatement>;
  try {
    read = readStatement(JSON.stringify(value));
  } catch {
    throw new TypeError('Invalid progress statement');
  }
  if (!read.ok) throw new TypeError('Invalid progress statement');
  return canonicalJson({ ...read.value, version: { major: 1, minor: 0 } });
}
