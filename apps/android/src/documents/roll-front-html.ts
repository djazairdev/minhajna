// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's front pages (PRD §3.4, #217, Roll-print, answers 254
// and 262), A4 portrait, a set for each class: a cover with the school, the
// school year, the class, the subject and the teacher, the class's boys,
// girls and total, and the paper book's legend; the class list with the
// number, the name and the registration number only; then the two
// confidential pupil-record pages with their headings and 50 empty numbered
// rows, filled in by hand, as the app keeps no parents' details or home
// addresses. Every page carries «داخلي · سري» (R-5.9-15).

import { escapeHtml, printDocument } from './print-html';

export interface FrontCover {
  readonly title: string;
  /** Lines such as the school, the year, the class, the subject and the teacher. */
  readonly lines: readonly string[];
  /** Such as «الذكور 22 · الإناث 23 · المجموع 45». */
  readonly counts: string;
  readonly legend: readonly string[];
}

export interface FrontSheet {
  readonly cover: FrontCover;
  readonly listTitle: string;
  readonly listHeads: readonly string[];
  readonly list: readonly (readonly string[])[];
  /** Each confidential page's title and column heads. */
  readonly records: readonly { readonly title: string; readonly heads: readonly string[] }[];
  readonly book: string;
}

/** The record pages' rows. */
const RECORD_ROWS = 50;

const CSS =
  '.cover{height:240mm;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:7mm;' +
  'border:1.6pt solid #000;border-radius:6pt;text-align:center;padding:0 10mm}' +
  '.cover .book{font-family:Ruqaa,Naskh;font-size:34pt}.cover .line{font-size:15pt}' +
  '.cover .counts{font-size:13pt;font-weight:700;margin-top:6mm}.cover .legend{font-size:11pt;line-height:1.8}' +
  'h2{font-family:Ruqaa,Naskh;font-size:15pt;font-weight:700;text-align:center;margin:0 0 3mm}' +
  'table.list{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9pt}' +
  'table.list th{border:0.8pt solid #000;height:7mm;font-size:9pt}' +
  'table.list td{border:0.6pt solid #000;height:4.4mm;padding:0 1.5mm;overflow:hidden;white-space:nowrap;' +
  'line-height:1}table.list tr{break-inside:avoid}table.list td.n{text-align:center}';

function coverHtml(cover: FrontCover): string {
  return (
    `<div class="cover"><div class="book">${escapeHtml(cover.title)}</div>` +
    cover.lines.map((line) => `<div class="line">${escapeHtml(line)}</div>`).join('') +
    `<div class="counts">${escapeHtml(cover.counts)}</div>` +
    `<div class="legend">${cover.legend.map((line) => escapeHtml(line)).join('<br>')}</div></div>`
  );
}

function tableHtml(title: string, heads: readonly string[], rows: readonly (readonly string[])[]): string {
  const cols = heads.map((_, index) => (index === 0 ? '<col style="width:9mm">' : '<col>')).join('');
  const head = heads.map((one) => `<th>${escapeHtml(one)}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        '<tr>' +
        row.map((cell, index) => `<td${index === 0 ? ' class="n"' : ''}>${escapeHtml(cell)}</td>`).join('') +
        '</tr>',
    )
    .join('');
  return (
    `<h2>${escapeHtml(title)}</h2><table class="list"><colgroup>${cols}</colgroup>` +
    `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
  );
}

/** Each class's front pages, one after the other, as one HTML document. */
export function rollFrontHtml(
  texts: { readonly lang: string; readonly dir: 'rtl' | 'ltr'; readonly title: string; readonly confidential: string },
  sheets: readonly FrontSheet[],
): string {
  const each = sheets.map((sheet) => [
    coverHtml(sheet.cover),
    tableHtml(sheet.listTitle, sheet.listHeads, sheet.list),
    ...sheet.records.map((record) =>
      tableHtml(
        record.title,
        record.heads,
        Array.from({ length: RECORD_ROWS }, (_, index) => [String(index + 1), ...record.heads.slice(1).map(() => '')]),
      ),
    ),
  ]);
  return printDocument({
    lang: texts.lang,
    dir: texts.dir,
    title: texts.title,
    landscape: false,
    css: CSS,
    pages: each.flat(),
    books: sheets.flatMap((sheet, index) => each[index].map(() => sheet.book)),
    confidential: texts.confidential,
  });
}
