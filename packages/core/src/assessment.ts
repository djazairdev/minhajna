// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Continuous assessment's components (#238, PRD §3.5, answers 430 to 438).
// Each level has official presets, kept as reference data, each for its own
// subjects or for every other: their components, their points and the range
// the teacher may set each in, out of 20, or 10 in primary. Each level's
// formulas, which its grade book averages with, are kept beside them; a
// subject with no exam yet has none. No text sets points per component, so the
// points and ranges are the curators' and the preset says so. A class and
// subject's setup is the teacher's: the preset's components weighted within
// their ranges, and columns of their own, adding up to the scale. It
// applies from the term it was saved in; an earlier term keeps the setup it
// had, and a setup keeps its components' names and the preset release it
// was made from, so marks already given keep their meaning (PRD §4.10). A
// reshaped class reads the setups of the class it continues (#231). A
// course with none uses the preset. A level can also have alternative
// formulas, such as lycée's with practical work or an oral, which a class and
// subject follows when the teacher records that the administration chose it,
// and a reshaped class keeps (#240, answer 463).

import { compareDays, type Day } from './day.ts';
import { lineageIds } from './lineage.ts';
import type { LocalizedText, SchoolYear } from './reference.ts';
import type { State } from './state.ts';

/** How a component's marks are gathered, which the setup's caption names. */
export const CAPTURES = ['session', 'homework', 'periodic', 'roll-call', 'manual'] as const;

export type Capture = (typeof CAPTURES)[number];

/** The averages' parts: continuous assessment, tests, the exam, practical work and the oral. */
export const AVERAGE_PARTS = ['T', 'F', 'E', 'P', 'O'] as const;

export type AveragePart = (typeof AVERAGE_PARTS)[number];

/** Each level's official averaging formulas, which the grade book (#240) computes. */
export const FORMULAS = [
  'primary-examined',
  'primary-exam-only',
  'cem',
  'lycee',
  'lycee-practical',
  'lycee-oral',
] as const;

export type FormulaId = (typeof FORMULAS)[number];

export interface PresetComponent {
  readonly id: string;
  readonly name: LocalizedText;
  readonly capture: Capture;
  readonly points: number;
  readonly min: number;
  readonly max: number;
}

/** A weighted average of its parts, such as CEM's ((T + F)/2 + 2E)/3 as T 1, F 1, E 4. */
export interface Formula {
  readonly level: string;
  readonly id: FormulaId;
  readonly weights: Readonly<Partial<Record<AveragePart, number>>>;
  /** The subjects it is for; absent, it is the level's formula for every other subject. */
  readonly subjects?: readonly string[];
  /** One the administration can choose for a subject in place of its level's, such as lycée's with an oral. */
  readonly alternative?: true;
}

export interface AssessmentPreset {
  readonly level: string;
  /** What the components add up to: 20, or 10 in primary. */
  readonly scale: number;
  /** The circular whose rules the preset keeps, by its number. */
  readonly circular: string;
  /** The school year whose rules the preset keeps, until the year's own circular is out. */
  readonly rulesYear: string;
  /** The subjects the preset is for; absent, every subject at the level no other preset names. */
  readonly subjects?: readonly string[];
  readonly components: readonly PresetComponent[];
  readonly source: string;
}

export interface AssessmentData {
  readonly country: string;
  readonly release: string;
  readonly presets: readonly AssessmentPreset[];
  readonly formulas: readonly Formula[];
}

/** A preset component with the teacher's points and the name it had, or a column of their own. */
export type SetupComponent =
  | { readonly kind: 'preset'; readonly id: string; readonly name: LocalizedText; readonly points: number }
  | { readonly kind: 'column'; readonly id: string; readonly name: string; readonly points: number };

export interface AssessmentSetup {
  readonly courseId: string;
  /** The term it applies from, until a later term's setup. */
  readonly term: number;
  /** The release of the presets it was made from. */
  readonly release: string;
  readonly components: readonly SetupComponent[];
  /** Whether the attendance-and-discipline component comes from the roll-call book (R-3.5-08). */
  readonly rollCall: boolean;
}

/** A column's name is at most this long. */
export const COLUMN_NAME_MAX = 40;

/** A column's points, from 1 to 10 (answer 432). */
export const COLUMN_POINTS = { min: 1, max: 10 } as const;

/** One line of a setup as the screen shows it: a preset component with its range, or a column. */
export type SetupLine =
  | (PresetComponent & { readonly kind: 'preset' })
  | {
      readonly kind: 'column';
      readonly id: string;
      readonly name: string;
      readonly points: number;
      readonly min: number;
      readonly max: number;
    };

export interface Assessment {
  readonly preset: AssessmentPreset;
  /** The saved setup in force, or null while the preset stands. */
  readonly saved: AssessmentSetup | null;
  readonly lines: readonly SetupLine[];
  readonly rollCall: boolean;
}

/** Of a level's entries, the one naming the subject, or else the one for every other subject. */
function forSubject<T extends { readonly level: string; readonly subjects?: readonly string[] }>(
  list: readonly T[],
  level: string,
  subject: string,
): T | undefined {
  const atLevel = list.filter((one) => one.level === level);
  return atLevel.find((one) => one.subjects?.includes(subject)) ?? atLevel.find((one) => one.subjects === undefined);
}

/** A subject's preset at a level; none for a subject with no continuous assessment. */
export function presetFor(data: AssessmentData, level: string, subject: string): AssessmentPreset | undefined {
  return forSubject(data.presets, level, subject);
}

