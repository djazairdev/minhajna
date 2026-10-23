// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «ملف مجلس القسم» says (#244, Council, answer 470): the hub's line; a
// share as a percentage to one decimal; a band by its bounds; a rank's change
// from the previous term, and a figure's trend, each shown as an arrow and read
// in words; whether two pairs of thresholds are the same; the roll-call book's
// summary; and the thresholds as the teacher reads and types them, on the
// book's scale, kept on 20.

import {
  shownMark,
  thresholdsProblem,
  type CouncilAttendance,
  type CouncilBand,
  type CouncilRank,
  type CouncilThresholds,
  type GradeBook,
} from '@minhajna/core';
import type { useText } from '../text/i18n';
import { typedMark } from './fix-rules';

type Translate = ReturnType<typeof useText>;

/** A number as short as it is, such as 2.5 or 16. */
const plain = (value: number) => String(Math.round(value * 100) / 100);

/** The hub's line: the class average and how many reach the threshold, or that there is no average yet. */
export function councilRowLine(t: Translate, book: GradeBook): string {
  const { mean, reached, counted } = book.figures;
  return mean === null
    ? t('marks.council.rowEmpty')
    : t('marks.council.rowLine', { mean: shownMark(mean), threshold: book.threshold, reached, counted });
}

/** A share as a percentage to one decimal, or a dash with none counted. */
export function share(part: number, whole: number): string {
  return whole === 0 ? '—' : `${((part / whole) * 100).toFixed(1)}%`;
}

/** A band by its bounds: «أقل من 5», «من 5 إلى 8» or «16 فأكثر». */
export function bandLabel(t: Translate, band: CouncilBand): string {
  if (band.from === 0 && band.to !== null) return t('marks.council.below', { to: plain(band.to) });
  if (band.to === null) return t('marks.council.andAbove', { from: plain(band.from) });
  return t('marks.council.between', { from: plain(band.from), to: plain(band.to) });
}

/** A rank's change from the previous term: the arrow shown and the words read. */
export function rankChange(t: Translate, row: CouncilRank): { readonly shown: string; readonly spoken: string } {
  if (row.previous === null) return { shown: '—', spoken: t('marks.council.changeNone') };
  const moved = row.previous - row.rank;
  if (moved === 0) return { shown: '=', spoken: t('marks.council.changeSame') };
  return moved > 0
    ? { shown: `↑ ${moved}`, spoken: t('marks.council.changeUp', { count: moved }) }
    : { shown: `↓ ${-moved}`, spoken: t('marks.council.changeDown', { count: -moved }) };
}

/** Which way a figure went since the previous term, on its full value: the arrow shown and the word read. */
export function trend(
  t: Translate,
  from: number | null,
  to: number | null,
): { readonly shown: string; readonly spoken: string } {
  if (from === null || to === null) return { shown: '', spoken: '' };
  if (Math.abs(to - from) < 1e-9) return { shown: '=', spoken: t('marks.council.trendSame') };
  return to > from
    ? { shown: '↑', spoken: t('marks.council.trendUp') }
    : { shown: '↓', spoken: t('marks.council.trendDown') };
}

/** Whether two pairs of thresholds are the same, so keeping one would change nothing. */
export function sameThresholds(a: CouncilThresholds, b: CouncilThresholds): boolean {
  return Math.abs(a.remedial - b.remedial) < 1e-9 && Math.abs(a.distinction - b.distinction) < 1e-9;
}

/** The term's roll-call summary, or that there is none. */
export function attendanceLine(t: Translate, attendance: CouncilAttendance | null): string {
  return attendance === null
    ? t('marks.council.noAttendance')
    : t('marks.council.attendance', { absent: attendance.absent, late: attendance.late });
}

/** An average in two decimals, or a dash. */
export function shown(value: number | null): string {
  return value === null ? '—' : shownMark(value);
}

/** Thresholds as typed on the book's scale, kept on 20; or why they cannot be. */
export function typedThresholds(
  remedial: string,
  distinction: string,
  scale: number,
): { readonly thresholds: CouncilThresholds } | { readonly problem: string } {
  const [low, high] = [typedMark(remedial, scale), typedMark(distinction, scale)];
  if (!('value' in low) || !('value' in high)) return { problem: 'invalid' };
  const kept: CouncilThresholds = { remedial: (low.value * 20) / scale, distinction: (high.value * 20) / scale };
  const problem = thresholdsProblem(kept);
  return problem === null ? { thresholds: kept } : { problem };
}

/** The pack's thresholds, already on the book's scale, as the teacher reads and types them. */
export function thresholdWords(thresholds: CouncilThresholds): {
  readonly remedial: string;
  readonly distinction: string;
} {
  return { remedial: plain(thresholds.remedial), distinction: plain(thresholds.distinction) };
}
