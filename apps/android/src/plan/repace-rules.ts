// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words of a re-pace draft (#229, Repace, answers 364 and 365), as
// facts: the counts, what changes against the current distribution, and
// each week's row: its dates, its items with their stages or sessions as
// fractions, tests in their place and the days the calendar takes, as the
// screen and the printed draft both show them.

import type { CountryProfile, PlanChoice, RepaceDraft, RepaceEntry, RepaceWeek } from '@minhajna/core';
import { termName } from '../exams/course-label';
import { localized } from '../setup/names';
import type { Language, useText } from '../text/i18n';
import { dayAndMonth, dayName } from '../today/DayMark';
import { isolate } from '../week/grid-labels';

type Translate = ReturnType<typeof useText>;
type Months = Pick<CountryProfile, 'months'>;

const quoted = (t: Translate, title: string) => t('tests.quoted', { title: isolate(title) });

/** A choice in the words of the exam-window answer. */
export function choiceWords(t: Translate, choice: PlanChoice): string {
  return choice.kind === 'leave-out'
    ? t('examWindow.leaveOut', { item: quoted(t, choice.item.title) })
    : t('examWindow.mergeItems', { first: quoted(t, choice.items[0].title), second: quoted(t, choice.items[1].title) });
}

/** The counts on top: plan sessions left, what the plan needs, what is spare or missing, TD apart. */
export function countLines(t: Translate, draft: RepaceDraft): string[] {
  const sessions = (count: number) => t('count.sessions', { count });
  const until = t(draft.window === null ? 'repace.untilTermEnd' : 'repace.untilExams');
  const lines: string[] = [];
  if (draft.counts !== null) {
    const { gives, needs } = draft.counts;
    lines.push(t('repace.gives', { sessions: sessions(gives), until }));
    const rest =
      gives > needs
        ? t('repace.spare', { sessions: sessions(gives - needs) })
        : gives < needs
          ? t('repace.short', { sessions: sessions(needs - gives) })
          : t('repace.exact');
    lines.push(`${t('repace.needs', { sessions: sessions(needs) })} ${rest}`);
  }
  if (draft.td !== null) {
    lines.push(
      t('repace.td', { items: t('count.items', { count: draft.td.items }), sessions: sessions(draft.td.gives) }),
    );
  }
  return lines;
}

/** «ما تغيّر عن التوزيع الحالي»: the gap, the ticked choices, the fixed points, and what lands after. */
export function changeLines(t: Translate, draft: RepaceDraft): string[] {
  const lines: string[] = [];
  const weeks = draft.behind.weeks;
  if (weeks !== null && weeks > 0) lines.push(t('repace.behindWeeks', { weeks: t('repace.weeks', { count: weeks }) }));
  else if (draft.behind.sessions >= 0.5) {
    lines.push(t('repace.behind', { sessions: t('count.sessions', { count: Math.round(draft.behind.sessions) }) }));
  }
  for (const index of draft.ticked) {
    const choice = draft.choices[index];
    if (choice !== undefined) lines.push(t('repace.sentence', { words: choiceWords(t, choice) }));
  }
  lines.push(t('repace.fixed'));
  const term = draft.window === null;
  if (draft.after.length === 0) lines.push(t(term ? 'repace.noneAfterTerm' : 'repace.noneAfter'));
  else {
    const items = draft.after.map((item) => quoted(t, item.title)).join(t('repace.comma'));
    lines.push(t(term ? 'repace.afterTerm' : 'repace.after', { items }));
  }
  return lines;
}

/** «5 – 8 أكتوبر», or «29 أكتوبر – 2 نوفمبر» across two months. */
export function weekDates(week: Pick<RepaceWeek, 'start' | 'end'>, language: Language, profile: Months): string {
  const from = dayAndMonth(week.start, language, profile);
  const to = dayAndMonth(week.end, language, profile);
  if (week.start.slice(0, 7) !== week.end.slice(0, 7)) return `${from} – ${to}`;
  return `${Number(week.start.slice(8, 10))} – ${to}`;
}

