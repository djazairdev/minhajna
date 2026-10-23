// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «تصحيح بعد الفصل» works from (#243, Export-fix, answer 468): the
// term's marks a correction can change, each test with its title and day, the
// exam, lycée's practical work or oral when the formula weighs it, and each
// component, by month in primary, each with its maximum; a corrected mark's
// name, or its part's when the term no longer has it; a pupil's recorded value
// for one; a typed mark, in Western or Arabic-Indic digits with a point or a
// comma, or why it cannot be kept; a value in words; and the line that sums a
// correction up, its name isolated.

import {
  markKey,
  markProblem,
  shownMark,
  targetKey,
  termTests,
  type AssessmentData,
  type Context,
  type Day,
  type MarkFix,
  type MarkTarget,
  type MarkValue,
  type State,
} from '@minhajna/core';
import type { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { periodMonths, periodName, termLines } from './component-rules';
import { entrySheet } from './entry-rules';
import { courseMarks, lineName } from './marks-rules';

type Translate = ReturnType<typeof useText>;

/** A mark a correction can change. */
export interface FixTarget {
  /** The target as a key, such as `test:t-1`. */
  readonly key: string;
  readonly target: MarkTarget;
  /** The test's or component's name, or null for the exam, practical work or oral. */
  readonly title: string | null;
  /** The test's day, or the exam window's first day; null for a component. */
  readonly day: Day | null;
  readonly max: number;
}

const PART_WORDS = {
  component: 'marks.book.T',
  test: 'marks.book.F',
  exam: 'marks.book.E',
  practical: 'marks.book.P',
  oral: 'marks.book.O',
} as const;

const PART_TITLES = {
  exam: 'marks.entry.exam',
  practical: 'marks.entry.practical',
  oral: 'marks.entry.oral',
} as const;

/** The term's marks a correction can change, in the hub's order. */
export function fixTargets(context: Context, data: AssessmentData, courseId: string, term: number): FixTarget[] {
  const of = (sheet: ReturnType<typeof entrySheet>): FixTarget[] =>
    sheet === null
      ? []
      : [{ key: targetKey(sheet.target), target: sheet.target, title: sheet.title, day: sheet.day, max: sheet.max }];
  const formula = courseMarks(context.state, data, courseId, term)?.formula;
  const tests = termTests(context, courseId, term).flatMap((test) =>
    of(entrySheet(context, data, courseId, term, test.id)),
  );
  const exam = formula === undefined ? [] : of(entrySheet(context, data, courseId, term));
  const parts = (['practical', 'oral'] as const).flatMap((part) =>
    (formula?.weights[part === 'practical' ? 'P' : 'O'] ?? 0) > 0
      ? of(entrySheet(context, data, courseId, term, undefined, part))
      : [],
  );
  const months = periodMonths(context, courseId, term);
  const components = termLines(context, data, courseId, term).lines.flatMap((line) =>
    (months.length === 0 ? [undefined] : months).map((month): FixTarget => {
      const target: MarkTarget = { kind: 'component', componentId: line.id, ...(month !== undefined && { month }) };
      return { key: targetKey(target), target, title: lineName(line), day: null, max: line.points };
    }),
  );
  return [...components, ...tests, ...exam, ...parts];
}

/** A target's name: the test's or component's own, with its month in primary, or the exam's or part's. */
export function targetName(t: Translate, months: Parameters<typeof periodName>[1], one: FixTarget, term: number) {
  if (one.target.kind === 'component') {
    return one.target.month === undefined
      ? (one.title ?? '')
      : `${one.title ?? ''} · ${periodName(t, months, one.target, term)}`;
  }
  if (one.target.kind === 'test') return one.title ?? '';
  return t(PART_TITLES[one.target.kind]);
}

/** A corrected mark's name, or its part's word when `one`, the term's own target, is gone. */
export function fixName(
  t: Translate,
  months: Parameters<typeof periodName>[1],
  one: FixTarget | undefined,
  target: MarkTarget,
  term: number,
): string {
  return one === undefined ? t(PART_WORDS[target.kind]) : targetName(t, months, one, term);
}

/** A pupil's recorded value for a target; null when none is. */
export function recordedValue(
  state: Pick<State, 'marks'>,
  courseId: string,
  term: number,
  target: MarkTarget,
  pupilId: string,
): MarkValue | null {
  return state.marks.get(markKey({ courseId, term, target, pupilId }))?.value ?? null;
}

/** A typed mark, in either digits, a point, a comma or «٫» before its decimals, or why it cannot be kept. */
export function typedMark(text: string, max: number): { readonly value: number } | { readonly problem: string } {
  const western = text.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) & 0xf));
  const plain = western.trim().replace(/[,\u066b]/, '.');
  if (!/^\d+(\.\d{1,2})?$/.test(plain)) return { problem: 'invalid' };
  const value = Number(plain);
  const problem = markProblem(value, max);
  return problem === null ? { value } : { problem };
}

/** A value in words: two decimals, «غائب», or a dash for none. */
export function valueWord(t: Translate, value: MarkValue | null): string {
  if (value === null) return '—';
  return value === 'absent' ? t('marks.export.absent') : shownMark(value);
}

/** A correction in one line: the target, then the value before and after. */
export function fixLine(t: Translate, name: string, fix: MarkFix): string {
  return t('marks.fix.change', {
    part: isolate(name),
    from: valueWord(t, fix.before),
    to: valueWord(t, fix.mark.value),
  });
}
