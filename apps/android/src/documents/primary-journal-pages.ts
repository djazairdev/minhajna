// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The primary daily journal's pages for a day (#216, P-Journal, R-3.8-09),
// from the record book: a page for each primary class taught this school
// year that has a session that day, and each session in its band:
// - the duration: from the school's bells, Ramadan's on its days, or the
//   class's session length without them;
// - the subject, with the level in a multigrade class, and the activity the
//   slot or the item names, when the app has a name for it, or else the
//   session type when it is not a lesson;
// - the content: the session's resources, how it went unless as proposed,
//   and its remarks;
// - the competence indicator, left for the pen, as no plan carries one yet;
// - the domain: the item's unit; the lesson note's number is left for the
//   pen until the app keeps lesson notes.
// A session awaiting confirmation shows what confirming it would record.
// The blank version gives every primary class a page with its bands of
// empty rows.

import {
  clockMinutes,
  courseGrade,
  courseSetup,
  isJoint,
  todayView,
  type PlanPack,
  type TodaySession,
} from '@minhajna/core';
import { yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { sessionTime } from '../times/times-rules';
import { isolate } from '../week/grid-labels';
import { dayTitle, schoolNames, yearLabel, type DocumentData, type Translate } from './document-data';
import { journalLines, proposedRecord, type JournalNames } from './journal-lines';
import { primaryJournalHtml, type PrimaryDay, type PrimaryEntry } from './primary-journal-html';
import { bookClasses } from './texts-book-pages';

/** The activities the app names; another code leaves the activity for the pen. */
const ACTIVITIES = ['reading', 'writing'] as const;

/** Whether the teacher teaches a primary class this school year, so the primary journal applies. */
export function teachesPrimary(data: DocumentData): boolean {
  return bookClasses(data).some((one) => one.level === 'primary');
}

/** The primary journal's pages for `data.day`, or blank ones with their heads filled. */
export function primaryJournalPages(data: DocumentData, t: Translate, blank: boolean): string {
  const context = coreContext(data);
  const names: JournalNames = {
    type: (code) => data.profile.sessionTypes.find((one) => one.code === code)?.name[data.lang] ?? code,
    day: (day) => dayTitle(data, t, day),
  };
  const unitOf = (pack: PlanPack | null, itemId: string | undefined) => {
    const unit = pack?.items.find((one) => one.id === itemId)?.unit;
    return unit === undefined ? undefined : pack?.items.find((one) => one.id === unit)?.title;
  };
  const entry = (item: TodaySession): PrimaryEntry => {
    const setup = courseSetup(context, item.course.id);
    const school = data.state.schools.get(setup.schoolClass.schoolId);
    const time = sessionTime(data, school, item.session.slot, item.session.day);
    const minutes = time === null ? setup.sessionMinutes : clockMinutes(time.to) - clockMinutes(time.from);
    const awaiting = item.record === null;
    const record = item.record ?? proposedRecord(item.session, item.proposal);
    const first = record.coverage[0]?.item;
    const code = item.session.activity ?? setup.pack?.items.find((one) => one.id === first)?.activity;
    const activity = ACTIVITIES.find((one) => one === code);
    const unit = unitOf(setup.pack, first);
    const content = journalLines(t, names, setup.pack, record, awaiting, { heads: true, done: true });
    const subject =
      data.profile.subjects.find((one) => one.code === item.course.subject)?.name[data.lang] ?? item.course.subject;
    return {
      minutes: t('documents.primaryJournal.minutes', { minutes }),
      subject: isJoint(setup.schoolClass)
        ? `${subject} · ${yearShort(t, courseGrade(item.course, setup.schoolClass))}`
        : subject,
      activity:
        activity !== undefined
          ? t(`documents.primaryJournal.activities.${activity}`)
          : record.sessionType === 'lesson'
            ? ''
            : names.type(record.sessionType),
      content,
      domain: unit === undefined ? '' : isolate(unit),
      awaiting,
    };
  };
  const primary = bookClasses(data).filter((one) => one.level === 'primary');
  const sessions = blank ? [] : todayView(context, data.day).sessions.filter((item) => item.status !== 'calendar');
  const days: PrimaryDay[] = primary
    .filter((one) => blank || sessions.some((item) => item.course.classId === one.id))
    .map((one) => {
      const own = sessions.filter((item) => item.course.classId === one.id);
      return {
        title: blank ? '' : dayTitle(data, t, data.day),
        className: t('documents.textsBook.className', { name: isolate(one.name) }),
        morning: own.filter((item) => item.session.slot.half === 'morning').map(entry),
        afternoon: own.filter((item) => item.session.slot.half !== 'morning').map(entry),
      };
    });
  const empty: PrimaryDay = {
    title: blank ? '' : dayTitle(data, t, data.day),
    className: '',
    morning: [],
    afternoon: [],
  };
  const key = (name: 'name' | 'morning' | 'afternoon' | 'teacher') => t(`documents.primaryJournal.${name}`);
  return primaryJournalHtml(
    {
      lang: data.lang,
      dir: data.dir,
      book: key('name'),
      school: schoolNames(data),
      year: t('documents.year', { year: yearLabel(data) }),
      heads: (['minutes', 'subject', 'activity', 'content', 'indicator', 'domain'] as const).map((head) =>
        t(`documents.primaryJournal.heads.${head}`),
      ),
      morning: key('morning'),
      afternoon: key('afternoon'),
      teacher: key('teacher'),
      director: t('documents.director'),
      empty: t('documents.empty'),
      colon: t('documents.journalLines.colon'),
    },
    days.length === 0 ? [empty] : days,
    blank,
  );
}
