// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «التقديرات» says (#241, Apprec, Apprec-conduct, answer 465): Algeria's
// list of phrases, bundled and read against the profile like any file, so a
// refused list leaves no appreciations to offer; a term's sheet, the pupils of
// its grade book in list order with their averages and the phrases chosen, none
// for a term whose marks observations replace; a pupil's suggestion, by their
// average alone or with their conduct, and the list's other phrases; a pupil's
// average, two decimals and, when they show a band's bound the full value is
// under, the full value too; the term's counts, «في الفصل: غيابان · تأخر واحد ·
// لا ملاحظة سلوك»; the list's note and release; and the hub's line, how many
// have one.

import {
  appreciationGaps,
  appreciationsFor,
  bandOf,
  conductOf,
  courseObserved,
  fullMark,
  gradeBook,
  parseAppreciationList,
  shownAtThreshold,
  shownMark,
  suggestions,
  termConduct,
  type AppreciationEntry,
  type AppreciationList,
  type AppreciationPhrase,
  type AssessmentData,
  type Context,
  type CountryProfile,
  type GradeBook,
  type TermConduct,
} from '@minhajna/core';
import bundled from '@minhajna/data/dz/appreciations.json';
import type { useText } from '../text/i18n';

type Translate = ReturnType<typeof useText>;

const read = new WeakMap<CountryProfile, AppreciationList | null>();

/** The list of phrases, read against the profile once; null when the file is refused. */
export function appreciationList(profile: CountryProfile, file: unknown = bundled): AppreciationList | null {
  const parse = () => {
    const result = parseAppreciationList(file, profile);
    return result.ok ? result.value : null;
  };
  if (file !== bundled) return parse();
  if (!read.has(profile)) read.set(profile, parse());
  return read.get(profile) ?? null;
}

export interface AppreciationRow {
  readonly pupilId: string;
  /** The pupil's number on the list, from 1. */
  readonly number: number;
  readonly average: number | null;
}

export interface AppreciationSheet {
  readonly rows: readonly AppreciationRow[];
  /** The scale the averages are on: 20, or 10 in primary. */
  readonly scale: number;
  readonly chosen: ReadonlyMap<string, NonNullable<AppreciationEntry['phrase']>>;
  /** The pupils on the list still without a phrase, in list order. */
  readonly gaps: readonly string[];
}

/** A course's term's sheet, from its grade book, given when built already; null without one, or when observed. */
export function appreciationSheet(
  context: Context,
  data: AssessmentData,
  courseId: string,
  term: number,
  built?: GradeBook | null,
): AppreciationSheet | null {
  if (courseObserved(context.state, data, courseId, term)) return null;
  const book = built === undefined ? gradeBook(context, data, courseId, term) : built;
  if (book === null) return null;
  const rows = book.rows.map(({ pupilId, number, average }) => ({ pupilId, number, average }));
  const chosen = appreciationsFor(context.state, courseId, term);
  const gaps = appreciationGaps(
    rows.map((row) => row.pupilId),
    chosen,
  );
  return { rows, scale: book.scale, chosen, gaps };
}

export type SuggestBy = 'average' | 'conduct';

export interface PupilSuggestion {
  /** The phrase suggested; none without an average. */
  readonly suggested: AppreciationPhrase | null;
  /** The other phrases for the band, or the whole list without an average. */
  readonly others: readonly AppreciationPhrase[];
  /** The term's counts, when suggesting by conduct too. */
  readonly counts: TermConduct | null;
}

/** A pupil's suggestion, by their average alone or with the term's conduct. */
export function pupilSuggestion(
  context: Context,
  list: AppreciationList,
  sheet: AppreciationSheet,
  where: { readonly courseId: string; readonly term: number },
  row: AppreciationRow,
  by: SuggestBy,
): PupilSuggestion {
  const counts = by === 'conduct' ? termConduct(context, where.courseId, where.term, row.pupilId) : null;
  const band = bandOf(list, row.average, sheet.scale);
  if (band === null) return { suggested: null, others: list.phrases, counts };
  const [suggested = null, ...others] = suggestions(list, band, counts === null ? undefined : conductOf(list, counts));
  return { suggested, others, counts };
}

/** A pupil's average, «المعدل 11.67», or «المعدل 14.00، والقيمة الكاملة 13.996» under a band's bound. */
export function averageLine(t: Translate, list: AppreciationList, sheet: AppreciationSheet, average: number): string {
  const shown = shownMark(average);
  const bounds = list.bands.map((band) => (band.from * sheet.scale) / 20);
  if (!bounds.some((bound) => shownAtThreshold(average, bound)))
    return t('marks.appreciations.average', { mark: shown });
  return t('marks.appreciations.averageFull', { mark: shown, full: fullMark(average) });
}

/** The term's counts, «في الفصل: غيابان · تأخر واحد · لا ملاحظة سلوك». */
export function countsLine(t: Translate, counts: TermConduct): string {
  return t('marks.appreciations.counts', {
    absences: t('marks.appreciations.absences', { count: counts.absences }),
    lateness: t('marks.appreciations.lateness', { count: counts.lateness }),
    behaviour: t('marks.appreciations.behaviour', { count: counts.behaviour }),
  });
}

/** The list's note: interim while the official one is not found, with its release. */
export function listNote(t: Translate, list: AppreciationList): string {
  const key = list.interim ? 'marks.appreciations.interim' : 'marks.appreciations.release';
  return t(key, { release: list.release });
}

/** How many on the list have a phrase, «24 من 36 مختارة». */
export function progressLine(t: Translate, sheet: AppreciationSheet): string {
  return t('marks.appreciations.progress', {
    done: sheet.rows.length - sheet.gaps.length,
    total: sheet.rows.length,
  });
}
