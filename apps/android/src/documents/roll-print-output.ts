// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What each of Roll-print's choices prints (#217, answers 254, 260 and
// 262): its pages for one book, the print job's title, the PDF's working
// name and the name offered when saving, and its orientation. The monthly
// spread, the front pages and the blank day sheet are A4 portrait; the
// yearly summary is A4 landscape. The day sheet has no recorded version.

import { parseDay, type Day } from '@minhajna/core';
import { monthLabel, yearShown, type DocumentData, type Translate } from './document-data';
import { rollDayPages, sheetTitle } from './roll-day-sheet';
import { rollFrontPages } from './roll-front-pages';
import { rollSpreadPages, type RollBook } from './roll-spread-pages';
import { rollYearPages } from './roll-year-pages';

export type RollPrintChoice = 'spread' | 'year' | 'front' | 'day';

export interface RollOutput {
  readonly html: () => string;
  readonly title: string;
  /** The PDF's working name in the app's cache. */
  readonly made: string;
  /** The name offered when saving. */
  readonly file: string;
  readonly landscape: boolean;
}

/** The output of `choice` for `book`, for `month` or `day` where it takes one. */
export function rollOutput(
  data: DocumentData,
  t: Translate,
  options: {
    readonly choice: RollPrintChoice;
    readonly book: RollBook;
    readonly name: string;
    readonly blank: boolean;
    readonly month: string;
    readonly day: Day;
  },
): RollOutput {
  const { choice, book, blank, month, day } = options;
  const version = blank && choice !== 'day' ? ` - ${t('documents.output.blank')}` : '';
  const file = (period: string) =>
    `${t('documents.rollBook')} ${options.name} ${period}${version}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
  switch (choice) {
    case 'year':
      return {
        html: () => rollYearPages(data, t, blank, [book]),
        title: t('rollPrint.yearTitle', { year: yearShown(data) }),
        made: 'roll-year',
        file: file(data.year.id),
        landscape: true,
      };
    case 'front':
      return {
        html: () => rollFrontPages(data, t, blank, [book]),
        title: `${t('documents.rollBook')} · ${t('rollPrint.front.name')}`,
        made: 'roll-front',
        file: file(`${t('rollPrint.front.name')} ${data.year.id}`),
        landscape: false,
      };
    case 'day':
      return {
        html: () => rollDayPages(data, t, book, day),
        title: sheetTitle(data, t, day),
        made: `roll-day-${day}`,
        file: file(`${t('rollPrint.day.name')} ${day}`),
        landscape: false,
      };
    default:
      return {
        html: () => rollSpreadPages(data, t, blank, month, [book]),
        title: t('rollPrint.spreadTitle', { month: monthLabel(data, parseDay(`${month}-01`)) }),
        made: `roll-${month}`,
        file: file(month),
        landscape: false,
      };
  }
}
