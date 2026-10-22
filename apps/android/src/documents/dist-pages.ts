// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed distributions (#237, answers 416 (7), 421 to 423): one A4
// portrait page for each class and subject the teacher has a plan for, in the
// order of the Classes tab, in the layout chosen. The annual one lists each
// sequence with its months, its sessions and how many are confirmed; the
// monthly one, for the chosen day's month, each teaching week with its days,
// its resources and its sessions; the termly one, for the chosen day's term,
// each sequence with its days and sessions in that term. Months take the
// profile's names. A total closes each table. The strip «توقيع الأستاذ»,
// «تأشيرة المدير», «تأشيرة المفتش» ends the page, the teacher's box taking the
// drawn signature. The blank version keeps each head and the columns over empty
// rows, for the pen.

import {
  annualDistribution,
  compareDays,
  courseSetup,
  distributionSessions,
  formatDayWithMonth,
  monthlyDistribution,
  type AnnualRow,
  type Context,
  type Day,
  type DistributionSession,
  type Term,
} from '@minhajna/core';
import { noteSubject } from '../notes/note-rules';
import { coreContext } from '../storage/core-context';
import { isolate } from '../week/grid-labels';
import type { DocumentKind, DocumentLayout } from './catalogue';
import { monthLabel, yearShown, type DocumentData, type Translate } from './document-data';
import { documentSignature, drawnMark } from './drawn-mark';
import { escapeHtml, printDocument } from './print-html';
import { bookCourses } from './texts-book-pages';

export type DistLayout = 'year' | 'month' | 'term';

const BLANK_ROWS: Record<DistLayout, number> = { year: 12, month: 5, term: 8 };

const CSS =
  '.top{display:flex;justify-content:space-between;font-size:10pt;margin-bottom:3mm}' +
  'h1{font-family:Ruqaa,Naskh;font-size:17pt;text-align:center;margin:0 0 1mm}' +
  '.scope{text-align:center;font-size:11pt;margin:0 0 4mm}' +
  'table.dist{width:100%;border-collapse:collapse;table-layout:fixed}' +
  'table.dist th,table.dist td{border:0.8pt solid #000;padding:1.5mm 2mm;font-size:10.5pt;vertical-align:top}' +
  'table.dist th{font-weight:700;background:#eee}table.dist td.n{text-align:center}' +
  'table.dist tfoot td{font-weight:700}table.dist tbody td{height:7mm}td.none{text-align:center}' +
  '.boxes{display:grid;grid-template-columns:1fr 1fr 1fr;margin-top:6mm;border:1.2pt solid #000;border-radius:4pt;' +
  'break-inside:avoid;page-break-inside:avoid}.boxes div{height:28mm;padding:3pt 8pt}' +
  '.boxes div+div{border-inline-start:0.8pt solid #000}.boxes b{font-family:Ruqaa,Naskh;font-size:12pt}' +
  '.latin h1,.latin .boxes b{font-family:Sans,Naskh,sans-serif}';

/** The three distributions as the output's layouts, the annual one first. */
export function distLayouts(t: Translate): DocumentLayout[] {
  return (['year', 'month', 'term'] as const).map((value) => ({
    value,
    label: t(`distributions.layouts.${value}.label`),
    description: t(`distributions.layouts.${value}.description`),
  }));
}

/** The term a day falls in, or the next one after it, or the year's last. */
export function termOf(data: DocumentData, day: Day): Term | undefined {
  const { terms } = data.year;
  return terms.find((term) => compareDays(day, term.to) <= 0) ?? terms[terms.length - 1];
}

/** The term's name, such as «الفصل الأول». */
export function termName(t: Translate, term: number): string {
  return t('distributions.term', { term: t(`ready.terms.${term as 1 | 2 | 3}`) });
}

const contexts = new WeakMap<DocumentData, Context>();

/** The core's view of the data, made once for the same data, as the output asks for its line, state and pages. */
export function distContext(data: DocumentData): Context {
  const known = contexts.get(data);
  if (known !== undefined) return known;
  const context = coreContext(data);
  contexts.set(data, context);
  return context;
}

