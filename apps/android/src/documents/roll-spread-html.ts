// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's month as the paper book prints it (PRD §3.4, #217,
// Roll-print, answers 253, 260 and 261): a two-page A4 portrait spread for
// each class. The first page has the number, the name and days 1 to 20; the
// second the number, days 21 to the month's end, then «غ», «ح-ف», «ح-ك» when
// pupils differ, each pupil's absence dates and their late arrivals' dates,
// the month's totals and the signature boxes of the teacher, the director and
// the inspector, the last two dated; the teacher's carries the drawn
// signature while it is in use (#236, answer 412). Both pages share their
// head, the month and the Hijri months it spans, so their rows line up.
// Weekends, national days and holidays are solid grey; days with none of the
// teacher's sessions with the class are dotted, so a white cell means
// present. The rows run to 50, empty ones numbered for a newcomer written in
// by hand, and shrink to keep the class on one spread. Every page carries
// «داخلي · سري» (R-5.9-15).

import { escapeHtml, printDocument } from './print-html';

/** A day's shading: «off» for no school, «none» for no session with the class. */
export type DayShade = 'off' | 'none' | null;

export interface SpreadRow {
  readonly number: number;
  /** '' for an empty row, as for every figure of a blank one. */
  readonly name: string;
  /** The mark on each day, by day of the month from 1; '' for none. */
  readonly marks: readonly string[];
  readonly absent: string;
  readonly present: string;
  readonly possible: string;
  readonly dates: string;
  readonly late: string;
}

/** One class's month. */
export interface RollSpread {
  readonly title: string;
  readonly scope: string;
  /** Each day of the month's shading, from day 1. */
  readonly days: readonly DayShade[];
  readonly rows: readonly SpreadRow[];
  /** Whether «ح-ك» has a column, when pupils' possible attendance differs. */
  readonly possibleColumn: boolean;
  /** The totals under the table, or '' for none. */
  readonly footer: string;
  /** The class whose roll-call book the pages belong to. */
  readonly book: string;
}

export interface SpreadTexts {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly title: string;
  readonly number: string;
  readonly name: string;
  readonly absent: string;
  readonly present: string;
  readonly possible: string;
  readonly dates: string;
  readonly late: string;
  /** The marks in words, such as «- غياب صباحاً». */
  readonly legend: readonly string[];
  readonly off: string;
  readonly none: string;
  readonly teacher: string;
  /** The drawn signature for the teacher's box, when the book carries it. */
  readonly mark?: string;
  readonly director: string;
  readonly inspector: string;
  readonly date: string;
  readonly confidential: string;
}

/** The rows' room on a page, in millimetres, and the tallest a row gets. */
const ROOM = 184;
const TALLEST = 5;
/** The first page's last day. */
const SPLIT = 20;

const CSS =
  '.head{height:13mm;overflow:hidden}h1{font-family:Ruqaa,Naskh;font-size:14pt;margin:0;line-height:1.3}' +
  '.scope{font-size:9pt;margin:0}' +
  'table.book{border-collapse:collapse;width:100%;table-layout:fixed;font-size:7pt}' +
  'table.book th,table.book td{border:0.5pt solid #000;padding:0 1pt;text-align:center;overflow:hidden;' +
  'white-space:nowrap;line-height:1}table.book th{height:6mm;font-size:7pt}' +
  'table.book td.name{text-align:start;text-overflow:ellipsis}table.book td.wrap{white-space:normal;font-size:5.5pt;' +
  'text-align:start}table.book tr{break-inside:avoid}' +
  '.off{background:#c8c8c8}.none{background-image:radial-gradient(circle,#000 0.22mm,transparent 0.28mm);' +
  'background-size:1.6mm 1.6mm}' +
  '.foot{font-size:8pt;margin-top:2mm}.legend{font-size:7.5pt;margin-top:2mm;line-height:1.5}' +
  '.swatch{display:inline-block;width:3mm;height:3mm;border:0.5pt solid #000;vertical-align:middle;margin:0 1mm}' +
  'table.signs{width:100%;border-collapse:collapse;margin-top:3mm;font-size:8pt;break-inside:avoid}' +
  'table.signs td{border:0.5pt solid #000;height:14mm;vertical-align:top;padding:1mm;width:33.3%}' +
  'table.signs .drawn{height:7mm;margin:.5mm auto 0}';

const day = (index: number) => String(index + 1).padStart(2, '0');

function head(sheet: RollSpread): string {
  return `<div class="head"><h1>${escapeHtml(sheet.title)}</h1><p class="scope">${escapeHtml(sheet.scope)}</p></div>`;
}

