// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the Marks screens say (#238, answers 430 to 438): Algeria's presets and
// formulas, bundled and read against the profile like any file, so a refused
// file leaves the screens with nothing to offer; a course's preset, the
// formulas it can follow and the one it follows (#240, answer 463), and the
// setup in force for a term; the preset's title, naming its subjects when a
// level has several presets; each line's caption and name; the formula in
// words; how far the total is from the scale; and the Class page's line for the
// hub.

import {
  assessmentFor,
  parseAssessmentData,
  courseFormula,
  formulaChoices,
  presetFor,
  type Assessment,
  type AssessmentData,
  type AssessmentPreset,
  type CountryProfile,
  type Formula,
  type FormulaId,
  type SetupLine,
  type State,
} from '@minhajna/core';
import bundled from '@minhajna/data/dz/assessment.json';
import { subjectName } from '../extra/extra-rules';
import { termName } from '../exams/course-label';
import { levelName, localized } from '../setup/names';
import { currentLanguage, type useText } from '../text/i18n';

type Translate = ReturnType<typeof useText>;

const read = new WeakMap<CountryProfile, AssessmentData | null>();

/** The presets and formulas, read against the profile once; null when the file is refused. */
export function assessmentData(profile: CountryProfile, file: unknown = bundled): AssessmentData | null {
  const parse = () => {
    const result = parseAssessmentData(file, profile);
    return result.ok ? result.value : null;
  };
  if (file !== bundled) return parse();
  if (!read.has(profile)) read.set(profile, parse());
  return read.get(profile) ?? null;
}

export interface CourseMarks {
  readonly level: string;
  readonly subject: string;
  readonly release: string;
  /** The subject's preset; none when it has no continuous assessment. */
  readonly preset: AssessmentPreset | undefined;
  /** The formula the class and subject follows: the level's, or the one the administration chose. */
  readonly formula: Formula | undefined;
  /** The formulas it can follow, the level's first; more than one in lycée. */
  readonly choices: readonly Formula[];
  /** The setup in force for the term, or the preset's; null with no preset. */
  readonly assessment: Assessment | null;
}

/** A course's preset, formula and setup for a term; null for an unknown course. */
export function courseMarks(state: State, data: AssessmentData, courseId: string, term: number): CourseMarks | null {
  const course = state.courses.get(courseId);
  const room = course && state.classes.get(course.classId);
  if (course === undefined || room === undefined) return null;
  const preset = presetFor(data, room.level, course.subject);
  return {
    level: room.level,
    subject: course.subject,
    release: data.release,
    preset,
    formula: courseFormula(state, data, courseId),
    choices: formulaChoices(data, room.level, course.subject),
    assessment: preset === undefined ? null : assessmentFor(state, preset, courseId, term),
  };
}

const CAPTIONS = {
  session: 'marks.capture.session',
  homework: 'marks.capture.homework',
  periodic: 'marks.capture.periodic',
  'roll-call': 'marks.capture.rollCall',
  manual: 'marks.capture.manual',
} as const;

/** How a line's marks are gathered; attendance is entered by hand unless it comes from the roll-call book. */
export function captionOf(t: Translate, line: SetupLine, rollCall: boolean): string {
  if (line.kind === 'column') return t('marks.capture.column');
  if (line.capture === 'roll-call' && !rollCall) return t(CAPTIONS.manual);
  return t(CAPTIONS[line.capture]);
}

const FORMULA_TEXTS: Readonly<Record<FormulaId, string>> = {
  'primary-examined': 'marks.formula.primaryExamined',
  'primary-exam-only': 'marks.formula.examOnly',
  cem: 'marks.formula.cem',
  lycee: 'marks.formula.lycee',
  'lycee-practical': 'marks.formula.lyceePractical',
  'lycee-oral': 'marks.formula.lyceeOral',
};

/** The formula in words, or that the subject has no average yet. */
export function formulaText(t: Translate, formula: Formula | undefined): string {
  return t((formula === undefined ? 'marks.formula.none' : FORMULA_TEXTS[formula.id]) as 'marks.formula.none');
}

/** What keeps the total from the scale, in points left or over; null once it is reached. */
export function totalHint(t: Translate, scale: number, total: number): string | null {
  if (total === scale) return null;
  const points = t('marks.points', { count: Math.abs(scale - total) });
  return t(total < scale ? 'marks.left' : 'marks.over', { scale, points });
}

/** The lines as the setup screen starts them: each in its range, as the steppers need. */
export function inRange(lines: readonly SetupLine[]): SetupLine[] {
  return lines.map((line) => ({ ...line, points: Math.min(line.max, Math.max(line.min, line.points)) }));
}

/** A setup's components in short, such as «6 عناصر على 20», and whether it is the preset or the teacher's own. */
export function setupLine(t: Translate, assessment: Assessment): string {
  const parts = t('marks.components', { count: assessment.lines.length, scale: assessment.preset.scale });
  const whose =
    assessment.saved === null ? t('marks.official') : t('marks.own', { n: termName(t, assessment.saved.term) });
  return `${parts} · ${whose}`;
}

/** The Class page's line for the hub: the term and its setup, or why there is none. */
export function marksLine(t: Translate, state: State, profile: CountryProfile, courseId: string, term: number): string {
  const data = assessmentData(profile);
  if (data === null) return t('marks.unavailable');
  const assessment = courseMarks(state, data, courseId, term)?.assessment ?? null;
  return `${termWord(t, term)} · ${assessment === null ? t('marks.noAssessment') : setupLine(t, assessment)}`;
}

/** A line's name: a component's in the interface language, or the teacher's own for a column. */
export function lineName(line: SetupLine): string {
  return line.kind === 'column' ? line.name : localized(line.name);
}

/** A term's name, «الفصل الأول». */
export function termWord(t: Translate, term: number): string {
  return t('marks.term', { term: termName(t, term) });
}

/** The preset's title: its level, and the subjects it is for when it names them. */
export function presetTitle(t: Translate, profile: CountryProfile, preset: AssessmentPreset): string {
  const level = levelName(t, profile, preset.level);
  if (preset.subjects === undefined) return t('marks.presetTitle', { level });
  const join = currentLanguage() === 'ar' ? '، ' : ', ';
  const subjects = preset.subjects.map((code) => subjectName(profile, code)).join(join);
  return t('marks.presetSubjects', { level, subjects });
}
