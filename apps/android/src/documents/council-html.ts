// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed «ملف مجلس القسم» (#244, Council, R-3.7-11 to R-3.7-17, R-3.8-01,
// R-3.8-02, answer 470): A4 portrait, framed «داخلي · سري» in its header and
// footer, with the school and the school year, the title, the class, subject
// and term, then each section under its heading, as a table, as lines, or
// both. A long pack runs onto more pages, a row never split.

import { escapeHtml, printDocument } from './print-html';

export interface CouncilSection {
  readonly title: string;
  /** A table's column heads; none for lines alone. */
  readonly heads?: readonly string[];
  readonly rows?: readonly (readonly string[])[];
  readonly lines?: readonly string[];
}

export interface CouncilSheet {
  /** The class and subject, as the page's book. */
  readonly book: string;
  /** The class, subject and term. */
  readonly scope: string;
  readonly sections: readonly CouncilSection[];
}

export interface CouncilTexts {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly title: string;
  readonly school: string;
  readonly year: string;
  readonly confidential: string;
}

const CSS =
  '.top{display:flex;justify-content:space-between;font-size:9pt;margin:0 0 2mm}' +
  'h1{font-family:Ruqaa,Naskh;font-size:15pt;margin:0 0 1mm;text-align:center}' +
  '.scope{font-size:10pt;margin:0 0 3mm;text-align:center}' +
  'h2{font-size:10.5pt;margin:3mm 0 1mm;break-after:avoid}' +
  'table.part{border-collapse:collapse;width:100%;font-size:9pt}' +
  'table.part th,table.part td{border:0.5pt solid #000;padding:0.6mm 1.2mm;text-align:center}' +
  'table.part td:first-child{text-align:start}table.part tr{break-inside:avoid}' +
  'p.line{font-size:9.5pt;margin:1mm 0}';

/** One section: its heading, then its table and lines. */
function sectionOf(section: CouncilSection): string {
  const heads = section.heads?.map((head) => `<th>${escapeHtml(head)}</th>`).join('') ?? '';
  const rows = (section.rows ?? [])
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  const table =
    section.heads === undefined || (section.rows ?? []).length === 0
      ? ''
      : `<table class="part"><thead><tr>${heads}</tr></thead><tbody>${rows}</tbody></table>`;
  const lines = (section.lines ?? []).map((line) => `<p class="line">${escapeHtml(line)}</p>`).join('');
  return `<h2>${escapeHtml(section.title)}</h2>${table}${lines}`;
}

/** The pack as A4 portrait pages in one HTML document. */
export function councilHtml(texts: CouncilTexts, sheet: CouncilSheet): string {
  const page =
    `<div class="top"><span>${escapeHtml(texts.school)}</span><span>${escapeHtml(texts.year)}</span></div>` +
    `<h1>${escapeHtml(texts.title)}</h1><p class="scope">${escapeHtml(sheet.scope)}</p>` +
    sheet.sections.map(sectionOf).join('');
  return printDocument({
    lang: texts.lang,
    dir: texts.dir,
    title: texts.title,
    landscape: false,
    css: CSS,
    pages: [page],
    books: [sheet.book],
    confidential: texts.confidential,
  });
}
