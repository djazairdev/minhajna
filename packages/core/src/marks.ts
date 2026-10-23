// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Marks (#239, PRD §3.5, answers 439 and 440): a pupil's mark for one of the
// term's tests, its exam, lycée's practical work or oral (#240, answer 463), or
// a component of the setup in a period, the term or, in primary, a month. A
// mark has two decimals at most and lies from 0 to its maximum; a pupil can be
// absent instead, and a mark can be cleared. The last one recorded counts. The
// entry check counts what was entered, the marks above a maximum since lowered,
// the empty cells of the pupils on the list, and the marks of pupils not on it,
// which stay out of the averages (answer 452).

import type { RecordEvent } from './events.ts';
import type { State } from './state.ts';

/** What a mark is for: a test, the exam, lycée's practical work or oral, or a component, by the month in primary. */
export type MarkTarget =
  | { readonly kind: 'test'; readonly testId: string }
  | { readonly kind: 'exam' }
  | { readonly kind: 'practical' }
  | { readonly kind: 'oral' }
  | { readonly kind: 'component'; readonly componentId: string; readonly month?: string };

export type MarkValue = number | 'absent';

export interface MarkEntry {
  readonly courseId: string;
  readonly term: number;
  readonly target: MarkTarget;
  readonly pupilId: string;
  /** The mark, «غائب», or null once cleared. */
  readonly value: MarkValue | null;
}

/** A target as a key, such as `test:t-1`, `exam`, `practical` or `component:participation:2026-10`. */
export function targetKey(target: MarkTarget): string {
  if (target.kind === 'test') return `test:${target.testId}`;
  if (target.kind === 'exam' || target.kind === 'practical' || target.kind === 'oral') return target.kind;
  return target.month === undefined
    ? `component:${target.componentId}`
    : `component:${target.componentId}:${target.month}`;
}

/** The key the last mark for a pupil and target is kept under. */
export function markKey(mark: Pick<MarkEntry, 'courseId' | 'term' | 'target' | 'pupilId'>): string {
  return `${mark.courseId}/${mark.term}/${targetKey(mark.target)}/${mark.pupilId}`;
}

/** Why a typed mark cannot be kept: above the maximum, or not a mark at all; null when it can. */
export function markProblem(value: number, max: number): 'over' | 'invalid' | null {
  if (!Number.isFinite(value) || value < 0 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-9) {
    return 'invalid';
  }
  return value > max ? 'over' : null;
}

/** The event that records a mark, «غائب», or clears it; a mark that cannot be kept is refused. */
export function setMark(mark: Omit<MarkEntry, 'value'>, value: MarkValue | null, max: number): RecordEvent {
  if (!Number.isFinite(max) || max <= 0) throw new RangeError('A mark needs a maximum');
  if (typeof value === 'number') {
    const problem = markProblem(value, max);
    if (problem === 'over') throw new RangeError('The mark is above the maximum');
    if (problem !== null) throw new RangeError('A mark has two decimals at most, from 0');
  }
  const kept = typeof value === 'number' ? Math.round(value * 100) / 100 : value;
  return { kind: 'mark.set', mark: { ...mark, value: kept } };
}

/** Each pupil's mark or absence for a target; cleared marks are left out. */
export function marksFor(
  state: Pick<State, 'marks'>,
  courseId: string,
  term: number,
  target: MarkTarget,
): Map<string, MarkValue> {
  const key = targetKey(target);
  const found = new Map<string, MarkValue>();
  for (const mark of state.marks.values()) {
    if (mark.courseId !== courseId || mark.term !== term || mark.value === null) continue;
    if (targetKey(mark.target) === key) found.set(mark.pupilId, mark.value);
  }
  return found;
}

export interface EntryCheck {
  /** Pupils on the list with a mark, within the maximum when one is given. */
  readonly entered: number;
  /** Pupils on the list whose mark is above the maximum given, in list order. */
  readonly over: readonly string[];
  /** Pupils on the list marked absent. */
  readonly absent: number;
  /** Pupils on the list with neither, in list order. */
  readonly empty: readonly string[];
  /** Pupils with a mark or an absence who are not on the list. */
  readonly notOnList: readonly string[];
}

/** What an entry holds against the list of pupils it is for (R-3.5-10, R-3.5-11). */
export function entryCheck(
  listed: readonly string[],
  marks: ReadonlyMap<string, MarkValue>,
  max = Number.POSITIVE_INFINITY,
): EntryCheck {
  const onList = new Set(listed);
  const values = listed.map((pupilId) => marks.get(pupilId));
  const over = listed.filter((pupilId) => {
    const value = marks.get(pupilId);
    return typeof value === 'number' && markProblem(value, max) === 'over';
  });
  return {
    entered: values.filter((value) => typeof value === 'number').length - over.length,
    over,
    absent: values.filter((value) => value === 'absent').length,
    empty: listed.filter((pupilId) => !marks.has(pupilId)),
    notOnList: [...marks.keys()].filter((pupilId) => !onList.has(pupilId)).sort(),
  };
}