/** The classes and subjects with a plan this school year, each with it, in the order of the Classes tab. */
export function plannedCourses(data: DocumentData) {
  const context = distContext(data);
  return bookCourses(data).flatMap(({ course, schoolClass }) => {
    const pack = courseSetup(context, course.id).pack;
    return pack === null ? [] : [{ course, schoolClass, pack }];
  });
}

const monthName = (data: DocumentData, day: Day) =>
  data.profile.months?.[Number(day.slice(5, 7)) - 1]?.[data.lang] ?? day.slice(5, 7);

/** A sequence's months, such as «من سبتمبر إلى أكتوبر», or one month alone. */
export function monthsSpan(data: DocumentData, t: Translate, from: Day, to: Day): string {
  const first = monthName(data, from);
  const last = monthName(data, to);
  return from.slice(0, 7) === to.slice(0, 7) ? first : t('distributions.months', { from: first, to: last });
}

/** Days as a period, such as «من 4 إلى 8 أكتوبر 2026», the first day's month and year said only when they differ. */
export function daysSpan(data: DocumentData, t: Translate, from: Day, to: Day): string {
  const date = (day: Day) => formatDayWithMonth(day, data.lang, data.profile);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const first = sameMonth ? String(Number(from.slice(8, 10))) : date(from);
  return from === to ? date(to) : t('distributions.days', { from: first, to: date(to) });
}

/** A sequence's name as printed: its title, or its plan week. */
export function sequenceName(t: Translate, row: Pick<AnnualRow, 'title' | 'week'>): string {
  return row.week === undefined ? row.title : t('distributions.week', { week: row.week });
}

const cell = (text: string, number = false) => `<td${number ? ' class="n"' : ''}>${escapeHtml(text)}</td>`;

const counted = (sessions: readonly DistributionSession[]) => sessions.reduce((sum, one) => sum + one.credit, 0);

const confirmed = (sessions: readonly DistributionSession[]) =>
  sessions.reduce((sum, one) => sum + (one.confirmed ? one.credit : 0), 0);

/** The table: its head, its rows or the line that there are none, and the total; empty rows when blank. */
function table(
  t: Translate,
  heads: readonly (readonly [string, number])[],
  rows: readonly string[],
  total: readonly string[] | null,
): string {
  const width = heads.length;
  const cols = heads.map(([, share]) => `<col style="width:${share}%">`).join('');
  const head = heads.map(([one]) => `<th>${escapeHtml(one)}</th>`).join('');
  const body =
    rows.length > 0
      ? rows.join('')
      : `<tr><td class="none" colspan="${width}">${escapeHtml(t('distributions.print.empty'))}</td></tr>`;
  const foot =
    total === null
      ? ''
      : `<tfoot><tr>${[cell(t('distributions.columns.total')), ...total.map((one) => cell(one, true))].join('')}` +
        '</tr></tfoot>';
  return (
    `<table class="dist"><colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead>` +
    `<tbody>${body}</tbody>${foot}</table>`
  );
}

