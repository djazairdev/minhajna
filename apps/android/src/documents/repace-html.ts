// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed re-pace draft (#229, Repace, Repace-primary, answers 367 and
// 371): one A4 portrait page with the school and the year, the print day,
// the title, the teacher, the subject and the class, the draft's dates and
// counts, its weeks as the screen lists them, what changes, and the line
// for the signature of whoever prepared it, with the drawn signature under
// it when chosen (#236, answer 414); in primary, the director's box for the
// date, the stamp and the signature. It holds no pupils' data, so it has no
// confidential mark. Black and white, as every printed document.

import { formatDay, type Context, type CountryProfile, type Day, type RepaceDraft } from '@minhajna/core';
import { courseLabel, termName } from '../exams/course-label';
import { subjectName } from '../extra/extra-rules';
import { changeLines, countLines, rangeWords, weekRows } from '../plan/repace-rules';
import type { Language } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import type { Translate } from './document-data';
import { escapeHtml, printDocument } from './print-html';

/** Who and what the page is for, in words already isolated where they come from the teacher. */
export interface RepaceHeader {
  readonly school: string;
  readonly year: string;
  readonly day: string;
  readonly name: string;
  readonly subject: string;
  readonly className: string;
}

type Months = Pick<CountryProfile, 'months'>;

const CSS =
  '.head{display:flex;justify-content:space-between;font-size:10pt}' +
  'h1{font-family:Ruqaa,Naskh,serif;text-align:center;font-size:18pt;margin:3mm 0 1mm}' +
  '.who{text-align:center;font-weight:700}.period{text-align:center;font-size:10pt;margin-bottom:3mm}' +
  'table.weeks{width:100%;border-collapse:collapse;border:0.4mm solid #000;margin:2mm 0 3mm}' +
  'table.weeks td,table.weeks th{border:0.2mm solid #000;padding:1.2mm 2mm;text-align:start;vertical-align:top}' +
  'table.weeks td.n,table.weeks th.n{text-align:center;width:14mm}table.weeks th{background:#e6e6e6}' +
  'table.weeks td.when{width:34mm}tr{break-inside:avoid}' +
  'p{margin:0 0 1.5mm}h2{font-size:11pt;margin:3mm 0 1mm}ul{margin:0;padding-inline-start:6mm}' +
  '.prepared{margin-top:6mm}.prepared .drawn{margin:1mm 0 0}' +
  '.box{border:0.3mm solid #000;margin-top:4mm;padding:2mm;height:32mm;display:flex;flex-direction:column;gap:3mm}';

/** The page's content. */
function content(
  t: Translate,
  draft: RepaceDraft,
  header: RepaceHeader,
  language: Language,
  profile: Months,
  mark: string,
) {
  const e = escapeHtml;
  const weekPack = draft.weeks.some((week) => week.planWeeks.length > 0);
  const head =
    `<tr><th class="when">${e(t('repace.week'))}</th>` +
    `<th>${e(t(weekPack ? 'repace.planWeeks' : 'repace.items'))}</th>` +
    `<th class="n">${e(t('repace.sessions'))}</th></tr>`;
  const rows = weekRows(t, draft, language, profile)
    .map((row) => {
      const what = row.badge === undefined ? row.what : `${row.what} · ${row.badge}`;
      return `<tr><td class="when">${e(row.when)}</td><td>${e(what)}</td><td class="n">${e(row.count)}</td></tr>`;
    })
    .join('');
  const who = t('repace.sheet.who', { name: header.name, subject: header.subject, class: header.className });
  const director = draft.primary
    ? `<div class="box"><b>${e(t('repace.sheet.director'))}</b>` +
      `<span>${e(t('repace.sheet.directorDate'))}</span><span>${e(t('repace.sheet.stamp'))}</span></div>`
    : '';
  return (
    `<div class="head"><span>${e(t('repace.sheet.school', { school: header.school, year: header.year }))}</span>` +
    `<span>${e(t('repace.sheet.date', { day: header.day }))}</span></div>` +
    `<h1>${e(t('repace.sheet.title', { term: termName(t, draft.term) }))}</h1>` +
    `<div class="who">${e(who)}</div>` +
    `<div class="period">${e(rangeWords(t, draft, language, profile))}</div>` +
    countLines(t, draft)
      .map((line) => `<p>${e(line)}</p>`)
      .join('') +
    `<table class="weeks"><thead>${head}</thead><tbody>${rows}</tbody></table>` +
    `<h2>${e(t('repace.changed'))}</h2><ul>${changeLines(t, draft)
      .map((line) => `<li>${e(line)}</li>`)
      .join('')}</ul>` +
    `<p class="prepared">${e(t('repace.sheet.prepared'))}${mark}</p>${director}`
  );
}

/** The page's header for a class's draft printed on `day`. */
export function repaceHeader(t: Translate, context: Context, profile: CountryProfile, courseId: string, day: Day) {
  const { state, ref } = context;
  const course = state.courses.get(courseId);
  const room = course && state.classes.get(course.classId);
  const school = room && state.schools.get(room.schoolId);
  return {
    school: isolate(school?.name ?? ''),
    year: isolate(`${ref.year.from.slice(0, 4)}-${ref.year.to.slice(0, 4)}`),
    day: isolate(formatDay(day)),
    name: isolate(state.personal?.name?.trim() || '…………………'),
    subject: course === undefined ? '' : subjectName(profile, course.subject),
    className: isolate(courseLabel(t, state, profile, courseId)),
  };
}

/** The whole printed draft, in the interface's language and direction, with the drawn signature's `mark` if any. */
export function repaceHtml(
  t: Translate,
  draft: RepaceDraft,
  header: RepaceHeader,
  language: Language,
  profile: Months,
  dir: 'rtl' | 'ltr',
  mark = '',
): string {
  return printDocument({
    lang: language,
    dir,
    title: t('repace.sheet.title', { term: termName(t, draft.term) }),
    landscape: false,
    css: CSS,
    pages: [content(t, draft, header, language, profile, mark)],
  });
}
