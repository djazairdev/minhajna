// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isDay } from './day.ts';
import { isFields, LANGUAGE, type Fields } from './read.ts';
import type { CalendarEntry, CountryProfile, SchoolYear } from './reference.ts';
import { ENTRY_ID, PLACE } from './reference-fields.ts';

/** A small self-contained notice, not a signed release or a pupil-record format. */
export interface CalendarNotice {
  readonly format: 'minhajna.calendar-entry';
  readonly version: { readonly major: 1; readonly minor: number };
  readonly country: string;
  readonly year: string;
  readonly sender: string;
  readonly school?: { readonly name: string; readonly zone: string; readonly code?: string };
  readonly entry: Omit<CalendarEntry, 'schoolId' | 'received'>;
}

/** The file and camera paths enforce the same UTF-8 byte limit before returning text. */
export const CALENDAR_NOTICE_BYTES = 16_384;

/** Errors are fixed codes, never payload text, paths or pupil information. */
export type NoticeProblem = 'invalid' | 'version' | 'country' | 'year' | 'scope' | 'conflict' | 'acknowledge';
/** A refusal cannot carry any of the untrusted file's content. */
export class CalendarNoticeError extends Error {
  readonly problem: NoticeProblem;
  constructor(problem: NoticeProblem) {
    super(problem);
    this.name = 'CalendarNoticeError';
    this.problem = problem;
  }
}

function line(value: unknown, limit: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= limit &&
    ![...value].some((char) => {
      const point = char.codePointAt(0)!;
      return point < 32 || point === 127 || (point >= 0xd800 && point <= 0xdfff);
    })
  );
}

function codes(value: unknown, known: readonly string[]): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((one) => typeof one !== 'string' || !known.includes(one)) ||
    new Set(value).size !== value.length
  )
    throw new CalendarNoticeError('invalid');
  return value as string[];
}

function entryOf(raw: Fields, profile: CountryProfile, year: SchoolYear): CalendarNotice['entry'] {
  const { id, from, to, source, name, confidence, layer } = raw;
  if (
    typeof id !== 'string' ||
    !ENTRY_ID.test(id) ||
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    !isDay(from) ||
    !isDay(to) ||
    from > to ||
    from < year.from ||
    to > year.to ||
    !line(source, 200) ||
    !isFields(name) ||
    Object.keys(name).length === 0 ||
    Object.keys(name).length > 8 ||
    Object.entries(name).some(([key, value]) => !LANGUAGE.test(key) || !line(value, 160)) ||
    (confidence !== 'announced' && confidence !== 'expected') ||
    (layer !== 'school' && layer !== 'zone') ||
    raw['effect'] !== 'closure'
  )
    throw new CalendarNoticeError('invalid');
  for (const key of [
    'schoolId',
    'times',
    'term',
    'adds',
    'follows',
    'takes',
    'replaces',
    'rotation',
    'lunar',
    'confirmedFrom',
    'received',
  ])
    if (raw[key] !== undefined) throw new CalendarNoticeError('invalid');
  const half = raw['half'];
  if (half !== undefined && half !== 'morning' && half !== 'afternoon') throw new CalendarNoticeError('invalid');
  const zone = raw['zone'];
  if (
    layer === 'zone' ? typeof zone !== 'string' || !profile.zones?.some((one) => one.code === zone) : zone !== undefined
  )
    throw new CalendarNoticeError('scope');
  const levels = codes(
    raw['levels'],
    profile.levels.map((one) => one.code),
  );
  const grades = codes(
    raw['grades'],
    profile.levels
      .filter((one) => levels === undefined || levels.includes(one.code))
      .flatMap((one) => one.grades.map((grade) => grade.code)),
  );
  return {
    id,
    layer,
    from,
    to,
    source: source.trim(),
    name: Object.fromEntries(Object.entries(name).map(([key, value]) => [key, (value as string).trim()])),
    effect: 'closure',
    confidence,
    ...(typeof zone === 'string' && { zone }),
    ...(half !== undefined && { half }),
    ...(levels !== undefined && { levels }),
    ...(grades !== undefined && { grades }),
  };
}

function schoolOf(value: unknown, profile: CountryProfile): CalendarNotice['school'] {
  if (
    !isFields(value) ||
    !line(value['name'], 160) ||
    typeof value['zone'] !== 'string' ||
    !profile.zones?.some((one) => one.code === value['zone'])
  )
    throw new CalendarNoticeError('scope');
  const code = value['code'];
  if (code !== undefined && (typeof code !== 'string' || !PLACE.test(code))) throw new CalendarNoticeError('scope');
  return { name: value['name'].trim(), zone: value['zone'], ...(typeof code === 'string' && { code }) };
}

/** Strict allowlisting and bounded parsing; URLs, archives, private layers and signed releases are never followed. */
export function parseCalendarNotice(text: string, profile: CountryProfile, year: SchoolYear): CalendarNotice {
  if (text.length > CALENDAR_NOTICE_BYTES) throw new CalendarNoticeError('invalid');
  let bytes = 0;
  for (const char of text) {
    const point = char.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff) throw new CalendarNoticeError('invalid');
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  if (bytes > CALENDAR_NOTICE_BYTES) throw new CalendarNoticeError('invalid');
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new CalendarNoticeError('invalid');
  }
  if (!isFields(raw) || raw['format'] !== 'minhajna.calendar-entry' || !isFields(raw['version']))
    throw new CalendarNoticeError('invalid');
  const version = raw['version'];
  if (version['major'] !== 1 || !Number.isSafeInteger(version['minor']) || (version['minor'] as number) < 0)
    throw new CalendarNoticeError('version');
  if (raw['country'] !== profile.code) throw new CalendarNoticeError('country');
  if (raw['year'] !== year.id) throw new CalendarNoticeError('year');
  if (
    !line(raw['sender'], 160) ||
    !isFields(raw['entry']) ||
    raw['signature'] !== undefined ||
    raw['signed'] !== undefined ||
    raw['entries'] !== undefined
  )
    throw new CalendarNoticeError('invalid');
  const entry = entryOf(raw['entry'], profile, year);
  const school = entry.layer === 'school' ? schoolOf(raw['school'], profile) : undefined;
  if (entry.layer === 'zone' && raw['school'] !== undefined) throw new CalendarNoticeError('scope');
  return {
    format: 'minhajna.calendar-entry',
    version: { major: 1, minor: version['minor'] as number },
    country: profile.code,
    year: year.id,
    sender: raw['sender'].trim(),
    entry,
    ...(school !== undefined && { school }),
  };
}