/** A level's own formula for a subject, never an alternative; none for a subject with no exam yet. */
export function formulaFor(data: AssessmentData, level: string, subject: string): Formula | undefined {
  return forSubject(
    data.formulas.filter((one) => one.alternative !== true),
    level,
    subject,
  );
}

/** The formulas a subject can follow: its level's, then the alternatives for it; none without the first. */
export function formulaChoices(data: AssessmentData, level: string, subject: string): Formula[] {
  const usual = formulaFor(data, level, subject);
  if (usual === undefined) return [];
  const others = data.formulas.filter(
    (one) =>
      one.alternative === true && one.level === level && (one.subjects === undefined || one.subjects.includes(subject)),
  );
  return [usual, ...others];
}

/**
 * The formula a class and subject follows: the one recorded for it, or for the class it continues, while it is still
 * a choice, else its level's.
 */
export function courseFormula(
  state: Pick<State, 'courses' | 'classes' | 'formulas'>,
  data: AssessmentData,
  courseId: string,
): Formula | undefined {
  const course = state.courses.get(courseId);
  const room = course && state.classes.get(course.classId);
  if (course === undefined || room === undefined) return undefined;
  const choices = formulaChoices(data, room.level, course.subject);
  const recorded = lineageIds(state, courseId).flatMap((id) =>
    choices.filter((one) => one.id === state.formulas.get(id)),
  );
  return recorded[0] ?? choices[0];
}

/** The term whose dates hold the day; between terms the next, and after the last the last (answer 435). */
export function termNumberOn(year: Pick<SchoolYear, 'terms'>, day: Day): number {
  const terms = [...year.terms].sort((a, b) => compareDays(a.from, b.from));
  const next = terms.find((term) => compareDays(day, term.to) <= 0);
  return (next ?? terms.at(-1))?.number ?? 1;
}

/** One course's own setup in force for a term: the last saved for the latest term up to it. */
function ownSetup(state: Pick<State, 'assessment'>, courseId: string, term: number): AssessmentSetup | undefined {
  let found: AssessmentSetup | undefined;
  for (const setup of state.assessment.get(courseId) ?? []) {
    if (setup.term <= term && (found === undefined || setup.term >= found.term)) found = setup;
  }
  return found;
}

/** The setup in force for a term, the course's own or, for a reshaped class, the one it continues. */
export function savedSetup(
  state: Pick<State, 'assessment' | 'courses'>,
  courseId: string,
  term: number,
): AssessmentSetup | null {
  for (const id of lineageIds(state, courseId)) {
    const setup = ownSetup(state, id, term);
    if (setup !== undefined) return setup;
  }
  return null;
}

/** A name in the language asked, or else in Arabic, or else the first it has. */
export function nameIn(name: LocalizedText, language: string): string {
  return name[language] ?? name['ar'] ?? Object.values(name)[0] ?? '';
}

/** A saved setup's lines; a component the preset no longer has becomes a column with its saved name. */
function savedLines(preset: AssessmentPreset, setup: AssessmentSetup): SetupLine[] {
  return setup.components.map((component): SetupLine => {
    if (component.kind === 'column') return { ...component, ...COLUMN_POINTS };
    const known = preset.components.find((one) => one.id === component.id);
    if (known !== undefined) return { ...known, kind: 'preset', points: component.points };
    return {
      kind: 'column',
      id: component.id,
      name: nameIn(component.name, 'ar'),
      points: component.points,
      ...COLUMN_POINTS,
    };
  });
}

/** A class and subject's assessment for a term: its setup in force, or its level's preset. */
export function assessmentFor(
  state: Pick<State, 'assessment' | 'courses'>,
  preset: AssessmentPreset,
  courseId: string,
  term: number,
): Assessment {
  const saved = savedSetup(state, courseId, term);
  const lines =
    saved === null
      ? preset.components.map((component) => ({ ...component, kind: 'preset' as const }))
      : savedLines(preset, saved);
  return {
    preset,
    saved,
    lines,
    rollCall: saved?.rollCall === true && lines.some((line) => line.kind === 'preset' && line.capture === 'roll-call'),
  };
}

export function setupTotal(lines: readonly Pick<SetupLine, 'points'>[]): number {
  return lines.reduce((sum, line) => sum + line.points, 0);
}

/** Why a setup cannot be saved, or null when it can: every line in its range, and the scale reached. */
export function setupProblem(
  preset: Pick<AssessmentPreset, 'scale'>,
  lines: readonly SetupLine[],
): 'range' | 'name' | 'total' | null {
  if (lines.some((line) => !Number.isInteger(line.points) || line.points < line.min || line.points > line.max)) {
    return 'range';
  }
  const named = lines.every(
    (line) => line.kind === 'preset' || (line.name.trim() !== '' && [...line.name.trim()].length <= COLUMN_NAME_MAX),
  );
  if (!named) return 'name';
  return setupTotal(lines) === preset.scale ? null : 'total';
}

/** The setup to save from the screen's lines; the roll-call choice holds only with an attendance component. */
export function setupOf(
  courseId: string,
  term: number,
  release: string,
  lines: readonly SetupLine[],
  rollCall: boolean,
): AssessmentSetup {
  const fromRollCall = rollCall && lines.some((line) => line.kind === 'preset' && line.capture === 'roll-call');
  return {
    courseId,
    term,
    release,
    components: lines.map((line) =>
      line.kind === 'preset'
        ? { kind: 'preset', id: line.id, name: line.name, points: line.points }
        : { kind: 'column', id: line.id, name: line.name.trim(), points: line.points },
    ),
    rollCall: fromRollCall,
  };
}
