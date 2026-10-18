// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The CEM and lycée daily journal's front pages (#216, Journal-front,
// R-3.8-12), from the record book and the calendar:
// - the teacher's card: the name and rank as the teacher gave them, the
//   subjects, schools and classes taught this school year, and the year as
//   «2026-2027» (R-3.8-61), with the director's visa;
// - seminars, training and meetings, and holidays and national days, as
//   front-tables.ts gives them.
// The blank version keeps the labels and the tables' heads, and leaves
// everything else for the pen. Primary classes keep their own journal, so
// they and the primary schools are left out of the card and the seminars.

import { yearLabel, yearShown, type DocumentData, type Translate } from './document-data';
import { frontTables } from './front-tables';
import { journalFrontHtml } from './journal-front-html';
import { bookClasses, bookCourses } from './texts-book-pages';
import { isolate } from '../week/grid-labels';

type FrontKey = 'name' | 'card' | 'teacherName' | 'rank' | 'subject' | 'school' | 'year' | 'classes' | 'and';

/** The journal's front pages for the school year of `data`, or blank ones with their labels and heads. */
export function journalFrontPages(data: DocumentData, t: Translate, blank: boolean): string {
  const key = (name: FrontKey) => `documents.journalFront.${name}` as const;
  const courses = bookCourses(data).filter(({ schoolClass }) => schoolClass.level !== 'primary');
  const taught = bookClasses(data).filter((one) => one.level !== 'primary');
  const all = [...data.state.schools.values()];
  const own = all.filter((school) => school.levels.some((level) => level !== 'primary'));
  const schools = own.length > 0 ? own : all;
  const names = schools.map((school) => school.name).join(' · ');
  const { events, holidays } = frontTables(data, t, blank, schools, taught);
  const subjects = [...new Set(courses.map(({ course }) => course.subject))].map(
    (code) => data.profile.subjects.find((one) => one.code === code)?.name[data.lang] ?? code,
  );
  const classes = taught.map((one) => isolate(one.name));
  const value = (text: string | undefined) => (blank ? '' : (text ?? ''));
  return journalFrontHtml(
    {
      lang: data.lang,
      dir: data.dir,
      book: t('documents.journal'),
      front: t(key('name')),
      school: blank ? '' : names,
      year: t('documents.year', { year: yearShown(data) }),
      card: t(key('card')),
      director: t('documents.director'),
    },
    [
      { label: t(key('teacherName')), value: value(data.state.personal?.name) },
      { label: t(key('rank')), value: value(data.state.teacher?.rank) },
      { label: t(key('subject')), value: value(subjects.join(t(key('and')))) },
      { label: t(key('school')), value: value(names) },
      { label: t(key('year')), value: yearLabel(data) },
      { label: t(key('classes')), value: value(classes.join(' · ')) },
    ],
    [events, holidays],
  );
}
