// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Appreciations (#241, PRD §3.6, answer 465): a country's list of phrases, an
// interim one while circular 244's is not found, each for a band of the term
// average out of 20 and, for some, for good conduct or a concern; the phrases
// it bans; and the counts that make a concern. A pupil's band, from their
// average, primary's out of 10 doubled; the phrases suggested for it, those
// for their conduct first when the teacher asks for it; their term's
// unjustified absences, lateness and behaviour taps, counts only. The phrase
// the teacher chose for a pupil, course and term, kept with its text and the
// list's release, the last one counting; and the pupils on a list who still
// have none, which the export waits for (R-3.6-07).

import { evidence } from './captures.ts';
import { componentPeriod } from './component-figures.ts';
import type { Context } from './context.ts';
import type { RecordEvent } from './events.ts';
import { attendanceProposal } from './mark-figures.ts';
import type { LocalizedText } from './reference.ts';
import type { State } from './state.ts';

export const CONDUCTS = ['good', 'concern'] as const;

export type Conduct = (typeof CONDUCTS)[number];

/** A band of the term average out of 20, from `from` up to, not including, `to`; the last includes 20. */
export interface AppreciationBand {
  readonly id: string;
  readonly from: number;
  readonly to: number;
}

export interface AppreciationPhrase {
  readonly id: string;
  readonly band: string;
  /** For good conduct or a concern only; absent, for any conduct. */
  readonly conduct?: Conduct;
  readonly text: LocalizedText;
  /** It only restates the mark, such as «متوسط» alone, so choosing it shows a warning (R-3.6-06). */
  readonly restates?: true;
}

export interface AppreciationList {
  readonly country: string;
  readonly release: string;
  /** Minhajna's own list while the official one is not found. */
  readonly interim: boolean;
  readonly source: string;
  readonly bands: readonly AppreciationBand[];
  readonly phrases: readonly AppreciationPhrase[];
  /** Phrases no appreciation may contain, such as «يوجه إلى الحياة العملية». */
  readonly banned: readonly string[];
  /** A term's counts from which conduct is a concern. */
  readonly concern: { readonly absences: number; readonly lateness: number; readonly behaviour: number };
}

export interface AppreciationEntry {
  readonly courseId: string;
  readonly term: number;
  readonly pupilId: string;
  /** The phrase chosen, as the list had it, or null once cleared. */
  readonly phrase: { readonly id: string; readonly text: string; readonly release: string } | null;
}

/** The key the last appreciation for a pupil, course and term is kept under. */
export function appreciationKey(entry: Pick<AppreciationEntry, 'courseId' | 'term' | 'pupilId'>): string {
  return `${entry.courseId}/${entry.term}/${entry.pupilId}`;
}

/** The event that records the phrase chosen from the list, in Arabic, or clears it with null. */
export function setAppreciation(
  entry: Omit<AppreciationEntry, 'phrase'>,
  list: Pick<AppreciationList, 'release'>,
  phrase: AppreciationPhrase | null,
): RecordEvent {
  const chosen = phrase === null ? null : { id: phrase.id, text: phrase.text['ar'] ?? '', release: list.release };
  return { kind: 'appreciation.set', appreciation: { ...entry, phrase: chosen } };
}

/** Each pupil's appreciation for a course and term; cleared ones are left out. */
export function appreciationsFor(
  state: Pick<State, 'appreciations'>,
  courseId: string,
  term: number,
): Map<string, NonNullable<AppreciationEntry['phrase']>> {
  const found = new Map<string, NonNullable<AppreciationEntry['phrase']>>();
  for (const entry of state.appreciations.values()) {
    if (entry.courseId === courseId && entry.term === term && entry.phrase !== null) {
      found.set(entry.pupilId, entry.phrase);
    }
  }
  return found;
}

/** The pupils on the list with no appreciation yet, in list order. */
export function appreciationGaps(listed: readonly string[], chosen: ReadonlyMap<string, unknown>): string[] {
  return listed.filter((pupilId) => !chosen.has(pupilId));
}

/** The band of an average on a scale, compared out of 20, a hair under a bound counting at it; null without one. */
export function bandOf(
  list: Pick<AppreciationList, 'bands'>,
  average: number | null,
  scale: number,
): AppreciationBand | null {
  if (average === null) return null;
  const value = (average * 20) / scale + 1e-9;
  return (
    list.bands.find((band, index) => value >= band.from && (value < band.to || index === list.bands.length - 1)) ?? null
  );
}

export interface TermConduct {
  readonly absences: number;
  readonly lateness: number;
  readonly behaviour: number;
}

/** A pupil's unjustified absences and lateness from the roll-call book, and behaviour taps, in a course's term. */
export function termConduct(context: Context, courseId: string, term: number, pupilId: string): TermConduct {
  const course = context.state.courses.get(courseId);
  const period = componentPeriod(context, term);
  if (course === undefined || period === null) return { absences: 0, lateness: 0, behaviour: 0 };
  const roll = attendanceProposal(context, course.classId, pupilId, period.from, period.to, 1);
  const taps = evidence(context.state, courseId, pupilId, period.from, period.to);
  return { absences: roll.unjustified, lateness: roll.late, behaviour: taps.behaviour };
}

/** Whether the counts make a concern under the list's thresholds. */
export function conductOf(list: AppreciationList, counts: TermConduct): Conduct {
  const { absences, lateness, behaviour } = list.concern;
  return counts.absences >= absences || counts.lateness >= lateness || counts.behaviour >= behaviour
    ? 'concern'
    : 'good';
}

/**
 * The phrases for a band: by the average alone, those for any conduct; with conduct, those for it first, then the
 * others for any conduct. With no band, the whole list.
 */
export function suggestions(
  list: AppreciationList,
  band: AppreciationBand | null,
  conduct?: Conduct,
): AppreciationPhrase[] {
  if (band === null) return [...list.phrases];
  const inBand = list.phrases.filter((phrase) => phrase.band === band.id);
  const any = inBand.filter((phrase) => phrase.conduct === undefined);
  return conduct === undefined ? any : [...inBand.filter((phrase) => phrase.conduct === conduct), ...any];
}
