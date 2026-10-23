// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Descriptive observations in place of marks (#240, P-Obs, R-3.5-06, answer
// 464): the grades, terms and subjects the country's file names, such as 1AP
// term 1 for every subject, and for those a pupil's observation on a fixed
// scale, «مكتسب», «في طور الاكتساب» or «غير مكتسب». The teacher chooses each
// one by hand, the last one recorded counts, and it can be cleared. The counts
// say how many pupils on a list have each and how many have none yet.

import type { AssessmentData } from './assessment.ts';
import type { RecordEvent } from './events.ts';
import { courseGrade } from './joint.ts';
import type { State } from './state.ts';

/** The scale, from acquired to not acquired. */
export const OBSERVATIONS = ['acquired', 'in-progress', 'not-acquired'] as const;

export type Observation = (typeof OBSERVATIONS)[number];

/** A grade's term whose marks observations replace: for every subject, or for those named. */
export interface ObservedTerm {
  readonly grade: string;
  readonly term: number;
  readonly subjects?: readonly string[];
  /** Where the rule comes from. */
  readonly source: string;
}

export interface ObservationEntry {
  readonly courseId: string;
  readonly term: number;
  readonly pupilId: string;
  /** The observation, or null once cleared. */
  readonly value: Observation | null;
}

/** The key the last observation for a pupil, course and term is kept under. */
export function observationKey(entry: Pick<ObservationEntry, 'courseId' | 'term' | 'pupilId'>): string {
  return `${entry.courseId}/${entry.term}/${entry.pupilId}`;
}

/** The event that records an observation, or clears it with null. */
export function setObservation(entry: Omit<ObservationEntry, 'value'>, value: Observation | null): RecordEvent {
  return { kind: 'observation.set', observation: { ...entry, value } };
}

/** Whether a grade's subject is observed instead of marked in a term. */
export function observedTerm(data: AssessmentData, grade: string, subject: string, term: number): boolean {
  return (data.observations ?? []).some(
    (one) => one.grade === grade && one.term === term && (one.subjects === undefined || one.subjects.includes(subject)),
  );
}

/** Whether a class and subject's term is observed instead of marked, by its grade, a joint class's by the course's. */
export function courseObserved(
  state: Pick<State, 'courses' | 'classes'>,
  data: AssessmentData,
  courseId: string,
  term: number,
): boolean {
  const course = state.courses.get(courseId);
  const room = course && state.classes.get(course.classId);
  if (course === undefined || room === undefined) return false;
  return observedTerm(data, courseGrade(course, room), course.subject, term);
}

/** Each pupil's observation for a course and term; cleared ones are left out. */
export function observationsFor(
  state: Pick<State, 'observations'>,
  courseId: string,
  term: number,
): Map<string, Observation> {
  const found = new Map<string, Observation>();
  for (const entry of state.observations.values()) {
    if (entry.courseId === courseId && entry.term === term && entry.value !== null) {
      found.set(entry.pupilId, entry.value);
    }
  }
  return found;
}

export interface ObservationCounts {
  readonly acquired: number;
  readonly inProgress: number;
  readonly notAcquired: number;
  /** Pupils on the list with none yet. */
  readonly missing: number;
}

/** How many pupils on the list have each observation, and how many none. */
export function observationCounts(
  listed: readonly string[],
  observations: ReadonlyMap<string, Observation>,
): ObservationCounts {
  const count = (value: Observation) => listed.filter((pupilId) => observations.get(pupilId) === value).length;
  return {
    acquired: count('acquired'),
    inProgress: count('in-progress'),
    notAcquired: count('not-acquired'),
    missing: listed.filter((pupilId) => !observations.has(pupilId)).length,
  };
}
