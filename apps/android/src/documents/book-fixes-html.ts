// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The month's texts-book corrections as A4 portrait pages, for the director
// (#218, R-3.8-01, R-3.8-02, answer 266): the title, the month and the classes,
// the promise that nothing is deleted, then one row for each change: the class
// and session, what changed, «كان», «أصبح», and the day and reason, with the
// note when the paper needs correcting too; «كان» and «أصبح» take the direction
// of their own words, as a subject may be taught in another language than the
// page's. A month without corrections says so and still prints. Black on white,
// with no scores or colours (R-2.6-07).

import type { DocumentData, Translate } from './document-data';
import type { FixItem } from './book-fixes';
import { escapeHtml, printDocument } from './print-html';

const CSS =
  'h1{font-family:Ruqaa,Naskh;font-size:16pt;margin:0;line-height:1.3}.scope{font-size:10pt;margin:0 0 1mm}' +
  '.promise{font-size:9pt;margin:0 0 3mm}.none{font-size:11pt;margin:6mm 0}' +
  'table.fixes{border-collapse:collapse;width:100%;table-layout:fixed;font-size:9pt}' +
  'table.fixes th,table.fixes td{border:0.6pt solid #000;padding:1mm 1.5mm;vertical-align:top;white-space:pre-line;' +
  'overflow-wrap:anywhere}table.fixes th{text-align:center}table.fixes tr{break-inside:avoid}' +
  '.was{text-decoration:line-through}.paper{display:block;margin-top:1mm;font-style:italic}';

const cell = (text: string, css = '', dir = false) =>
  `<td${css === '' ? '' : ` class="${css}"`}${dir ? ' dir="auto"' : ''}>${escapeHtml(text)}</td>`;

/** The corrections given, under the month's name and the classes' title, as one document. */
export function bookFixesHtml(
  data: DocumentData,
  t: Translate,
  items: readonly FixItem[],
  head: { readonly month: string; readonly title: string },
): string {
  const heads = ['session', 'what', 'before', 'after', 'change'].map((key) =>
    t(`bookFixes.${key}` as 'bookFixes.what'),
  );
  const rows = items.flatMap((item) =>
    item.changes.map(
      (change, at) =>
        '<tr>' +
        cell(`${item.className}\n${item.when}`) +
        cell(change.label) +
        cell(change.before, 'was', true) +
        cell(change.after, '', true) +
        (at === 0
          ? `<td rowspan="${item.changes.length}">${escapeHtml(item.foot)}` +
            (item.paper ? `<span class="paper">${escapeHtml(t('bookFixes.paper'))}</span>` : '') +
            '</td>'
          : '') +
        '</tr>',
    ),
  );
  const cols =
    '<colgroup><col style="width:20%"><col style="width:14%"><col style="width:22%"><col style="width:22%"><col></colgroup>';
  const body =
    rows.length === 0
      ? `<p class="none">${escapeHtml(t('bookFixes.none'))}</p>`
      : `<table class="fixes">${cols}<thead><tr>${heads.map((one) => `<th>${escapeHtml(one)}</th>`).join('')}</tr>` +
        `</thead><tbody>${rows.join('')}</tbody></table>`;
  return printDocument({
    lang: data.lang,
    dir: data.dir,
    title: t('bookFixes.title'),
    landscape: false,
    css: CSS,
    pages: [
      `<h1>${escapeHtml(t('bookFixes.title'))}</h1>` +
        `<p class="scope">${escapeHtml(`${t('bookFixes.scope', { month: head.month })} · ${head.title}`)}</p>` +
        `<p class="promise">${escapeHtml(t('bookFixes.promise'))}</p>` +
        body,
    ],
  });
}
