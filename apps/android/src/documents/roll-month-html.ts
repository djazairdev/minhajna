// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's roll calls for a month, as the roll-call book prints them
// (PRD §3.4, §5.13): A4 landscape, a row per pupil with the number, the
// name in Arabic and in Latin letters, then a column per roll call and the
// month's totals. A mark is a letter, never a colour alone: «غ» unjustified,
// «م» justified, «ت» late. Rows run on to further pages with the head
// repeated.

import { escapeHtml, printDocument } from './print-html';

export type RollMark = 'unjustified' | 'justified' | 'late' | null;

export interface RollMonthRow {
  readonly number: number;
  readonly name: string;
  readonly latinName: string;
  /** One mark per column, in the columns' order. */
  readonly marks: readonly RollMark[];
}

export interface RollMonthTexts {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly title: string;
  readonly scope: string;
  readonly number: string;
  readonly name: string;
  readonly latinName: string;
  readonly absent: string;
  readonly late: string;
  readonly key: string;
  readonly marks: Readonly<Record<Exclude<RollMark, null>, string>>;
}

const CSS =
  'h1{font-family:Ruqaa,Naskh;font-size:16pt;margin:0}.scope{font-size:10pt;margin:2pt 0 6pt}' +
  'table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:8pt}thead{display:table-header-group}' +
  'th,td{border:0.6pt solid #000;padding:1pt 2pt;text-align:center;height:12pt;overflow:hidden}tr{break-inside:avoid}' +
  'td.name{text-align:start}td.latin{direction:ltr;text-align:left}' +
  'th.day{font-family:Sans;font-size:6.5pt;padding:1pt 0}.key{font-size:9pt;margin-top:4pt}';

/** The month's roll calls for one class, as one landscape HTML document. */
export function rollMonthHtml(
  texts: RollMonthTexts,
  columns: readonly string[],
  rows: readonly RollMonthRow[],
): string {
  const head =
    `<tr><th>${escapeHtml(texts.number)}</th><th>${escapeHtml(texts.name)}</th>` +
    `<th>${escapeHtml(texts.latinName)}</th>` +
    columns.map((column) => `<th class="day"><bdi>${escapeHtml(column)}</bdi></th>`).join('') +
    `<th>${escapeHtml(texts.absent)}</th><th>${escapeHtml(texts.late)}</th></tr>`;
  const cols =
    '<colgroup><col style="width:7mm"><col style="width:36mm"><col style="width:36mm">' +
    columns.map(() => '<col>').join('') +
    '<col style="width:11mm"><col style="width:11mm"></colgroup>';
  const body = rows
    .map((row) => {
      const absent = row.marks.filter((mark) => mark === 'unjustified' || mark === 'justified').length;
      const late = row.marks.filter((mark) => mark === 'late').length;
      return (
        `<tr><td>${row.number}</td><td class="name">${escapeHtml(row.name)}</td>` +
        `<td class="latin latin-name">${escapeHtml(row.latinName)}</td>` +
        row.marks.map((mark) => `<td>${mark === null ? '' : escapeHtml(texts.marks[mark])}</td>`).join('') +
        `<td>${absent}</td><td>${late}</td></tr>`
      );
    })
    .join('');
  return printDocument({
    lang: texts.lang,
    dir: texts.dir,
    title: texts.title,
    landscape: true,
    css: CSS,
    body:
      `<section class="page"><h1>${escapeHtml(texts.title)}</h1><div class="scope">${escapeHtml(texts.scope)}</div>` +
      `<table>${cols}<thead>${head}</thead><tbody>${body}</tbody></table>` +
      `<div class="key">${escapeHtml(texts.key)}</div></section>`,
  });
}
