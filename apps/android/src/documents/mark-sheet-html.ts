// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed «كشف النقاط والتقديرات» (#242, Marks-sheet, answer 466): an A4
// portrait page for a class, subject and term, framed «داخلي · سري», with the
// school and the school year, the title, the class, subject, term and teacher,
// a row for each pupil in the grid's order with their number, name, each part,
// the average and the appreciation, which wraps in its own wide column, the
// line for pupils whose data was erased, then the teacher's box, dated, with
// the drawn signature when the page carries it.

import { escapeHtml, printDocument } from './print-html';

export interface MarkSheet {
  /** The class and subject, as the page's book. */
  readonly book: string;
  readonly scope: string;
  /** The column heads between the name and the appreciation. */
  readonly heads: readonly string[];
  readonly rows: readonly {
    readonly number: number;
    readonly name: string;
    readonly cells: readonly string[];
    readonly appreciation: string;
  }[];
  /** The drawn signature for the teacher's box, when the page carries it. */
  readonly mark: string;
  /** «حُذفت بيانات تلميذ واحد», or empty when no pupil on the term's books had their data erased. */
  readonly erased: string;
}

export interface MarkSheetTexts {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly title: string;
  readonly school: string;
  readonly year: string;
  readonly heading: string;
  readonly number: string;
  readonly name: string;
  readonly appreciation: string;
  readonly teacher: string;
  readonly date: string;
  readonly confidential: string;
}

const CSS =
  '.top{display:flex;justify-content:space-between;font-size:9pt;margin:0 0 2mm}' +
  'h1{font-family:Ruqaa,Naskh;font-size:15pt;margin:0 0 1mm;text-align:center}' +
  '.scope{font-size:9.5pt;margin:0 0 1mm;text-align:center}' +
  'table.sheet{border-collapse:collapse;width:100%;font-size:9pt;margin-top:2mm}' +
  'table.sheet th,table.sheet td{border:0.5pt solid #000;padding:0.6mm 1.2mm;text-align:center;white-space:nowrap}' +
  'table.sheet td.name,table.sheet td.words{text-align:start;white-space:normal}' +
  'table.sheet td.words{width:34%}table.sheet tr{break-inside:avoid}.erased{font-size:9pt;margin-top:2mm}' +
  'table.signs{width:50%;border-collapse:collapse;margin-top:4mm;font-size:9pt;break-inside:avoid}' +
  'table.signs td{border:0.5pt solid #000;height:18mm;vertical-align:top;padding:1mm}' +
  'table.signs .drawn{height:9mm;margin:.5mm auto 0}';

/** The class, subject and term's page. */
function pageOf(texts: MarkSheetTexts, sheet: MarkSheet): string {
  const heads = [texts.number, texts.name, ...sheet.heads, texts.appreciation]
    .map((head) => `<th>${escapeHtml(head)}</th>`)
    .join('');
  const rows = sheet.rows
    .map(
      (row) =>
        `<tr><td>${row.number}</td><td class="name">${escapeHtml(row.name)}</td>` +
        `${row.cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}` +
        `<td class="words">${escapeHtml(row.appreciation)}</td></tr>`,
    )
    .join('');
  return (
    `<div class="top"><span>${escapeHtml(texts.school)}</span><span>${escapeHtml(texts.year)}</span></div>` +
    `<h1>${escapeHtml(texts.heading)}</h1><p class="scope">${escapeHtml(sheet.scope)}</p>` +
    `<table class="sheet"><thead><tr>${heads}</tr></thead><tbody>${rows}</tbody></table>` +
    (sheet.erased === '' ? '' : `<p class="erased">${escapeHtml(sheet.erased)}</p>`) +
    `<table class="signs"><tr><td>${escapeHtml(texts.teacher)} · ${escapeHtml(texts.date)}${sheet.mark}` +
    '</td></tr></table>'
  );
}

/** The mark sheet as an A4 portrait page in one HTML document. */
export function markSheetHtml(texts: MarkSheetTexts, sheet: MarkSheet): string {
  return printDocument({
    lang: texts.lang,
    dir: texts.dir,
    title: texts.title,
    landscape: false,
    css: CSS,
    pages: [pageOf(texts, sheet)],
    books: [sheet.book],
    confidential: texts.confidential,
  });
}