/** One entry of a week's row. */
export function entryWords(t: Translate, entry: RepaceEntry, language: Language, profile: Months): string {
  switch (entry.kind) {
    case 'item': {
      const title = isolate(entry.item.title);
      const share = entry.share;
      const named =
        share === null
          ? title
          : share.first === share.last
            ? t('repace.share', { title, first: share.first, of: share.of })
            : t('repace.shareRange', { title, first: share.first, last: share.last, of: share.of });
      return entry.with === undefined ? named : t('repace.with', { item: named, other: isolate(entry.with.title) });
    }
    case 'test':
      return t('repace.test', { title: quoted(t, entry.title), day: dayName(t, entry.day, language, profile) });
    case 'taken':
      return t('repace.taken', {
        day: dayName(t, entry.day, language, profile),
        name: entry.entry === null ? t(`repace.marks.${entry.mark}`) : isolate(localized(entry.entry.name)),
      });
  }
}

/** Whether a week takes an item of a ticked choice: its row says the merge or leave-out is proposed with the draft. */
export function weekProposes(draft: Pick<RepaceDraft, 'choices' | 'ticked'>, week: RepaceWeek): boolean {
  const ids = new Set(
    draft.ticked.flatMap((index) => {
      const choice = draft.choices[index];
      return choice === undefined ? [] : choice.kind === 'leave-out' ? [] : choice.items.map((item) => item.id);
    }),
  );
  return week.entries.some(
    (entry) => entry.kind === 'item' && (ids.has(entry.item.id) || ids.has(entry.with?.id ?? '')),
  );
}

/** The last row: the exam window, or the term's end. */
export function endRow(t: Translate, draft: RepaceDraft, language: Language, profile: Months): string {
  const term = termName(t, draft.term);
  return draft.window === null
    ? t('repace.termEnd', { day: dayName(t, draft.to, language, profile), term })
    : t('repace.exams', { day: dayName(t, draft.window.from, language, profile), term });
}

/** For a week pack, the plan weeks a school week takes: «5», «9 و10». */
export function planWeekWords(t: Translate, weeks: readonly number[]): string {
  return weeks.length === 0 ? '' : t('repace.planWeek', { weeks: weeks.join(t('repace.and')) });
}

/** The draft's first and last days. */
export function rangeWords(t: Translate, draft: Pick<RepaceDraft, 'from' | 'to'>, language: Language, profile: Months) {
  return t('repace.range', {
    from: dayName(t, draft.from, language, profile),
    to: dayName(t, draft.to, language, profile),
  });
}

/** A row of the draft's weeks: its dates, what it takes, its plan sessions, and how it is read aloud. */
export interface WeekRow {
  readonly key: string;
  readonly when: string;
  readonly what: string;
  readonly count: string;
  readonly label: string;
  readonly badge?: string;
}

/** The draft's rows: its weeks, TD on its own, then the exams or the term's end. */
export function weekRows(t: Translate, draft: RepaceDraft, language: Language, profile: Months): WeekRow[] {
  const weekPack = draft.weeks.some((week) => week.planWeeks.length > 0);
  const rows: WeekRow[] = draft.weeks.map((week) => {
    const when = weekDates(week, language, profile);
    const items = week.entries.map((entry) => entryWords(t, entry, language, profile));
    const what = [weekPack ? planWeekWords(t, week.planWeeks) : '', ...items].filter(Boolean).join(' · ');
    const badge = weekProposes(draft, week) ? t('repace.proposed') : undefined;
    const label = [when, what, t('count.sessions', { count: week.plan }), badge]
      .filter(Boolean)
      .join(t('repace.comma'));
    return {
      key: `week-${week.start}`,
      when,
      what,
      count: String(week.plan),
      label,
      ...(badge !== undefined && { badge }),
    };
  });
  if (draft.td !== null) {
    const items = t('count.items', { count: draft.td.items });
    const td = t('repace.tdRow', { items, sessions: t('count.sessions', { count: draft.td.gives }) });
    rows.push({ key: 'td', when: t('repace.tdWhen'), what: td, count: String(draft.td.gives), label: td });
  }
  const end = endRow(t, draft, language, profile);
  rows.push({ key: 'end', when: '', what: end, count: '—', label: end });
  return rows;
}
