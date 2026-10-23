// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads a country's list of appreciation phrases from parsed JSON, against its
// profile (#241, answer 465). It comes in as a file, so it is untrusted: every
// field is checked and only the format's fields are kept (PRD §5.9). The bands
// cover 0 to 20 with no gap or overlap, each with a phrase for any conduct;
// each phrase has an ID of its own, a known band, its text in Arabic and no
// banned phrase in any language, compared without diacritics, tatweel or the
// hamza on alef; and the counts that make a concern are whole numbers from 1.

import { CONDUCTS, type AppreciationBand, type AppreciationList, type AppreciationPhrase } from './appreciations.ts';
import { at, hasBidiControl, isFields, Reader, RELEASE, type Fields, type ParseResult } from './read.ts';
import type { CountryProfile } from './reference.ts';
import { CODE, COUNTRY, readName } from './reference-fields.ts';

/** Text as compared with a banned phrase: no diacritics or tatweel, alef with hamza or madda as alef, one space. */
function plain(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625]/g, '\u0627')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A number from 0 to 20, required. */
function bound(reader: Reader, raw: Fields, key: string, path: string): number | undefined {
  const value = raw[key];
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 20) return value;
  reader.fail(at(path, key), value === undefined ? 'required' : 'invalid');
  return undefined;
}

/** One band, from below to. */
function readBand(reader: Reader, raw: unknown, path: string): AppreciationBand | undefined {
  if (!isFields(raw)) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  const id = reader.requiredText(raw, 'id', path, CODE);
  const from = bound(reader, raw, 'from', path);
  const to = bound(reader, raw, 'to', path);
  if (from !== undefined && to !== undefined && from >= to) reader.fail(at(path, 'to'), 'invalid');
  if (id === '' || from === undefined || to === undefined || from >= to) return undefined;
  return { id, from, to };
}

/** One phrase, its band known and its text free of banned phrases. */
function readPhrase(
  reader: Reader,
  raw: unknown,
  path: string,
  bands: ReadonlySet<string>,
  banned: readonly string[],
): AppreciationPhrase | undefined {
  if (!isFields(raw)) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  const id = reader.requiredText(raw, 'id', path, CODE);
  const band = reader.requiredText(raw, 'band', path, CODE);
  if (band !== '' && !bands.has(band)) reader.fail(at(path, 'band'), 'unknown-reference');
  const conduct = raw['conduct'] === undefined ? undefined : reader.oneOf(raw, 'conduct', path, CONDUCTS);
  const text = readName(reader, raw, path, 'text');
  if (text !== undefined && text['ar'] === undefined) reader.fail(at(path, 'text'), 'required');
  const blocked = Object.values(text ?? {}).some((one) => banned.some((phrase) => plain(one).includes(plain(phrase))));
  if (blocked) reader.fail(at(path, 'text'), 'invalid');
  const restates = reader.flag(raw, 'restates', path);
  if (restates === false) reader.fail(at(path, 'restates'), 'invalid');
  const flagged = restates === true || raw['restates'] === undefined;
  if (id === '' || !bands.has(band) || text?.['ar'] === undefined || blocked || !flagged) return undefined;
  if (raw['conduct'] !== undefined && conduct === undefined) return undefined;
  return {
    id,
    band,
    ...(conduct !== undefined && { conduct }),
    text,
    ...(restates === true && { restates }),
  } satisfies AppreciationPhrase;
}

/** Each entry's ID once, the second and later refused as duplicates. */
function once<T extends { readonly id: string }>(reader: Reader) {
  const seen = new Set<string>();
  return (entry: T | undefined, path: string): T | undefined => {
    if (entry === undefined) return undefined;
    if (seen.has(entry.id)) {
      reader.fail(path, 'duplicate');
      return undefined;
    }
    seen.add(entry.id);
    return entry;
  };
}

/** The bands in order, from 0 to 20 with no gap or overlap; checked once every band could be read. */
function checkBands(reader: Reader, bands: readonly AppreciationBand[]): void {
  let reached = 0;
  bands.forEach((band, index) => {
    if (band.from !== reached) reader.fail(`bands[${index}].from`, 'invalid');
    reached = band.to;
  });
  if (reached !== 20) reader.fail(`bands[${bands.length - 1}].to`, 'invalid');
}

/** A banned phrase: text with letters once normalised, without hidden direction marks. */
function bannedText(reader: Reader, raw: unknown, path: string): string | undefined {
  if (typeof raw === 'string' && plain(raw) !== '' && !hasBidiControl(raw)) return raw;
  reader.fail(path, 'invalid');
  return undefined;
}

/** The counts that make a concern, each a whole number from 1. */
function readConcern(reader: Reader, input: Fields) {
  const raw = input['concern'];
  if (!isFields(raw)) {
    reader.fail('concern', raw === undefined ? 'required' : 'invalid');
    return undefined;
  }
  const absences = reader.requiredNumber(raw, 'absences', 'concern', true);
  const lateness = reader.requiredNumber(raw, 'lateness', 'concern', true);
  const behaviour = reader.requiredNumber(raw, 'behaviour', 'concern', true);
  if (absences === undefined || lateness === undefined || behaviour === undefined) return undefined;
  return { absences, lateness, behaviour };
}

/** Reads a country's appreciation list, keeping only the format's fields. */
export function parseAppreciationList(input: unknown, profile: CountryProfile): ParseResult<AppreciationList> {
  const reader = new Reader();
  if (!isFields(input)) return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  if (input['format'] !== 1) reader.fail('format', input['format'] === undefined ? 'required' : 'invalid');
  const country = reader.requiredText(input, 'country', '', COUNTRY);
  if (country !== '' && country !== profile.code) reader.fail('country', 'unknown-reference');
  const release = reader.requiredText(input, 'release', '', RELEASE);
  const interim = reader.flag(input, 'interim', '');
  if (interim === undefined && input['interim'] === undefined) reader.fail('interim', 'required');
  const source = reader.requiredText(input, 'source', '');
  const banned = reader.list(input, 'banned', '', (raw, path) => bannedText(reader, raw, path), { nonEmpty: false });
  const bandOnce = once<AppreciationBand>(reader);
  const band = (raw: unknown, path: string) => bandOnce(readBand(reader, raw, path), path);
  const rawBands = input['bands'];
  const bands = reader.list(input, 'bands', '', band, { nonEmpty: true });
  if (Array.isArray(rawBands) && bands.length === rawBands.length && bands.length > 0) checkBands(reader, bands);
  const known = new Set(bands.map((one) => one.id));
  const phraseOnce = once<AppreciationPhrase>(reader);
  const read = (raw: unknown, path: string) => phraseOnce(readPhrase(reader, raw, path, known, banned), path);
  const rawPhrases = input['phrases'];
  const phrases = reader.list(input, 'phrases', '', read, { nonEmpty: true });
  const allRead = Array.isArray(rawPhrases) && phrases.length === rawPhrases.length;
  bands.forEach((band, index) => {
    if (allRead && !phrases.some((phrase) => phrase.band === band.id && phrase.conduct === undefined)) {
      reader.fail(`bands[${index}]`, 'invalid');
    }
  });
  const concern = readConcern(reader, input);
  if (reader.problems.length > 0 || interim === undefined || concern === undefined) {
    return { ok: false, problems: reader.problems };
  }
  return { ok: true, value: { country, release, interim, source, bands, phrases, banned, concern } };
}
