// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a row of the class plan says (#37): the days an item was taught, or
// the day the plan would reach it if nothing changes; its status and stages;
// where the class is; where the plan says it should be, as a reference
// only; and «بعد الاختبارات» until an item postponed past them is taught.
// The words state facts (PRD §3.1, rule 8).

import type { Day, PlanRow, TermCheck } from '@minhajna/core';
import type { useText } from '../text/i18n';

type Translate = ReturnType<typeof useText>;

/** «28/09». */
export function dayMonth(day: Day): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/** The days it was taught, or the day the plan would reach it, or nothing. */
export function rowDays(row: PlanRow): { text: string; ahead: boolean } | null {
  if (row.completed !== undefined) return { text: dayMonth(row.completed), ahead: false };
  if (row.taught !== null) {
    const { from, to } = row.taught;
    return { text: from === to ? dayMonth(from) : `${dayMonth(from)}–${dayMonth(to)}`, ahead: false };
  }
  return row.next === null ? null : { text: dayMonth(row.next), ahead: true };
}

export interface RowTag {
  readonly id: 'status' | 'position' | 'expected' | 'buffer' | 'postponed';
  readonly label: string;
}

export function rowTags(t: Translate, row: PlanRow, postponed = false): RowTag[] {
  const status =
    row.status === 'done'
      ? t('classPlan.done')
      : row.status === 'skipped'
        ? t('classPlan.skipped')
        : row.status === 'started'
          ? row.onlyGroup !== undefined
            ? t('calendarView.groups.only', { group: row.onlyGroup })
            : row.stages > 1
              ? t('classPlan.startedStages', { covered: row.covered, stages: row.stages })
              : t('classPlan.started')
          : null;
  return [
    ...(status === null ? [] : [{ id: 'status' as const, label: status }]),
    ...(row.position ? [{ id: 'position' as const, label: t('classPlan.position') }] : []),
    ...(row.expected ? [{ id: 'expected' as const, label: t('classPlan.expected') }] : []),
    ...(row.item.buffer === true ? [{ id: 'buffer' as const, label: t('classPlan.buffer') }] : []),
    ...(postponed && row.status !== 'done' && row.status !== 'skipped'
      ? [{ id: 'postponed' as const, label: t('classPlan.postponed') }]
      : []),
  ];
}

/** The row as TalkBack reads it: the title, then the days and every tag. */
export function rowSpoken(t: Translate, row: PlanRow, comma: string, postponed = false): string {
  const days = rowDays(row);
  return [
    row.item.title,
    days === null
      ? null
      : days.ahead
        ? t('classPlan.aheadSpoken', { day: days.text })
        : t('classPlan.taughtSpoken', { days: days.text }),
    ...rowTags(t, row, postponed).map((tag) => tag.label),
  ]
    .filter((part): part is string => part !== null)
    .join(comma);
}

/** A term's name, «الأول», or its number when there is no name for it. */
export function termName(t: Translate, term: number): string {
  return term >= 1 && term <= 3 ? t(`classPlan.term${term as 1 | 2 | 3}`) : String(term);
}

/** «حتى اختبارات الفصل الأول (29/11): 32 حصة درس، ويحتاج منها المخطط 26.» */
export function untilLine(t: Translate, check: TermCheck): string {
  const sessions = (count: number) => t('count.sessions', { count });
  return t(check.basis === 'exam-window' ? 'classPlan.untilExams' : 'classPlan.untilEnd', {
    term: termName(t, check.term),
    day: dayMonth(check.before),
    gives: sessions(check.gives),
    needs: sessions(check.needs),
  });
}