function dayCells(sheet: RollSpread, row: SpreadRow | null, from: number, to: number, height: string): string {
  const cells: string[] = [];
  for (let index = from; index < to; index += 1) {
    const shade = sheet.days[index];
    const cls = shade === null || shade === undefined ? '' : ` class="${shade}"`;
    cells.push(
      row === null
        ? `<th${cls}><bdi>${day(index)}</bdi></th>`
        : `<td${cls}${height}>${escapeHtml(row.marks[index] ?? '')}</td>`,
    );
  }
  return cells.join('');
}

function firstPage(texts: SpreadTexts, sheet: RollSpread, height: string): string {
  const last = Math.min(SPLIT, sheet.days.length);
  const cols =
    '<colgroup><col style="width:7mm"><col>' +
    Array.from({ length: last }, () => '<col style="width:6mm">').join('') +
    '</colgroup>';
  const top = `<tr><th>${escapeHtml(texts.number)}</th><th>${escapeHtml(texts.name)}</th>${dayCells(sheet, null, 0, last, '')}</tr>`;
  const rows = sheet.rows
    .map(
      (row) =>
        `<tr><td${height}>${row.number}</td><td class="name"${height}>${escapeHtml(row.name)}</td>` +
        `${dayCells(sheet, row, 0, last, height)}</tr>`,
    )
    .join('');
  const legend =
    texts.legend.map((line) => escapeHtml(line)).join(' · ') +
    `<br><span class="swatch off"></span>${escapeHtml(texts.off)}` +
    `<span class="swatch none"></span>${escapeHtml(texts.none)}`;
  return (
    `${head(sheet)}<table class="book">${cols}<thead>${top}</thead><tbody>${rows}</tbody></table>` +
    `<div class="legend">${legend}</div>`
  );
}

function secondPage(texts: SpreadTexts, sheet: RollSpread, height: string): string {
  const count = sheet.days.length - SPLIT;
  const totals = sheet.possibleColumn ? 3 : 2;
  const cols =
    '<colgroup><col style="width:7mm">' +
    Array.from({ length: count }, () => '<col style="width:6mm">').join('') +
    Array.from({ length: totals }, () => '<col style="width:8mm">').join('') +
    '<col><col style="width:30mm"></colgroup>';
  const figures = (row: SpreadRow) =>
    `${sheet.possibleColumn ? `<td${height}>${escapeHtml(row.possible)}</td>` : ''}` +
    `<td${height}>${escapeHtml(row.absent)}</td><td${height}>${escapeHtml(row.present)}</td>`;
  const top =
    `<tr><th>${escapeHtml(texts.number)}</th>${dayCells(sheet, null, SPLIT, sheet.days.length, '')}` +
    `${sheet.possibleColumn ? `<th>${escapeHtml(texts.possible)}</th>` : ''}` +
    `<th>${escapeHtml(texts.absent)}</th><th>${escapeHtml(texts.present)}</th>` +
    `<th>${escapeHtml(texts.dates)}</th><th>${escapeHtml(texts.late)}</th></tr>`;
  const rows = sheet.rows
    .map(
      (row) =>
        `<tr><td${height}>${row.number}</td>${dayCells(sheet, row, SPLIT, sheet.days.length, height)}` +
        `${figures(row)}<td class="wrap"${height}>${escapeHtml(row.dates)}</td>` +
        `<td class="wrap"${height}>${escapeHtml(row.late)}</td></tr>`,
    )
    .join('');
  const dated = (who: string) => `${escapeHtml(who)}<br>${escapeHtml(texts.date)}`;
  const signs =
    `<table class="signs"><tr><td>${escapeHtml(texts.teacher)}${texts.mark ?? ''}</td>` +
    `<td>${dated(texts.director)}</td>` +
    `<td>${dated(texts.inspector)}</td></tr></table>`;
  const foot = sheet.footer === '' ? '' : `<div class="foot">${escapeHtml(sheet.footer)}</div>`;
  return `${head(sheet)}<table class="book">${cols}<thead>${top}</thead><tbody>${rows}</tbody></table>${foot}${signs}`;
}

/** Each class's month as two A4 portrait pages, in one HTML document. */
export function rollSpreadHtml(texts: SpreadTexts, sheets: readonly RollSpread[]): string {
  const pages: string[] = [];
  const books: string[] = [];
  for (const sheet of sheets) {
    const tall = Math.min(TALLEST, Math.floor((ROOM / Math.max(sheet.rows.length, 1)) * 100) / 100);
    const height = ` style="height:${tall}mm"`;
    pages.push(firstPage(texts, sheet, height), secondPage(texts, sheet, height));
    books.push(sheet.book, sheet.book);
  }
  return printDocument({
    lang: texts.lang,
    dir: texts.dir,
    title: texts.title,
    landscape: false,
    css: CSS,
    pages,
    books,
    confidential: texts.confidential,
  });
}
