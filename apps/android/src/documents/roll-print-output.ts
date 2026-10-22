// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What each of Roll-print's choices prints (#217, answers 254, 260, 262,
// 264 and 265): its pages for one book, the print job's title, the PDF's
// working name and the name offered when saving, and its orientation. The
// monthly spread, the front pages, the blank day sheet and the session slip
// are A4 portrait; the yearly summary is A4 landscape, and the seating plans
// are when a room is wide (answer 265). The day sheet, the slip and the
// plans have no blank version; a slip is asked for with its roll call.

import { parseDay, type Day, type RollCallUnit } from '@minhajna/core';
import { monthLabel, yearShown, type DocumentData, type Translate } from './document-data';
import { rollDayPages, sheetTitle } from './roll-day-sheet';
import { rollFrontPages } from './roll-front-pages';
import { rollSeatsPages, seatPlans, seatsLandscape } from './roll-seats';
import { rollSlipPages, slipLabel } from './roll-slip';
import { rollSpreadPages, type RollBook } from './roll-spread-pages';
import { rollYearPages } from './roll-year-pages';

export type RollPrintChoice = 'spread' | 'year' | 'front' | 'day' | 'slip' | 'seats';

export interface RollOutput {
  readonly html: () => string;
  readonly title: string;
  /** The PDF's working name in the app's cache. */
  readonly made: string;
  /** The name offered when saving. */
  readonly file: string;
  readonly landscape: boolean;
  /** What it covers, for the activity log: the month, the day, or the school year. */
  readonly period: string;
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
    /** The one seating plan to print, by its group, rather than every plan of the class. */
    readonly plan?: string;
  },
): RollOutput {
  const { choice, book, blank, month, day, unit, plan } = options;
  const version =
    blank && choice !== 'day' && choice !== 'slip' && choice !== 'seats' ? ` - ${t('documents.output.blank')}` : '';
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
        period: data.year.id,
      };
    case 'front':
      return {
        html: () => rollFrontPages(data, t, blank, [book]),
        title: `${t('documents.rollBook')} · ${t('rollPrint.front.name')}`,
        made: 'roll-front',
        file: file(`${t('rollPrint.front.name')} ${data.year.id}`),
        landscape: false,
        period: data.year.id,
      };
    case 'day':
      return {
        html: () => rollDayPages(data, t, book, day),
        title: sheetTitle(data, t, day),
        made: `roll-day-${day}`,
        file: file(`${t('rollPrint.day.name')} ${day}`),
        landscape: false,
        period: day,
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
        period: unit.day,
      };
    }
    case 'seats': {
      const group = data.state.classes
        .get(book.classId)
        ?.groups.find((one) => one.id === plan && one.kind !== 'whole')?.name;
      return {
        html: () => rollSeatsPages(data, t, book, plan),
        title: t('rollPrint.seats.name'),
        made: 'roll-seats',
        file: file(group === undefined ? t('rollPrint.seats.name') : `${t('rollPrint.seats.name')} ${group}`),
        landscape: seatsLandscape(seatPlans(data, book.classId, plan)),
        period: data.year.id,
      };
    }
    default:
      return {
        html: () => rollSpreadPages(data, t, blank, month, [book]),
        title: t('rollPrint.spreadTitle', { month: monthLabel(data, parseDay(`${month}-01`)) }),
        made: `roll-${month}`,
        file: file(month),
        landscape: false,
        period: month,
      };
  }
}
