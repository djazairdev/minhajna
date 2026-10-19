// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The primary daily journal's pages for a day (#216, P-Journal, R-3.8-09),
// from the record book: a page for each primary class the teacher teaches
// as its class teacher this school year that has a session that day, and
// each session in its band. A specialist's subjects, such as French, are
// left out: they have their own journal (specialists.ts).
// - the duration: from the school's bells, Ramadan's on its days, or the
//   class's session length without them;
// - the subject, with the level in a multigrade class;
// - the activity, the content and the domain, as primary-cells.ts gives
//   them; the competence indicator is left for the pen, as no plan carries
//   one yet.
// The blank version gives every such class a page with its bands of empty
// rows.

import { clockMinutes, courseGrade, courseSetup, isJoint, todayView, type TodaySession } from '@minhajna/core';
import { yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { sessionTime } from '../times/times-rules';
import { isolate } from '../week/grid-labels';
import { dayTitle, schoolNames, yearShown, type DocumentData, type Translate } from './document-data';
import {
  BLANK_ROWS,
  PRIMARY_WIDTHS,
  primaryJournalHtml,
  type PrimaryDay,
  type PrimaryEntry,
} from './primary-journal-html';
import { sessionCells } from './primary-cells';
import { bySpecialist, classTeacherClasses } from './specialists';

/** The primary journal's pages for `data.day`, or blank ones with their heads filled. */
export function primaryJournalPages(data: DocumentData, t: Translate, blank: boolean): string {
  const context = coreContext(data);
  const key = (name: 'name' | 'morning' | 'afternoon' | 'teacher') => t(`documents.primaryJournal.${name}`);
  const entry = (item: TodaySession): PrimaryEntry => {
    const { setup, ...cells } = sessionCells(data, t, context, item);
    const school = data.state.schools.get(setup.schoolClass.schoolId);
    const time = sessionTime(data, school, item.session.slot, item.session.day);
    const minutes = time === null ? setup.sessionMinutes : clockMinutes(time.to) - clockMinutes(time.from);
    const subject =
      data.profile.subjects.find((one) => one.code === item.course.subject)?.name[data.lang] ?? item.course.subject;
    return {
      ...cells,
      when: t('documents.primaryJournal.minutes', { minutes }),
      what: isJoint(setup.schoolClass)
        ? `${subject} · ${yearShort(t, courseGrade(item.course, setup.schoolClass))}`
        : subject,
    };
  };
  const primary = classTeacherClasses(data);
  const sessions = blank
    ? []
    : todayView(context, data.day).sessions.filter(
        (item) =>
          item.status !== 'calendar' &&
          !bySpecialist(data, item.course, courseSetup(context, item.course.id).schoolClass),
      );
  const days: PrimaryDay[] = primary
    .filter((one) => blank || sessions.some((item) => item.course.classId === one.id))
    .map((one) => {
      const own = sessions.filter((item) => item.course.classId === one.id);
      return {
        title: blank ? '' : dayTitle(data, t, data.day),
        className: t('documents.textsBook.className', { name: isolate(one.name) }),
        bands: (['morning', 'afternoon'] as const).map((half) => ({
          name: key(half),
          entries: own.filter((item) => (item.session.slot.half === 'morning') === (half === 'morning')).map(entry),
          blank: blank ? BLANK_ROWS[half] : 0,
        })),
        visas: [''],
        book: one.id,
      };
    });
  const empty: PrimaryDay = {
    title: blank ? '' : dayTitle(data, t, data.day),
    className: '',
    bands: [],
    visas: [''],
  };
  return primaryJournalHtml(
    {
      lang: data.lang,
      dir: data.dir,
      book: key('name'),
      school: schoolNames(data),
      year: t('documents.year', { year: yearShown(data) }),
      heads: (['minutes', 'subject', 'activity', 'content', 'indicator', 'domain'] as const).map((head) =>
        t(`documents.primaryJournal.heads.${head}`),
      ),
      widths: PRIMARY_WIDTHS,
      teacher: key('teacher'),
      director: t('documents.director'),
      empty: t('documents.empty'),
      colon: t('documents.journalLines.colon'),
    },
    days.length === 0 ? [empty] : days,
    blank,
  );
}
