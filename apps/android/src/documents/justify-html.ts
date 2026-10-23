// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed «تبرير التقويم المستمر» (#239, Marks-pupil, answers 443 and
// 454): an A4 portrait page for each pupil, framed «داخلي · سري», with the
// pupil, the class and period, T out of the scale, the term's test mean, exam
// and average when it has them, the table of components with what was
// recorded and the mark, the total, and the board's two notes.

import type { JustifyPage } from '../marks/justify-rules';
import type { Translate } from './document-data';
import { escapeHtml, printDocument } from './print-html';

const CSS =
  'h1{font-size:15pt;margin:0 0 1mm}p{margin:0 0 2mm}.big{font-size:20pt;font-weight:700}' +
  'table.marks{width:100%;border-collapse:collapse;margin:3mm 0}' +
  'table.marks th,table.marks td{border:0.3mm solid #000;padding:1.5mm 2mm;text-align:start;vertical-align:top}' +
  'table.marks td.mark{white-space:nowrap;text-align:center}table.marks tr.total td{font-weight:700}' +
  '.note{font-size:9.5pt}';

/** One pupil's page. */
function pageOf(t: Translate, page: JustifyPage): string {
  const cell = (text: string, mark = false) => `<td${mark ? ' class="mark"' : ''}>${escapeHtml(text)}</td>`;
  const empty = page.empty === 0 ? '' : ` · ${escapeHtml(t('marks.justify.emptyCount', { count: page.empty }))}`;
  const rows = page.rows.map((row) => `<tr>${cell(row.name)}${cell(row.recorded)}${cell(row.mark, true)}</tr>`);
  const head = (['component', 'recorded', 'mark'] as const).map(
    (one) => `<th>${escapeHtml(t(`marks.justify.${one}`))}</th>`,
  );
  return (
    `<h1>${escapeHtml(page.pupil)}</h1><p>${escapeHtml(page.line)}</p>` +
    `<p><span class="big">${escapeHtml(page.total)}</span> ` +
    `${escapeHtml(t('marks.justify.outOf', { scale: page.scale }))}${empty}</p>` +
    (page.parts === null ? '' : `<p>${escapeHtml(page.parts)}</p>`) +
    `<table class="marks"><thead><tr>${head.join('')}</tr></thead>` +
    `<tbody>${rows.join('')}<tr class="total">${cell(t('marks.justify.total'))}<td></td>` +
    `${cell(`${page.total} / ${page.scale}`, true)}</tr></tbody></table>` +
    `<p class="note">${escapeHtml(t('marks.justify.noteBook'))}</p>` +
    `<p class="note">${escapeHtml(t('marks.justify.noteReasons'))}</p>`
  );
}

/** The pages of one pupil or the whole class, as an HTML document. */
export function justifyHtml(
  t: Translate,
  pages: readonly JustifyPage[],
  options: { readonly lang: string; readonly dir: 'rtl' | 'ltr'; readonly title: string },
): string {
  return printDocument({
    ...options,
    landscape: false,
    css: CSS,
    pages: pages.map((page) => pageOf(t, page)),
    confidential: t('documents.confidential'),
  });
}
