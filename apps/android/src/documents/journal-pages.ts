// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The CEM and lycée daily journal's page for a day (#212, #216, Journal,
// R-3.8-13), from the record book: each session of the day in order, with
// its time as the book writes it by hand and its journal lines; one still
// awaiting confirmation prints in grey with what confirming it would record.
// The teacher keeps one journal for all classes or one per class
// (R-3.8-38): per class, each class taught that day gets its own page. The
// blank page keeps the head and the columns, with the day left to write by
// hand; per class, a blank page for each class taught this school year.
// Primary classes keep their own journal, so they are left out here.

import { courseSetup, todayView, type TodaySession } from '@minhajna/core';
import { bookSpan } from '../entry/book-lines';
import { coreContext } from '../storage/core-context';
import { sessionTime } from '../times/times-rules';
import { sessionMeta } from '../today/today-meta';
import type { DocumentLayout } from './catalogue';
import { dayTitle, schoolNames, yearShown, type DocumentData, type Translate } from './document-data';
import { journalHtml, type JournalDay, type JournalEntry } from './journal-html';
import { journalLines, proposedRecord, type JournalNames } from './journal-lines';
import { bookClasses } from './texts-book-pages';
import { isolate } from '../week/grid-labels';

export type JournalLayout = 'combined' | 'per-class';

export const JOURNAL_LAYOUTS: readonly JournalLayout[] = ['combined', 'per-class'];

/** The daily journals' layouts, as the output offers them: one journal for all classes, or one for each. */
export function journalLayouts(t: Translate): readonly DocumentLayout[] {
  return JOURNAL_LAYOUTS.map((value) => ({
    value,
    label: t(`documents.output.layouts.${value}`),
    description: t(`documents.output.layouts.${value}Line`),
  }));
}

/** The journal's pages for `data.day`, combined or one per class, or blank ones with their heads filled. */
export function journalPages(data: DocumentData, t: Translate, blank: boolean, layout?: string): string {
  const context = coreContext(data);
  const title = (day: DocumentData['day']) => dayTitle(data, t, day);
  const names: JournalNames = {
    type: (code) => data.profile.sessionTypes.find((one) => one.code === code)?.name[data.lang] ?? code,
    day: title,
  };
  const entry = (item: TodaySession): JournalEntry => {
    const meta = sessionMeta(data, t, data.dir, item, false);
    const schoolClass = data.state.classes.get(item.course.classId);
    const school = schoolClass && data.state.schools.get(schoolClass.schoolId);
    const time = sessionTime(data, school, item.session.slot, item.session.day);
    const awaiting = item.record === null;
    const record = item.record ?? proposedRecord(item.session, item.proposal);
    return {
      time: bookSpan(t, time, data.dir) ?? meta.slot,
      className: meta.className,
      lines: journalLines(t, names, courseSetup(context, item.course.id).pack, record, awaiting),
      awaiting,
    };
  };
  const classes = bookClasses(data).filter((one) => one.level !== 'primary');
  const sessions = blank
    ? []
    : todayView(context, data.day).sessions.filter(
        (item) => item.status !== 'calendar' && classes.some((one) => one.id === item.course.classId),
      );
  const days: JournalDay[] =
    layout !== 'per-class'
      ? [{ title: blank ? '' : title(data.day), entries: sessions.map(entry) }]
      : (blank ? classes : classes.filter((one) => sessions.some((item) => item.course.classId === one.id))).map(
          (one) => ({
            title: blank ? '' : title(data.day),
            className: t('documents.textsBook.className', { name: isolate(one.name) }),
            entries: sessions.filter((item) => item.course.classId === one.id).map(entry),
            book: one.id,
          }),
        );
  return journalHtml(
    {
      lang: data.lang,
      dir: data.dir,
      book: t('documents.journal'),
      school: schoolNames(data),
      year: t('documents.year', { year: yearShown(data) }),
      time: t('documents.time'),
      className: t('documents.className'),
      content: t('documents.content'),
      teacher: t('documents.teacher'),
      director: t('documents.director'),
      empty: blank ? '' : t('documents.empty'),
      colon: t('documents.journalLines.colon'),
    },
    days.length === 0 ? [{ title: blank ? '' : title(data.day), entries: [] }] : days,
  );
}
