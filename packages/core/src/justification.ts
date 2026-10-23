// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the justification of a continuous-assessment mark adds up (#239,
// Marks-pupil, answers 443 and 454): each component's mark for a pupil in a
// period, the term or a month of it; T, their sum, once every component has
// one, else how many are still empty; and the term average by the level's
// formula, Σ weight × part ÷ Σ weights, once every part it weighs has one.

import type { AveragePart, Formula, SetupLine } from './assessment.ts';
import { marksFor, type MarkTarget } from './marks.ts';
import type { State } from './state.ts';

export interface ComponentMark {
  readonly line: SetupLine;
  /** The mark, or null while the cell is empty; a mark above points since lowered counts as empty. */
  readonly mark: number | null;
}

export interface ComponentTotal {
  readonly marks: readonly ComponentMark[];
  /** T, the sum of the marks once every component has one; null before. */
  readonly total: number | null;
  readonly empty: number;
}

/** A pupil's component marks in a period, and T. */
export function componentTotal(
  state: Pick<State, 'marks'>,
  courseId: string,
  term: number,
  lines: readonly SetupLine[],
  pupilId: string,
  month?: string,
): ComponentTotal {
  const marks = lines.map((line): ComponentMark => {
    const target: MarkTarget = { kind: 'component', componentId: line.id, ...(month !== undefined && { month }) };
    const value = marksFor(state, courseId, term, target).get(pupilId);
    return { line, mark: typeof value === 'number' && value <= line.points ? value : null };
  });
  const empty = marks.filter((one) => one.mark === null).length;
  const sum = marks.reduce((all, one) => all + (one.mark ?? 0), 0);
  return { marks, total: empty === 0 && marks.length > 0 ? Math.round(sum * 100) / 100 : null, empty };
}

/** The term average by a formula; null when a part it weighs has none. */
export function termAverage(
  formula: Pick<Formula, 'weights'>,
  parts: Readonly<Partial<Record<AveragePart, number | null>>>,
): number | null {
  const weighed = Object.entries(formula.weights).filter(([, weight]) => (weight ?? 0) > 0) as [AveragePart, number][];
  if (weighed.length === 0) return null;
  let sum = 0;
  let weights = 0;
  for (const [part, weight] of weighed) {
    const value = parts[part];
    if (value === null || value === undefined) return null;
    sum += weight * value;
    weights += weight;
  }
  return sum / weights;
}
