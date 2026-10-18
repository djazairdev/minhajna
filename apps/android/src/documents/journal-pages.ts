// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The daily journal's page for a day (#212), from the record book: each
// session of the day in order, a confirmed one as the texts book takes it
// and one still awaiting confirmation in grey. The blank page keeps the
// head and the columns, with the day left to write by hand.

import { courseSetup, formatDayWithMonth, todayView, weekday } from '@minhajna/core';
import { bookLines } from '../entry/book-lines';
import { coreContext } from '../storage/core-context';
import { sessionMeta } from '../today/today-meta';
import { schoolNames, yearLabel, type DocumentData, type Translate } from './document-data';
import { journalHtml, type JournalDay } from './journal-html';

/** The journal's page for `data.day`, or a blank one with its head filled. */
export function journalPages(data: DocumentData, t: Translate, blank: boolean): string {
  const context = coreContext(data);
  const title = (day: DocumentData['day']) =>
    `${t(`week.days.${weekday(day)}`)} ${formatDayWithMonth(day, data.lang, data.profile)}`;
  const view = todayView(context, data.day);
  const day: JournalDay = blank
    ? { title: '', entries: [] }
    : {
        title: title(data.day),
        entries: view.sessions
          .filter((item) => item.status !== 'calendar')
          .map((item) => {
            const meta = sessionMeta(data, t, data.dir, item, false);
            return {
              time: meta.slot,
              className: meta.className,
              lines:
                item.record === null
                  ? [{ text: t('documents.awaiting') }]
                  : bookLines(t, courseSetup(context, item.course.id).pack, item.record, title),
              awaiting: item.record === null,
            };
          }),
      };
  return journalHtml(
    {
      lang: data.lang,
      dir: data.dir,
      book: t('documents.journal'),
      school: schoolNames(data),
      year: t('documents.year', { year: yearLabel(data) }),
      time: t('documents.time'),
      className: t('documents.className'),
      content: t('documents.content'),
      teacher: t('documents.teacher'),
      director: t('documents.director'),
      empty: blank ? '' : t('documents.empty'),
    },
    [day],
  );
}
