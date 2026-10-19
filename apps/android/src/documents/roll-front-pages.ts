// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's front pages from the record book (#217, Roll-print,
// answers 254 and 262), for one book or every one: the cover's lines and
// the class's boys, girls and total from the book's list on the day given,
// the list in the class's order, and the two confidential pages' headings.
// The blank version keeps the cover's lines and the headings, with the
// list's rows numbered, and leaves the names, registration numbers and
// counts empty, as the primary journal's front pages do.

import { groupPupils } from '@minhajna/core';
import { listNumbers } from '../roll/roll-rules';
import { coreContext } from '../storage/core-context';
import { yearShown, type DocumentData, type Translate } from './document-data';
import { rollFrontHtml, type FrontSheet } from './roll-front-html';
import { bookScope, padRows, rollBooks, type RollBook } from './roll-spread-pages';

function sheet(data: DocumentData, t: Translate, blank: boolean, book: RollBook): FrontSheet {
  const context = coreContext(data);
  const day = data.today ?? data.day;
  const numbers = listNumbers(context, book.classId);
  const pupils = groupPupils(context, book.classId, book.groupId, day);
  const boys = pupils.filter((pupil) => pupil.sex === 'm').length;
  const field = (label: string, value: string | undefined) =>
    `${label}${t('documents.journalLines.colon')}${value ?? ''}`;
  const rows = pupils.map((pupil) => ({
    number: numbers.get(pupil.id) ?? 0,
    cells: blank ? ['', ''] : [pupil.name, pupil.registration ?? ''],
  }));
  return {
    cover: {
      title: t('documents.rollBook'),
      lines: [
        bookScope(data, book, null),
        t('documents.year', { year: yearShown(data) }),
        field(t('rollPrint.front.teacher'), data.state.personal?.name),
      ],
      counts: blank ? '' : t('rollPrint.front.counts', { boys, girls: pupils.length - boys, total: pupils.length }),
      legend: [
        `- ${t('rollBook.legend.morning')} · ǀ ${t('rollBook.legend.afternoon')} · + ${t('rollBook.legend.day')}`,
        `(-) ${t('rollBook.legend.justified')} · +م½ ${t('rollBook.legend.half')}`,
      ],
    },
    listTitle: t('rollPrint.front.list'),
    listHeads: [t('documents.number'), t('documents.name'), t('rollPrint.front.registration')],
    list: padRows(rows, (number) => ({ number, cells: ['', ''] })).map((row) => [String(row.number), ...row.cells]),
    records: [
      {
        title: t('rollPrint.front.recordOne'),
        heads: [
          t('documents.number'),
          t('documents.name'),
          t('rollPrint.front.registration'),
          t('rollPrint.front.entered'),
          t('rollPrint.front.left'),
          t('rollPrint.front.born'),
        ],
      },
      {
        title: t('rollPrint.front.recordTwo'),
        heads: [
          t('documents.number'),
          t('rollPrint.front.father'),
          t('rollPrint.front.fatherJob'),
          t('rollPrint.front.motherJob'),
          t('rollPrint.front.previous'),
          t('rollPrint.front.siblings'),
          t('rollPrint.front.address'),
        ],
      },
    ],
    book: book.classId,
  };
}

/** The front pages for each book given, or for every book, as recorded or blank. */
export function rollFrontPages(
  data: DocumentData,
  t: Translate,
  blank: boolean,
  books: readonly RollBook[] = rollBooks(data),
): string {
  return rollFrontHtml(
    {
      lang: data.lang,
      dir: data.dir,
      title: `${t('documents.rollBook')} · ${t('rollPrint.front.name')}`,
      confidential: t('documents.confidential'),
    },
    books.map((book) => sheet(data, t, blank, book)),
  );
}
