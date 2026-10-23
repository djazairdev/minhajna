// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed «تقرير تصحيح نقطة» (#243, Export-fix, R-3.7-10, answer 468): an
// A4 portrait page for one correction after the term, framed «داخلي · سري»,
// with the school and the school year, the title, then a two-column table of
// what was corrected and why, and the teacher's box, with the drawn signature
// when the page carries it, beside the director's visa, left blank.

import { escapeHtml, printDocument } from './print-html';

export interface FixReport {
  /** The class and subject, as the page's book. */
  readonly book: string;
  /** Each fact, a label and its value, in the report's order. */
  readonly facts: readonly { readonly label: string; readonly value: string }[];
  /** The drawn signature for the teacher's box, when the page carries it. */
  readonly mark: string;
}

export interface FixReportTexts {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly title: string;
  readonly school: string;
  readonly year: string;
  readonly teacher: string;
  readonly director: string;
  readonly confidential: string;
}

const CSS =
  '.top{display:flex;justify-content:space-between;font-size:9pt;margin:0 0 4mm}' +
  'h1{font-family:Ruqaa,Naskh;font-size:16pt;margin:0 0 4mm;text-align:center}' +
  'table.facts{border-collapse:collapse;width:100%;font-size:10.5pt}' +
  'table.facts th,table.facts td{border:0.5pt solid #000;padding:2mm;text-align:start;vertical-align:top}' +
  'table.facts th{width:30%;font-weight:bold}' +
  'table.signs{width:100%;border-collapse:collapse;margin-top:8mm;font-size:10pt;break-inside:avoid}' +
  'table.signs td{border:0.5pt solid #000;width:50%;height:30mm;vertical-align:top;padding:1.5mm}' +
  'table.signs .drawn{height:12mm;margin:1mm auto 0}';

/** The correction's page. */
function pageOf(texts: FixReportTexts, report: FixReport): string {
  const facts = report.facts
    .map((fact) => `<tr><th>${escapeHtml(fact.label)}</th><td>${escapeHtml(fact.value)}</td></tr>`)
    .join('');
  return (
    `<div class="top"><span>${escapeHtml(texts.school)}</span><span>${escapeHtml(texts.year)}</span></div>` +
    `<h1>${escapeHtml(texts.title)}</h1><table class="facts"><tbody>${facts}</tbody></table>` +
    `<table class="signs"><tr><td>${escapeHtml(texts.teacher)}${report.mark}</td>` +
    `<td>${escapeHtml(texts.director)}</td></tr></table>`
  );
}

/** The report as an A4 portrait page in one HTML document. */
export function fixReportHtml(texts: FixReportTexts, report: FixReport): string {
  return printDocument({
    lang: texts.lang,
    dir: texts.dir,
    title: texts.title,
    landscape: false,
    css: CSS,
    pages: [pageOf(texts, report)],
    books: [report.book],
    confidential: texts.confidential,
  });
}
