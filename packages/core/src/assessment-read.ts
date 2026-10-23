// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads a country's continuous-assessment presets and averaging formulas from
// parsed JSON, against its profile (#238, answers 430, 437, 438). It comes in
// as a file, so it is untrusted: every field is checked and only the format's
// fields are kept (PRD §5.9). A preset is out of 20 or 10; each component's
// points lie in its range and add up to the scale; one component at most comes
// from the roll-call book; a level's presets share a scale. Presets and
// formulas name subjects known at their level; at a level, no subject is named
// twice and one entry at most stands for every other subject, as primary's
// music, visual arts and PE have no formula. A level's formulas have distinct
// ids, each its level's own, such as cem or lycee-oral; an alternative, which
// the administration can choose for a subject in place of its level's, is
// marked so and stands beside them (#240, answer 463). The terms whose marks
// descriptive observations replace name a known grade, a term from 1 and, if
// not every subject, subjects known at the grade's level, a grade's term naming
// each subject once, and their source (answer 464).

import {
  AVERAGE_PARTS,
  CAPTURES,
  FORMULAS,
  type AssessmentData,
  type AssessmentPreset,
  type Formula,
  type PresetComponent,
} from './assessment.ts';
import type { ObservedTerm } from './observations.ts';
import { at, isFields, Reader, RELEASE, type Fields, type ParseResult } from './read.ts';
import type { CountryProfile } from './reference.ts';
import { CODE, COUNTRY, levelCodes, readName, YEAR_ID } from './reference-fields.ts';

const SCALES = [10, 20] as const;

/** A known level, and the subjects named, which refused leave the entry out. */
function readLevel(reader: Reader, raw: Fields, path: string, profile: CountryProfile) {
  const level = reader.requiredText(raw, 'level', path);
  if (level !== '' && !levelCodes(profile).includes(level)) reader.fail(at(path, 'level'), 'unknown-reference');
  const subjects = profile.subjects.filter((subject) => subject.levels.includes(level)).map((subject) => subject.code);
  const named = reader.codes(raw, 'subjects', path, subjects, false);
  return { level, named, refused: raw['subjects'] !== undefined && named === undefined };
}

/** One component, with its points inside its range and the range inside the scale. */
function readComponent(reader: Reader, raw: unknown, path: string, scale: number | undefined) {
  if (!isFields(raw)) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  const id = reader.requiredText(raw, 'id', path, CODE);
  const name = readName(reader, raw, path);
  const capture = reader.oneOf(raw, 'capture', path, CAPTURES);
  const points = reader.requiredNumber(raw, 'points', path, true);
  const min = reader.requiredNumber(raw, 'min', path, true);
  const max = reader.requiredNumber(raw, 'max', path, true);
  if (points === undefined || min === undefined || max === undefined) return undefined;
  if (min > points || points > max || (scale !== undefined && max > scale)) reader.fail(at(path, 'points'), 'invalid');
  if (name === undefined || capture === undefined) return undefined;
  return { id, name, capture, points, min, max } satisfies PresetComponent;
}

/** Distinct components, one at most from the roll-call book, adding up to the scale. */
function readComponents(reader: Reader, raw: Fields, path: string, scale: number | undefined) {
  const read = (item: unknown, itemPath: string) => readComponent(reader, item, itemPath, scale);
  const components = reader.list(raw, 'components', path, read, { nonEmpty: true });
  const ids = components.map((component) => component.id);
  if (new Set(ids).size !== ids.length) reader.fail(at(path, 'components'), 'duplicate');
  if (components.filter((component) => component.capture === 'roll-call').length > 1) {
    reader.fail(at(path, 'components'), 'duplicate');
  }
  const total = components.reduce((sum, component) => sum + component.points, 0);
  if (scale !== undefined && total !== scale) reader.fail(at(path, 'components'), 'invalid');
  return components;
}

/** One preset, for its level's subjects it names or for every other. */
function readPreset(reader: Reader, raw: unknown, path: string, profile: CountryProfile) {
  if (!isFields(raw)) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  const { level, named, refused } = readLevel(reader, raw, path, profile);
  const scale = reader.requiredNumber(raw, 'scale', path, true);
  if (scale !== undefined && !(SCALES as readonly number[]).includes(scale)) reader.fail(at(path, 'scale'), 'invalid');
  const circular = reader.requiredText(raw, 'circular', path);
  const rulesYear = reader.requiredText(raw, 'rulesYear', path, YEAR_ID);
  const components = readComponents(reader, raw, path, scale);
  const source = reader.requiredText(raw, 'source', path);
  if (scale === undefined || refused) return undefined;
  return {
    level,
    scale,
    circular,
    rulesYear,
    ...(named !== undefined && { subjects: named }),
    components,
    source,
  } satisfies AssessmentPreset;
}

/** One formula of its level's own, its weights positive whole numbers over known parts. */
function readFormula(reader: Reader, raw: unknown, path: string, profile: CountryProfile) {
  if (!isFields(raw)) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  const { level, named, refused } = readLevel(reader, raw, path, profile);
  const id = reader.oneOf(raw, 'id', path, FORMULAS);
  if (id !== undefined && levelCodes(profile).includes(level) && id !== level && !id.startsWith(`${level}-`)) {
    reader.fail(at(path, 'id'), 'invalid');
  }
  const alternative = reader.flag(raw, 'alternative', path);
  if (alternative === false) reader.fail(at(path, 'alternative'), 'invalid');
  const weights = raw['weights'];
  const entries = isFields(weights) ? Object.entries(weights) : [];
  const valid = entries.every(
    ([part, weight]) =>
      (AVERAGE_PARTS as readonly string[]).includes(part) &&
      typeof weight === 'number' &&
      Number.isInteger(weight) &&
      weight > 0,
  );
  if (entries.length === 0 || !valid) reader.fail(at(path, 'weights'), weights === undefined ? 'required' : 'invalid');
  const flagged = alternative === true || raw['alternative'] === undefined;
  if (id === undefined || entries.length === 0 || !valid || refused || !flagged) return undefined;
  return {
    level,
    id,
    weights: Object.fromEntries(entries) as Formula['weights'],
    ...(named !== undefined && { subjects: named }),
    ...(alternative === true && { alternative }),
  } satisfies Formula;
}

