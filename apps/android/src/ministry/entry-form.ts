// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The form that adds an entry to the world's calendar or changes one on the
// Ministry's calendar page (#607, answer 623): what it holds, filled from the
// entry, with the reason the draft gave if it moved the days of the release's
// entry, or, for a new one, a marker on the world's date, announced; the entry
// it makes, with its name in Arabic and, if given, French and English, its
// levels if any are chosen, and an exam window's term, keeping what the form
// does not show, such as an exam's grades or Ramadan's times, while the effect
// stays, and dropping it when the effect changes; and what is missing before it
// can be saved: the Arabic name, the source, why the days of an entry of the
// release moved, and levels that cover the years an exam of the release keeps
// while its effect stays.

import {
  DRAFT_EFFECTS,
  type CalendarEntry,
  type Confidence,
  type CountryProfile,
  type Day,
  type SchoolYear,
} from '@minhajna/core';

/** What the form holds. */
export interface EntryForm {
  readonly ar: string;
  readonly fr: string;
  readonly en: string;
  readonly from: Day;
  readonly to: Day;
  readonly effect: CalendarEntry['effect'];
  readonly term: number | null;
  readonly levels: readonly string[];
  readonly source: string;
  readonly confidence: Confidence;
  readonly reason: string;
}

/** What is missing before the form can be saved. */
export type FormProblem = 'needName' | 'needSource' | 'needReason' | 'needLevels';

const NAMES = ['ar', 'fr', 'en'] as const;
/** What the form shows of an entry; the rest stays while its effect does. */
const SHOWN = new Set([
  'id',
  'layer',
  'zone',
  'from',
  'to',
  'effect',
  'name',
  'source',
  'confidence',
  'levels',
  'term',
  'moved',
]);

/** Whether the form can change the entry's effect: only among the effects the editor offers. */
export const effectOffered = (effect: CalendarEntry['effect']) => (DRAFT_EFFECTS as readonly string[]).includes(effect);

/**
 * The form for an entry, with the reason the draft gave if it moved the days of
 * the release's entry, or for a new one on the world's date within the year.
 */
export function formOf(
  entry: CalendarEntry | null,
  date: Day,
  year: SchoolYear,
  was: CalendarEntry | undefined = undefined,
): EntryForm {
  if (entry !== null)
    return {
      ar: entry.name['ar'] ?? '',
      fr: entry.name['fr'] ?? '',
      en: entry.name['en'] ?? '',
      from: entry.from,
      to: entry.to,
      effect: entry.effect,
      term: entry.term ?? null,
      levels: entry.levels ?? [],
      source: entry.source,
      confidence: entry.confidence,
      reason: was !== undefined && (entry.from !== was.from || entry.to !== was.to) ? (entry.moved?.reason ?? '') : '',
    };
  const day = date < year.from ? year.from : date > year.to ? year.to : date;
  return {
    ...{ ar: '', fr: '', en: '', source: '', reason: '', levels: [] },
    from: day,
    to: day,
    effect: 'marker',
    term: null,
    confidence: 'announced',
  };
}

/** Whether the form moves the days of an entry of the release. */
export const movesDays = (form: EntryForm, was: CalendarEntry | undefined) =>
  was !== undefined && (form.from !== was.from || form.to !== was.to);

/** The years an entry of the release keeps while its effect stays, which the levels chosen must cover. */
export function keptGrades(form: EntryForm, was: CalendarEntry | undefined): readonly string[] {
  return was !== undefined && was.effect === form.effect ? (was.grades ?? []) : [];
}

/** What is missing before the form can be saved, none when it can be. */
export function formProblems(
  form: EntryForm,
  was: CalendarEntry | undefined,
  profile: Pick<CountryProfile, 'levels'>,
): FormProblem[] {
  const covered = profile.levels
    .filter((level) => form.levels.includes(level.code))
    .flatMap((level) => level.grades.map((grade) => grade.code));
  const grades = keptGrades(form, was);
  const uncovered = form.levels.length > 0 && grades.some((grade) => !covered.includes(grade));
  return [
    ...(form.ar.trim() === '' ? (['needName'] as const) : []),
    ...(form.source.trim() === '' ? (['needSource'] as const) : []),
    ...(movesDays(form, was) && form.reason.trim() === '' ? (['needReason'] as const) : []),
    ...(uncovered ? (['needLevels'] as const) : []),
  ];
}

/** The entry the form makes, under its ID, layer and wilaya, from the release's entry it changes, if any. */
export function entryOf(
  form: EntryForm,
  place: Pick<CalendarEntry, 'id' | 'layer' | 'zone'>,
  was: CalendarEntry | undefined,
): CalendarEntry {
  const kept =
    was === undefined
      ? {}
      : Object.fromEntries(Object.entries(was.name).filter(([key]) => !NAMES.includes(key as never)));
  const names = Object.fromEntries(NAMES.flatMap((key) => (form[key].trim() === '' ? [] : [[key, form[key].trim()]])));
  const hidden =
    was !== undefined && was.effect === form.effect
      ? (Object.fromEntries(Object.entries(was).filter(([key]) => !SHOWN.has(key))) as Partial<CalendarEntry>)
      : {};
  return {
    ...hidden,
    id: place.id,
    layer: place.layer,
    ...(place.zone !== undefined && { zone: place.zone }),
    from: form.from,
    to: form.to,
    effect: form.effect,
    name: { ...kept, ...names },
    source: form.source.trim(),
    confidence: form.confidence,
    ...(form.levels.length > 0 && { levels: form.levels }),
    ...(form.effect === 'exam' && form.term !== null && { term: form.term }),
  };
}
