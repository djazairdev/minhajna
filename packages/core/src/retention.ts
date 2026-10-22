// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How long records are kept (#235, Settings-retention, R-5.7-02, answer 428):
// lesson records, pupil data and private notes each have a default the
// teacher can change; the log follows what it describes. Nothing is erased
// here: the dates say when an erasure would be offered, which export and
// erase (#248) does, keeping only the fact and the day (R-5.5-13). The choice
// is the teacher's own and stays private.

import { parseDay, type Day } from './day.ts';
import type { State } from './state.ts';

export interface Retention {
  /** Kept until the teacher deletes them, or offered for erasure three years after their school year. */
  readonly lessons: 'kept' | 'after-three-years';
  /** Offered for erasure after the end of the next school year, or of their own. */
  readonly pupils: 'after-next-year' | 'after-its-year';
  /** Kept until the teacher deletes them, or offered with their year's pupil data. */
  readonly notes: 'kept' | 'with-pupils';
}

export const DEFAULT_RETENTION: Retention = { lessons: 'kept', pupils: 'after-next-year', notes: 'kept' };

/** When a school year's records would be offered for erasure: the first of July after the year that counts. */
export interface ErasureOffer {
  readonly year: string;
  readonly pupils: Day;
  /** Null while lesson records are kept until the teacher deletes them. */
  readonly lessons: Day | null;
  /** Null while private notes are kept until the teacher deletes them. */
  readonly notes: Day | null;
}

/** The teacher's choice, or the defaults when there is none. */
export function retentionOf(state: Pick<State, 'retention'>): Retention {
  return state.retention ?? DEFAULT_RETENTION;
}

/** Whether a value is a retention choice, as a stored or incoming one must be. */
export function isRetention(value: unknown): value is Retention {
  if (typeof value !== 'object' || value === null) return false;
  const { lessons, pupils, notes } = value as Record<string, unknown>;
  return (
    Object.keys(value).length === 3 &&
    (lessons === 'kept' || lessons === 'after-three-years') &&
    (pupils === 'after-next-year' || pupils === 'after-its-year') &&
    (notes === 'kept' || notes === 'with-pupils')
  );
}

const july = (year: number) => parseDay(`${String(year).padStart(4, '0')}-07-01`);

/**
 * The offers for each school year the teacher has a course in, oldest first. A year counts from its own end, so
 * an earlier year brought in later is offered on its own date. A year not written as `2026-2027` is left out.
 */
export function erasureOffers(state: Pick<State, 'retention' | 'courses'>): ErasureOffer[] {
  const retention = retentionOf(state);
  const years = new Set<string>();
  for (const course of state.courses.values()) {
    const match = /^(\d{4})-(\d{4})$/.exec(course.year);
    if (match !== null && Number(match[2]) === Number(match[1]) + 1) years.add(course.year);
  }
  return [...years].sort().map((year) => {
    const end = Number(year.slice(5));
    const pupils = july(retention.pupils === 'after-next-year' ? end + 1 : end);
    return {
      year,
      pupils,
      lessons: retention.lessons === 'kept' ? null : july(end + 3),
      notes: retention.notes === 'kept' ? null : pupils,
    };
  });
}
