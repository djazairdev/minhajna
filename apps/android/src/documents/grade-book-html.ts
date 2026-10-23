// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed «كشف النقاط» (#240, Gradebook-print, answer 461): an A4 portrait
// page for each class and subject, framed «داخلي · سري», with the schools and
// the school year, «كشف النقاط والمعدلات», the class, subject and term, the
// formula with the scale and the release, a row for each pupil with their
// number, name, primary's months, each part and the average, the class's
// figures, then the teacher's box, with the drawn signature when the page
// carries it, and the director's «تأشيرة», each dated.

import { escapeHtml, printDocument } from './print-html';

export interface BookSheet {
  /** The class and subject, as the page's book. */
  readonly book: string;
  readonly scope: string;
  readonly formula: string;
  /** The column heads after the number and the name. */
  readonly heads: readonly string[];
  readonly rows: readonly { readonly number: number; readonly name: string; readonly cells: readonly string[] }[];
  /** The class's figures; empty on a blank page. */
  readonly figures: string;
  /** The drawn signature for the teacher's box, when the page carries it. */
  readonly mark: string;
}

export interface BookTexts {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly title: string;
  readonly schools: string;
  readonly year: string;
  readonly heading: string;
  readonly number: string;
  readonly name: string;
  readonly teacher: string;
  readonly director: string;
  readonly date: string;
  readonly confidential: string;
}

const CSS =
  '.top{display:flex;justify-content:space-between;font-size:9pt;margin:0 0 2mm}' +
  'h1{font-family:Ruqaa,Naskh;font-size:15pt;margin:0 0 1mm;text-align:center}' +
  '.scope,.formula{font-size:9.5pt;margin:0 0 1mm;text-align:center}' +
  'table.book{border-collapse:collapse;width:100%;font-size:9pt;margin-top:2mm}' +
  'table.book th,table.book td{border:0.5pt solid #000;padding:0.6mm 1.2mm;text-align:center;white-space:nowrap}' +
  'table.book td.name{text-align:start;white-space:normal}table.book tr{break-inside:avoid}' +
  '.figures{font-size:9pt;margin-top:2mm}' +
  'table.signs{width:100%;border-collapse:collapse;margin-top:4mm;font-size:9pt;break-inside:avoid}' +
  'table.signs td{border:0.5pt solid #000;height:18mm;vertical-align:top;padding:1mm;width:50%}' +
  'table.signs .drawn{height:9mm;margin:.5mm auto 0}';

/** One class and subject's page. */
function pageOf(texts: BookTexts, sheet: BookSheet): string {
  const heads = [texts.number, texts.name, ...sheet.heads].map((head) => `<th>${escapeHtml(head)}</th>`).join('');
  const rows = sheet.rows
    .map(
      (row) =>
        `<tr><td>${row.number}</td><td class="name">${escapeHtml(row.name)}</td>` +
        `${row.cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
    )
    .join('');
  const dated = (who: string, mark = '') => `${escapeHtml(who)} · ${escapeHtml(texts.date)}${mark}`;
  return (
    `<div class="top"><span>${escapeHtml(texts.schools)}</span><span>${escapeHtml(texts.year)}</span></div>` +
    `<h1>${escapeHtml(texts.heading)}</h1><p class="scope">${escapeHtml(sheet.scope)}</p>` +
    `<p class="formula">${escapeHtml(sheet.formula)}</p>` +
    `<table class="book"><thead><tr>${heads}</tr></thead><tbody>${rows}</tbody></table>` +
    (sheet.figures === '' ? '' : `<p class="figures">${escapeHtml(sheet.figures)}</p>`) +
    `<table class="signs"><tr><td>${dated(texts.teacher, sheet.mark)}</td>` +
    `<td>${dated(texts.director)}</td></tr></table>`
  );
}

/** Each class and subject's grade book as an A4 portrait page, in one HTML document. */
export function gradeBookHtml(texts: BookTexts, sheets: readonly BookSheet[]): string {
  return printDocument({
    lang: texts.lang,
    dir: texts.dir,
    title: texts.title,
    landscape: false,
    css: CSS,
    pages: sheets.map((sheet) => pageOf(texts, sheet)),
    books: sheets.map((sheet) => sheet.book),
    confidential: texts.confidential,
  });
}
