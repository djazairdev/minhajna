// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What each of Roll-print's choices prints (#217, answers 254, 260, 262
// and 264): its pages for one book, the print job's title, the PDF's
// working name and the name offered when saving, and its orientation. The
// monthly spread, the front pages, the blank day sheet and the session slip
// are A4 portrait; the yearly summary is A4 landscape. The day sheet and
// the slip have no blank version; a slip is asked for with its roll call.

import { parseDay, type Day, type RollCallUnit } from '@minhajna/core';
import { monthLabel, yearShown, type DocumentData, type Translate } from './document-data';
import { rollDayPages, sheetTitle } from './roll-day-sheet';
import { rollFrontPages } from './roll-front-pages';
import { rollSlipPages, slipLabel } from './roll-slip';
import { rollSpreadPages, type RollBook } from './roll-spread-pages';
import { rollYearPages } from './roll-year-pages';

export type RollPrintChoice = 'spread' | 'year' | 'front' | 'day' | 'slip';

export interface RollOutput {
  readonly html: () => string;
  readonly title: string;
  /** The PDF's working name in the app's cache. */
  readonly made: string;
  /** The name offered when saving. */
  readonly file: string;
  readonly landscape: boolean;
}

/** The output of `choice` for `book`, for `month`, `day` or the slip's `unit` where it takes one. */
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
    readonly unit?: RollCallUnit;
  },
): RollOutput {
  const { choice, book, blank, month, day, unit } = options;
  const version = blank && choice !== 'day' && choice !== 'slip' ? ` - ${t('documents.output.blank')}` : '';
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
    case 'slip': {
      if (unit === undefined) throw new RangeError('A slip needs its roll call');
      const time = slipLabel(data, t, unit).replace(/[\u2066-\u2069]/g, '');
      const group = unit.groupId.toLowerCase().replace(/[^a-z0-9]/g, '');
      return {
        html: () => rollSlipPages(data, t, book, unit),
        title: `${t('rollPrint.slip.name')} · ${unit.day} · ${time}`,
        made: `roll-slip-${unit.day}-${unit.half}-${unit.sessions[0]?.slot.index ?? 0}-${group}`.slice(0, 64),
        file: file(`${t('rollPrint.slip.name')} ${unit.day} ${time}`),
        landscape: false,
      };
    }
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
