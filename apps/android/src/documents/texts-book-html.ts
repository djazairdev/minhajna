// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's page as printed (#213, P90-print): a head in the book's
// language, right to left, with the school, the school year, the class, the
// subject and the page's number; a line naming the class, the subject and
// the month; then the paper book's four columns, date, time, topic and
// signature, in the subject's language and direction (R-3.8-63). Rows never
// break across pages, and empty rules 7.3 mm apart, drawn as rows since a
// thin drawn stripe can drop out of the PDF, fill the page to its foot. The
// signature column stays blank, to sign by hand.

import type { BookLine } from '../entry/book-lines';
import { escapeHtml } from './print-html';
import { PAGE_RULES, type BookRow, type Direction } from './texts-book-rows';

export interface TextsBookHead {
  readonly lang: string;
  readonly school: string;
  readonly year: string;
  readonly className: string;
  readonly subject: string;
  readonly title: string;
}

export interface TextsBookPage {
  readonly head: TextsBookHead;
  /** The language of the page's words. */
  readonly lang: string;
  /** The subject's own language, when the app does not speak it yet and the rows' text runs in its direction. */
  readonly textLang?: string;
  readonly dir: Direction;
  readonly caption: string;
  readonly columns: readonly [string, string, string, string];
  /** Null on a blank page. */
  readonly rows: readonly BookRow[] | null;
  /** The rules the rows take with their feet, which the empty rules below them make up to a page. */
  readonly used: number;
  /** Said under the caption when the page has no row, such as no session confirmed in the month. */
  readonly note?: string;
}

export const TEXTS_BOOK_CSS =
  '.head{border:.4mm solid #000;border-radius:2mm;padding:1.5mm 4mm;margin:0 0 2.5mm;font-size:10.5pt}' +
  '.head .row{display:flex;justify-content:space-between;gap:4mm}' +
  '.head .title{text-align:center;font-family:Ruqaa,Naskh,serif;font-weight:700;font-size:16pt;margin-top:1mm}' +
  '.caption{font-weight:700;font-size:10.5pt;margin:0 0 2mm}.note{font-size:10pt;margin:0 0 2mm}' +
  'table.book{width:100%;border-collapse:collapse;table-layout:fixed;border:.4mm solid #000}' +
  'table.book th{border:.3mm solid #000;font-weight:700;font-size:10.5pt;height:10mm;padding:0 1mm;text-align:center}' +
  'table.book td{border-inline:.3mm solid #000;vertical-align:top;padding:0 1.5mm;line-height:7.3mm;font-size:10.5pt}' +
  'table.book tr.rule td{height:7mm;border-bottom:.3mm solid #9a9a9a}' +
  'table.book tr{break-inside:avoid;page-break-inside:avoid}table.book tr.entry td{border-bottom:.3mm solid #000}' +
  'table.book td.when{text-align:center;white-space:nowrap;font-size:9.5pt}' +
  'table.book td.what div{text-align:start;overflow-wrap:anywhere}' +
  'table.book.latin td,table.book.latin th{font-family:Sans,Naskh,sans-serif}';

const COLUMNS =
  '<colgroup><col style="width:13%"><col style="width:15%"><col style="width:56%"><col style="width:16%"></colgroup>';

function line(entry: BookLine, textLang: string | undefined): string {
  const label = entry.label === undefined ? '' : `<b>${escapeHtml(entry.label)}:</b> `;
  const text = textLang === undefined ? escapeHtml(entry.text) : `<bdi dir="auto">${escapeHtml(entry.text)}</bdi>`;
  return `<div>${label}${text}</div>`;
}

function head(page: TextsBookHead): string {
  const field = (text: string) => `<span>${escapeHtml(text)}</span>`;
  return (
    `<div class="head" lang="${escapeHtml(page.lang)}" dir="rtl">` +
    `<div class="row">${field(page.school)}${field(page.year)}</div>` +
    `<div class="row">${field(page.className)}${field(page.subject)}</div>` +
    `<div class="title">${escapeHtml(page.title)}</div></div>`
  );
}

/** One page's content, for `printDocument`. */
export function textsBookPage(page: TextsBookPage): string {
  const rows = (page.rows ?? [])
    .map(
      (row) =>
        `<tr class="entry"><td class="when">${escapeHtml(row.date)}</td><td class="when">${escapeHtml(row.time)}</td>` +
        `<td class="what">${row.lines.map((entry) => line(entry, page.textLang)).join('')}</td><td></td></tr>`,
    )
    .join('');
  const left = Math.max(0, PAGE_RULES - page.used);
  const fill = '<tr class="rule"><td></td><td></td><td></td><td></td></tr>'.repeat(left);
  const latin = page.dir === 'ltr' ? ' latin' : '';
  return (
    head(page.head) +
    `<p class="caption" lang="${escapeHtml(page.lang)}" dir="${page.dir}">${escapeHtml(page.caption)}</p>` +
    (page.note === undefined ? '' : `<p class="note" dir="${page.dir}">${escapeHtml(page.note)}</p>`) +
    `<table class="book${latin}" lang="${escapeHtml(page.lang)}" dir="${page.dir}">${COLUMNS}` +
    `<thead><tr>${page.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows}${fill}</tbody></table>`
  );
}