interface LevelEntry {
  readonly level: string;
  readonly subjects?: readonly string[];
  readonly id?: string;
  readonly scale?: number;
  readonly alternative?: true;
}

/**
 * At each level: no subject named twice, one entry at most for every other, distinct ids, one scale; an
 * alternative only needs its own id.
 */
function levelCheck(reader: Reader) {
  const named = new Set<string>();
  const others = new Set<string>();
  const ids = new Set<string>();
  const scales = new Map<string, number>();
  return <T extends LevelEntry>(entry: T | undefined, path: string): T | undefined => {
    if (entry === undefined) return undefined;
    const alternative = entry.alternative === true;
    const subjects = alternative ? [] : (entry.subjects?.map((subject) => `${entry.level}/${subject}`) ?? []);
    const id = entry.id === undefined ? undefined : `${entry.level}/${entry.id}`;
    const clash =
      subjects.some((subject) => named.has(subject)) ||
      (!alternative && entry.subjects === undefined && others.has(entry.level)) ||
      (id !== undefined && ids.has(id));
    if (clash) reader.fail(path, 'duplicate');
    const scale = scales.get(entry.level);
    if (entry.scale !== undefined && scale !== undefined && scale !== entry.scale) {
      reader.fail(at(path, 'scale'), 'invalid');
    }
    subjects.forEach((subject) => named.add(subject));
    if (!alternative && entry.subjects === undefined) others.add(entry.level);
    if (id !== undefined) ids.add(id);
    if (entry.scale !== undefined && scale === undefined) scales.set(entry.level, entry.scale);
    return entry;
  };
}

/** A grade's term observed instead of marked, for every subject or those named. */
function readObserved(reader: Reader, raw: unknown, path: string, profile: CountryProfile) {
  if (!isFields(raw)) {
    reader.fail(path, 'invalid');
    return undefined;
  }
  const grade = reader.requiredText(raw, 'grade', path);
  const level = profile.levels.find((one) => one.grades.some((known) => known.code === grade));
  if (grade !== '' && level === undefined) reader.fail(at(path, 'grade'), 'unknown-reference');
  const term = reader.requiredNumber(raw, 'term', path, true);
  if (term !== undefined && term < 1) reader.fail(at(path, 'term'), 'invalid');
  const known = profile.subjects.filter((one) => one.levels.includes(level?.code ?? '')).map((one) => one.code);
  const named = reader.codes(raw, 'subjects', path, known, false);
  const source = reader.requiredText(raw, 'source', path);
  if (level === undefined || term === undefined || term < 1 || (raw['subjects'] !== undefined && !named)) {
    return undefined;
  }
  return { grade, term, ...(named !== undefined && { subjects: named }), source } satisfies ObservedTerm;
}

/** The observed terms, a grade's term naming each subject once and standing for every subject at most once. */
function observedCheck(reader: Reader) {
  const seen = new Map<string, Set<string> | 'all'>();
  return (entry: ObservedTerm | undefined, path: string): ObservedTerm | undefined => {
    if (entry === undefined) return undefined;
    const key = `${entry.grade}/${entry.term}`;
    const before = seen.get(key);
    const clash =
      before === 'all' ||
      (before !== undefined && (entry.subjects === undefined || entry.subjects.some((one) => before.has(one))));
    if (clash) reader.fail(path, 'duplicate');
    if (entry.subjects === undefined) seen.set(key, 'all');
    else if (before !== 'all') seen.set(key, new Set([...(before ?? []), ...entry.subjects]));
    return entry;
  };
}

/** Reads a country's assessment presets and formulas, keeping only the format's fields. */
export function parseAssessmentData(input: unknown, profile: CountryProfile): ParseResult<AssessmentData> {
  const reader = new Reader();
  if (!isFields(input)) return { ok: false, problems: [{ path: '', problem: 'invalid' }] };
  if (input['format'] !== 1) reader.fail('format', input['format'] === undefined ? 'required' : 'invalid');
  const country = reader.requiredText(input, 'country', '', COUNTRY);
  if (country !== '' && country !== profile.code) reader.fail('country', 'unknown-reference');
  const release = reader.requiredText(input, 'release', '', RELEASE);
  const presetLevels = levelCheck(reader);
  const preset = (raw: unknown, path: string) => presetLevels(readPreset(reader, raw, path, profile), path);
  const presets = reader.list(input, 'presets', '', preset, { nonEmpty: true });
  const formulaLevels = levelCheck(reader);
  const formula = (raw: unknown, path: string) => formulaLevels(readFormula(reader, raw, path, profile), path);
  const formulas = reader.list(input, 'formulas', '', formula, { nonEmpty: true });
  const observedOnce = observedCheck(reader);
  const observed = (raw: unknown, path: string) => observedOnce(readObserved(reader, raw, path, profile), path);
  const observations =
    input['observations'] === undefined
      ? undefined
      : reader.list(input, 'observations', '', observed, { nonEmpty: false });
  if (reader.problems.length > 0) return { ok: false, problems: reader.problems };
  return {
    ok: true,
    value: { country, release, presets, formulas, ...(observations !== undefined && { observations }) },
  };
}