/** A class and subject's page in the layout, as recorded or blank. */
function page(
  data: DocumentData,
  t: Translate,
  layout: DistLayout,
  blank: boolean,
  { course, schoolClass, pack }: ReturnType<typeof plannedCourses>[number],
): string {
  const context = distContext(data);
  const year = blank ? [] : distributionSessions(context, course.id);
  const term = termOf(data, data.day);
  const sessions =
    layout === 'term' && term !== undefined
      ? year.filter((one) => compareDays(one.session.day, term.from) >= 0 && compareDays(one.session.day, term.to) <= 0)
      : year;
  const subject = noteSubject(t, data.profile, data.lang, course, schoolClass);
  const when =
    layout === 'month'
      ? monthLabel(data, data.day)
      : layout === 'term' && term !== undefined
        ? t('distributions.termLine', { term: termName(t, term.number), days: daysSpan(data, t, term.from, term.to) })
        : '';
  const scope = [isolate(schoolClass.name), subject, when].filter(Boolean).join(' · ');
  const empty = (columns: number) =>
    Array.from({ length: BLANK_ROWS[layout] }, () => `<tr>${'<td></td>'.repeat(columns)}</tr>`);
  const byWeeks = pack.anchor.kind === 'weeks' && !pack.items.some((item) => item.kind === 'unit');
  let content: string;
  if (layout === 'month') {
    const heads = (
      [
        ['week', 28],
        ['resources', 58],
        ['sessions', 14],
      ] as const
    ).map(([one, share]) => [t(`distributions.columns.${one}`), share] as const);
    const weeks = blank ? [] : monthlyDistribution(context, course.id, data.day.slice(0, 7), year);
    const rows = blank
      ? empty(3)
      : weeks.map(
          (week) =>
            `<tr>${cell(daysSpan(data, t, week.from, week.to))}` +
            `<td>${week.resources.map((one) => escapeHtml(one.title)).join('<br>')}</td>` +
            `${cell(String(week.sessions), true)}</tr>`,
        );
    const total = weeks.reduce((sum, week) => sum + week.sessions, 0);
    content = table(t, heads, rows, blank ? ['', ''] : ['', String(total)]);
  } else {
    const heads = (
      [
        [byWeeks ? 'week' : 'sequence', 38],
        ['period', 34],
        ['sessions', 13],
        ['confirmed', 15],
      ] as const
    ).map(([one, share]) => [t(`distributions.columns.${one}`), share] as const);
    const rows = blank
      ? empty(4)
      : annualDistribution(context, course.id, sessions).map(
          (row) =>
            `<tr>${cell(sequenceName(t, row))}` +
            cell(layout === 'year' ? monthsSpan(data, t, row.from, row.to) : daysSpan(data, t, row.from, row.to)) +
            `${cell(String(row.sessions), true)}${cell(String(row.confirmed), true)}</tr>`,
        );
    content = table(
      t,
      heads,
      rows,
      blank ? ['', '', ''] : ['', String(counted(sessions)), String(confirmed(sessions))],
    );
  }
  const school = data.state.schools.get(schoolClass.schoolId)?.name ?? '';
  const boxes = [t('documents.timetable.teacherBox'), t('documents.director'), t('documents.timetable.inspector')];
  const mark = drawnMark(documentSignature(data, blank));
  const strip = boxes.map((box, index) => `<div><b>${escapeHtml(box)}</b>${index === 0 ? mark : ''}</div>`).join('');
  return (
    `<div class="top"><span>${escapeHtml(school)}</span>` +
    `<span>${escapeHtml(t('documents.year', { year: yearShown(data) }))}</span></div>` +
    `<h1>${escapeHtml(t(`distributions.titles.${layout}`))}</h1><p class="scope">${escapeHtml(scope)}</p>` +
    content +
    `<div class="boxes">${strip}</div>`
  );
}

/** The whole document: a page for each class and subject with a plan, in the layout, as recorded or blank. */
export function distPages(data: DocumentData, t: Translate, blank: boolean, layout?: string): string {
  const chosen: DistLayout = layout === 'month' || layout === 'term' ? layout : 'year';
  const pages = plannedCourses(data).map((one) => page(data, t, chosen, blank, one));
  const all = pages.length > 0 ? pages : [`<p class="none">${escapeHtml(t('distributions.print.noPlan'))}</p>`];
  return printDocument({
    lang: data.lang,
    dir: data.dir,
    title: t('distributions.name'),
    landscape: false,
    css: CSS,
    pages: data.dir === 'ltr' ? all.map((one) => `<div class="latin">${one}</div>`) : all,
  });
}

/** The distributions as a document of a day: the day chooses the month or the term (answer 423). */
export const DIST_KIND: DocumentKind = {
  id: 'distributions',
  drawn: 'box',
  icon: 'homework',
  pupils: false,
  landscape: false,
  empty: (data) => plannedCourses(data).length === 0,
  period: (data) => data.day,
  title: (t) => t('distributions.name'),
  line: (data, t) =>
    [
      t('documents.list.classes', { count: new Set(plannedCourses(data).map((one) => one.schoolClass.id)).size }),
      t('distributions.line'),
    ].join(' · '),
  blankLine: (t) => t('distributions.print.blank'),
  signatureLine: (t) => t('documents.output.signatureTimetable'),
  emptyLine: (t) => t('distributions.print.noPlan'),
  byDay: true,
  layouts: distLayouts,
  layoutLabel: (t) => t('distributions.screen.tabs'),
  pages: distPages,
};
