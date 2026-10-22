// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's yearly summary (PRD §3.4, #217, Roll-print, R-3.4-21,
// R-3.4-29): one A4 landscape page for each class, a row for each pupil with
// «ح-ك», «غ», «ح-ف» and the rate for each month of the school year, then for
// the year, and the class's totals in the last row. Months still to come stay
// empty. The rows shrink to keep the class on one page, under the signature
// boxes of the teacher, the director and the inspector, the last two dated;
// the teacher's carries the drawn signature while it is in use (#236,
// answer 412). Every page carries «داخلي · سري» (R-5.9-15).

import { escapeHtml, printDocument } from './print-html';

export interface YearLine {
  readonly number: string;
  readonly name: string;
  /** Four figures for each month, then four for the year; '' for none. */
  readonly figures: readonly string[];
}

/** One class's school year. */
export interface YearSheet {
  readonly title: string;
  readonly scope: string;
  /** Each month's name, in the year's order. */
  readonly months: readonly string[];
  readonly rows: readonly YearLine[];
  readonly total: YearLine;
  readonly note: string;
  readonly book: string;
}

export interface YearTexts {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly title: string;
  readonly number: string;
  readonly name: string;
  /** «ح-ك», «غ», «ح-ف» and «%». */
  readonly heads: readonly string[];
  readonly year: string;
  readonly teacher: string;
  /** The drawn signature for the teacher's box, when the summary carries it. */
  readonly mark?: string;
  readonly director: string;
  readonly inspector: string;
  readonly date: string;
  readonly confidential: string;
}

/** The rows' room on the page, in millimetres, and the tallest a row gets. */
const ROOM = 100;
const TALLEST = 5;

const CSS =
  '.head{height:11mm;overflow:hidden}h1{font-family:Ruqaa,Naskh;font-size:13pt;margin:0;line-height:1.3}' +
  '.scope{font-size:8.5pt;margin:0}' +
  'table.year{border-collapse:collapse;width:100%;table-layout:fixed;font-size:5.5pt}' +
  'table.year th,table.year td{border:0.4pt solid #000;padding:0;text-align:center;overflow:hidden;white-space:nowrap;' +
  'line-height:1}table.year th{height:4.5mm;font-size:6.5pt}table.year td.name{text-align:start;padding:0 1pt;' +
  'text-overflow:ellipsis}table.year tr{break-inside:avoid}table.year .m{border-inline-start-width:1.2pt}' +
  'table.year tr.total td{font-weight:700;background:#e6e6e6}.note{font-size:7.5pt;margin-top:1.5mm}' +
  'table.signs{width:100%;border-collapse:collapse;margin-top:2mm;font-size:8pt;break-inside:avoid}' +
  'table.signs td{border:0.5pt solid #000;height:12mm;vertical-align:top;padding:1mm;width:33.3%}' +
  'table.signs .drawn{height:6mm;margin:.3mm auto 0}';

function line(row: YearLine, height: string, total: boolean): string {
  const cells = row.figures
    .map((figure, index) => `<td${index % 4 === 0 ? ' class="m"' : ''}${height}>${escapeHtml(figure)}</td>`)
    .join('');
  return (
    `<tr${total ? ' class="total"' : ''}><td${height}>${escapeHtml(row.number)}</td>` +
    `<td class="name"${height}>${escapeHtml(row.name)}</td>${cells}</tr>`
  );
}

function page(texts: YearTexts, sheet: YearSheet): string {
  const tall = Math.min(TALLEST, Math.floor((ROOM / Math.max(sheet.rows.length + 1, 1)) * 100) / 100);
  const height = ` style="height:${tall}mm"`;
  const spans = [...sheet.months, texts.year];
  const cols =
    '<colgroup><col style="width:6mm"><col style="width:36mm">' +
    spans.map(() => '<col><col><col><col>').join('') +
    '</colgroup>';
  const top =
    `<tr><th rowspan="2">${escapeHtml(texts.number)}</th><th rowspan="2">${escapeHtml(texts.name)}</th>` +
    spans.map((name) => `<th colspan="4" class="m">${escapeHtml(name)}</th>`).join('') +
    '</tr><tr>' +
    spans
      .map(() =>
        texts.heads.map((one, index) => `<th${index === 0 ? ' class="m"' : ''}>${escapeHtml(one)}</th>`).join(''),
      )
      .join('') +
    '</tr>';
  const body = sheet.rows.map((row) => line(row, height, false)).join('') + line(sheet.total, height, true);
  const dated = (who: string) => `${escapeHtml(who)}<br>${escapeHtml(texts.date)}`;
  return (
    `<div class="head"><h1>${escapeHtml(sheet.title)}</h1><p class="scope">${escapeHtml(sheet.scope)}</p></div>` +
    `<table class="year">${cols}<thead>${top}</thead><tbody>${body}</tbody></table>` +
    (sheet.note === '' ? '' : `<div class="note">${escapeHtml(sheet.note)}</div>`) +
    `<table class="signs"><tr><td>${escapeHtml(texts.teacher)}${texts.mark ?? ''}</td>` +
    `<td>${dated(texts.director)}</td>` +
    `<td>${dated(texts.inspector)}</td></tr></table>`
  );
}

/** Each class's school year on one A4 landscape page, in one HTML document. */
export function rollYearHtml(texts: YearTexts, sheets: readonly YearSheet[]): string {
  return printDocument({
    lang: texts.lang,
    dir: texts.dir,
    title: texts.title,
    landscape: true,
    css: CSS,
    pages: sheets.map((sheet) => page(texts, sheet)),
    books: sheets.map((sheet) => sheet.book),
    confidential: texts.confidential,
  });
}
