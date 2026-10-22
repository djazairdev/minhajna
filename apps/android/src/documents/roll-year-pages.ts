// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's yearly summary from the record book (#217,
// Roll-print, answers 255 and 260), for one book or every one: the Month-year
// screen's figures, each month counted up to today, with the class's totals.
// The blank summary keeps the names and the months, and leaves the figures
// empty.

import type { PupilCount } from '@minhajna/core';
import { percent, totals, yearView } from '../rollbook/month-rules';
import { coreContext } from '../storage/core-context';
import { yearShown, type DocumentData, type Translate } from './document-data';
import { bookScope, rollBooks, type RollBook } from './roll-spread-pages';
import { rollYearHtml, type YearLine, type YearSheet } from './roll-year-html';
import { documentSignature, drawnMark } from './drawn-mark';

type Figures = Pick<PupilCount, 'possible' | 'absent' | 'present' | 'rate'>;

function four(count: Figures | null, blank: boolean): string[] {
  if (blank || count === null || count.possible === 0) return ['', '', '', ''];
  return [String(count.possible), String(count.absent), String(count.present), percent(count.rate)];
}

function sheet(data: DocumentData, t: Translate, blank: boolean, book: RollBook): YearSheet {
  const context = coreContext(data);
  const today = data.today ?? data.year.to;
  const view = yearView(context, book.classId, book.groupId, today);
  const monthName = (month: string) => data.profile.months?.[Number(month.slice(5, 7)) - 1]?.[data.lang] ?? month;
  const rows: YearLine[] = view.rows.map((row) => ({
    number: String(row.number),
    name: row.name,
    figures: [...row.months.flatMap((count) => four(count, blank)), ...four(row.year, blank)],
  }));
  const sums = view.months.map((_, index) => totals(view.rows.map((row) => row.months[index] ?? null)));
  const year = totals(view.rows.map((row) => row.year));
  return {
    title: t('rollPrint.yearTitle', { year: yearShown(data) }),
    scope: bookScope(data, book, null),
    months: view.months.map((one) => monthName(one.month)),
    rows,
    total: {
      number: '',
      name: t('rollBook.classTotal'),
      figures: [...sums.flatMap((sum) => four(sum, blank)), ...four(year, blank)],
    },
    note: blank ? '' : t('rollBook.yearNote', { day: `\u2066${today.slice(8)}/${today.slice(5, 7)}\u2069` }),
    book: book.classId,
  };
}

/** The yearly summary for each book given, or for every book, as recorded or blank. */
export function rollYearPages(
  data: DocumentData,
  t: Translate,
  blank: boolean,
  books: readonly RollBook[] = rollBooks(data),
): string {
  return rollYearHtml(
    {
      lang: data.lang,
      dir: data.dir,
      title: t('rollPrint.yearTitle', { year: yearShown(data) }),
      number: t('documents.number'),
      name: t('documents.name'),
      heads: [t('rollBook.possible'), t('rollBook.absent'), t('rollBook.present'), t('rollBook.rate')],
      year: t('rollBook.yearTotal'),
      teacher: t('rollPrint.teacher'),
      mark: drawnMark(documentSignature(data, blank)),
      director: t('rollPrint.director'),
      inspector: t('rollPrint.inspector'),
      date: t('rollPrint.date'),
      confidential: t('documents.confidential'),
    },
    books.map((book) => sheet(data, t, blank, book)),
  );
}
