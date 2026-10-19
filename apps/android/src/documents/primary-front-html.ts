// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The primary journal's front pages as printed pages (#216,
// P-Journal-front, R-3.8-08), a set for each class: a cover with no logo,
// as the journal is the teacher's and the school's record; the teacher's
// card with the director's visa; holidays and national days; seminars and
// training; the pupil list, with the number, the name and the registration
// number only; and the class's weekly timetable, with a box for the day it
// was approved and the director's signature and stamp. Times and codes are
// isolated, so they keep their order in any language.

import {
  cardHtml,
  FRONT_CSS,
  headHtml,
  tableHtml,
  type FrontField,
  type FrontTable,
  type FrontTexts,
} from './journal-front-html';
import { escapeHtml, printDocument } from './print-html';

export interface Cover {
  readonly school: string;
  readonly year: string;
  readonly book: string;
  /** Such as «القسم: 5 ابتدائي أ». */
  readonly className: string;
  /** Such as «الاسم واللقب: …», the name left blank when not given. */
  readonly teacher: string;
}

export interface WeekRow {
  /** Such as «08:00 – 09:00», or the slot's name without bells. */
  readonly time: string;
  /** One a day, in the days' order; empty for none. */
  readonly cells: readonly string[];
}

export interface WeekTable {
  readonly title: string;
  readonly time: string;
  readonly days: readonly string[];
  readonly bands: readonly { readonly name: string; readonly rows: readonly WeekRow[] }[];
  readonly approved: string;
  readonly signature: string;
  readonly note: string;
}

export interface PrimaryFront {
  readonly cover: Cover;
  readonly card: readonly FrontField[];
  readonly tables: readonly FrontTable[];
  readonly week: WeekTable;
  /** The class whose journal the pages open. */
  readonly book?: string;
}

const CSS =
  FRONT_CSS +
  '.cover{height:250mm;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:9mm;' +
  'border:1.6pt solid #000;border-radius:6pt;text-align:center}.cover .book{font-family:Ruqaa,Naskh;font-size:34pt}' +
  '.cover .line{font-size:15pt}table.week{width:100%;border-collapse:collapse;table-layout:fixed}' +
  'table.week th{border:0.8pt solid #000;height:8mm;font-family:Ruqaa,Naskh;font-size:11pt}' +
  'table.week td{border:0.8pt solid #000;height:11mm;padding:0 1.5mm;text-align:center;font-size:10pt}' +
  'table.week td.band{font-family:Ruqaa,Naskh;font-weight:700;background:#eee;height:7mm}' +
  'table.week td.t{white-space:nowrap;font-size:9pt}' +
  '.approve{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:6mm}' +
  '.approve div{border:1.2pt solid #000;border-radius:4pt;height:30mm;padding:4pt 8pt;font-family:Ruqaa,Naskh}';

function coverHtml(cover: Cover): string {
  return (
    `<div class="cover"><div class="line">${escapeHtml(cover.school)}</div>` +
    `<div class="line">${escapeHtml(cover.year)}</div><div class="book">${escapeHtml(cover.book)}</div>` +
    `<div class="line">${escapeHtml(cover.className)}</div><div class="line">${escapeHtml(cover.teacher)}</div></div>`
  );
}

function weekHtml(week: WeekTable): string {
  const heads = [week.time, ...week.days].map((head) => `<th>${escapeHtml(head)}</th>`).join('');
  const span = week.days.length + 1;
  const bands = week.bands
    .map(
      (band) =>
        `<tr><td class="band" colspan="${span}">${escapeHtml(band.name)}</td></tr>` +
        band.rows
          .map(
            (row) =>
              `<tr><td class="t"><bdi>${escapeHtml(row.time)}</bdi></td>` +
              row.cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('') +
              '</tr>',
          )
          .join(''),
    )
    .join('');
  return (
    `<h2>${escapeHtml(week.title)}</h2><table class="week"><colgroup><col style="width:30mm">` +
    `${week.days.map(() => '<col>').join('')}</colgroup><thead><tr>${heads}</tr></thead><tbody>${bands}</tbody>` +
    `</table><div class="note">${escapeHtml(week.note)}</div><div class="approve">` +
    `<div>${escapeHtml(week.approved)}</div><div>${escapeHtml(week.signature)}</div></div>`
  );
}

/** The front pages of each class, one after the other, as one HTML document. */
export function primaryFrontHtml(texts: FrontTexts, fronts: readonly PrimaryFront[], confidential: string): string {
  const each = fronts.map((front) => [
    coverHtml(front.cover),
    `${headHtml(texts)}${cardHtml(texts, front.card)}`,
    ...front.tables.map((table) => `${headHtml(texts)}${tableHtml(table)}`),
    `${headHtml(texts)}${weekHtml(front.week)}`,
  ]);
  const pages = each.flat();
  const books = fronts.flatMap((front, index) => each[index].map(() => front.book ?? ''));
  return printDocument({
    lang: texts.lang,
    dir: texts.dir,
    title: `${texts.book} · ${texts.front}`,
    landscape: false,
    css: CSS,
    pages,
    books,
    confidential,
  });
}
