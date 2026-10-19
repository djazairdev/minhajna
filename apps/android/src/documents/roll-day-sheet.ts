// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «ورقة مناداة فارغة», the paper fallback (PRD §3.4, R-3.4-16, #217,
// Roll-print, answers 254 and 262): one A4 portrait page for one of the
// class's session days, with the class, the subject, the school and the
// day, a column for each of that day's roll calls for the book's group,
// headed by its time, or its half when the timetable has no bells (answer
// 263: a primary half-day is one column), and a row for each pupil called
// that day, the other year's too in a joint class, then empty numbered rows
// up to 50, each with one box per roll call to write «غ» or «ت» in, grey for
// a pupil outside that roll call's group (answer 263). The sheet is
// entered later through «إدخال مناداة من الورقة». It carries «داخلي · سري»
// (R-5.9-15), and the teacher's box is left to sign by hand.

import { groupPupils, pupilsFor, rollCallUnits, type Day, type Pupil, type RollCallUnit } from '@minhajna/core';
import { unitTime } from '../roll/roll-labels';
import { listNumbers } from '../roll/roll-rules';
import { coreContext } from '../storage/core-context';
import { dayTitle, type DocumentData, type Translate } from './document-data';
import { escapeHtml, printDocument } from './print-html';
import { bookScope, ofBook, padRows, type RollBook } from './roll-spread-pages';

/** The rows' room on the page, in millimetres, and the tallest a row gets. */
const ROOM = 184;
const TALLEST = 6;

const CSS =
  'h1{font-family:Ruqaa,Naskh;font-size:15pt;margin:0;line-height:1.3}.scope{font-size:9.5pt;margin:0 0 3mm}' +
  'table.sheet{border-collapse:collapse;width:100%;table-layout:fixed;font-size:8.5pt}' +
  'table.sheet th,table.sheet td{border:0.6pt solid #000;padding:0 1.5mm;overflow:hidden;white-space:nowrap;' +
  'line-height:1}table.sheet th{height:8mm;text-align:center}table.sheet td.n{text-align:center}' +
  'table.sheet tr{break-inside:avoid}table.sheet td.out{background:#bbb}.foot{font-size:8.5pt;margin-top:2mm}' +
  'table.signs{width:50%;border-collapse:collapse;margin-top:3mm;font-size:8.5pt;break-inside:avoid}' +
  'table.signs td{border:0.6pt solid #000;height:14mm;vertical-align:top;padding:1mm}';

/** The sheet's title, such as «ورقة المناداة · الخميس 15 أكتوبر 2026». */
export function sheetTitle(data: DocumentData, t: Translate, day: Day): string {
  return t('rollPrint.day.title', { day: dayTitle(data, t, day) });
}

/** The book's roll calls on `day`. */
export function dayUnits(data: DocumentData, book: RollBook, day: Day): RollCallUnit[] {
  return rollCallUnits(coreContext(data), book.classId, day, day).filter(ofBook(data, book));
}

/** The days of the school year the book has a roll call on, in order. */
export function sessionDays(data: DocumentData, book: RollBook): Day[] {
  const units = rollCallUnits(coreContext(data), book.classId, data.year.from, data.year.to).filter(ofBook(data, book));
  return [...new Set(units.map((unit) => unit.day))].sort();
}

function sheet(data: DocumentData, t: Translate, book: RollBook, day: Day): string {
  const context = coreContext(data);
  const units = dayUnits(data, book, day);
  const numbers = listNumbers(context, book.classId);
  const called = units.map((unit) => new Set(pupilsFor(context, unit).map((pupil) => pupil.id)));
  const listed = new Map<string, Pupil>();
  for (const pupil of units.length === 0
    ? groupPupils(context, book.classId, book.groupId, day)
    : units.flatMap((unit) => pupilsFor(context, unit)))
    listed.set(pupil.id, pupil);
  const pupils = [...listed.values()]
    .map((pupil) => ({ id: pupil.id, number: numbers.get(pupil.id) ?? 0, name: pupil.name }))
    .sort((a, b) => a.number - b.number);
  const rows = padRows(pupils, (number) => ({ id: '', number, name: '' }));
  const tall = Math.min(TALLEST, Math.floor((ROOM / Math.max(rows.length, 1)) * 100) / 100);
  const height = ` style="height:${tall}mm"`;
  const heads = units.map(
    (unit) =>
      unitTime({ state: data.state, bells: data.bells, calendar: data.calendar }, unit, data.dir) ??
      t(`rollBook.spoken.${unit.half}`),
  );
  const cols =
    '<colgroup><col style="width:9mm"><col>' + units.map(() => '<col style="width:24mm">').join('') + '</colgroup>';
  const top =
    `<tr><th>${escapeHtml(t('documents.number'))}</th><th>${escapeHtml(t('documents.name'))}</th>` +
    heads.map((head) => `<th><bdi>${escapeHtml(head)}</bdi></th>`).join('') +
    '</tr>';
  const body = rows
    .map(
      (row) =>
        `<tr><td class="n"${height}>${row.number}</td><td${height}>${escapeHtml(row.name)}</td>` +
        called
          .map((ids) => (row.id === '' || ids.has(row.id) ? `<td${height}></td>` : `<td class="out"${height}></td>`))
          .join('') +
        '</tr>',
    )
    .join('');
  return (
    `<h1>${escapeHtml(sheetTitle(data, t, day))}</h1>` +
    `<p class="scope">${escapeHtml(bookScope(data, book, null))}</p>` +
    `<table class="sheet">${cols}<thead>${top}</thead><tbody>${body}</tbody></table>` +
    `<div class="foot">${escapeHtml(t('rollPrint.day.key'))}</div>` +
    `<table class="signs"><tr><td>${escapeHtml(t('rollPrint.teacher'))}</td></tr></table>`
  );
}

/** The blank sheet of `day` for the book given, as one A4 portrait page. */
export function rollDayPages(data: DocumentData, t: Translate, book: RollBook, day: Day): string {
  const title = sheetTitle(data, t, day);
  return printDocument({
    lang: data.lang,
    dir: data.dir,
    title,
    landscape: false,
    css: CSS,
    pages: [sheet(data, t, book, day)],
    books: [book.classId],
    confidential: t('documents.confidential'),
  });
}
