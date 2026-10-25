// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The merge's A4 landscape pages for the teaching council's register (#246,
// R-Merge, answers 489 and 492): the title with the subject and grade, the
// count of statements and teachers, a blank for the meeting's day and the day
// it was made; then a row per class in the school's order, under its school
// when grouped, with its teacher, statement day, unit, last resource, its
// place drawn as boxes, the delay and the sessions not held. The rows flow
// onto as many pages as they need, the column heads repeated on each, and no
// row is split. Then how the rows are ordered, that only what teachers
// shared shows, and a box for the coordinator's signature. No pupils' data,
// so no confidential mark. Black and white, as every printed page.

import { escapeHtml, printDocument } from '../documents/print-html';
import type { Translate } from '../documents/document-data';
import type { MergeWords } from './merge-words';

/** What the pages show, in words already. */
export interface MergeSheet {
  /** Such as «دمج البيانات · اللغة العربية · السنة الرابعة متوسط». */
  readonly title: string;
  readonly scope: string;
  /** The day the sheet was made. */
  readonly today: string;
  readonly rows: readonly MergeWords[];
  /** Whether the rows are grouped by school. */
  readonly grouped: boolean;
}

const CSS =
  'h1{font-family:Ruqaa,Naskh,serif;text-align:center;font-size:18pt;margin:0 0 1mm}' +
  '.line{text-align:center;margin:0 0 1mm;font-size:10pt}' +
  'table.merge{width:100%;border-collapse:collapse;margin-top:3mm;font-size:9pt}' +
  '.merge th,.merge td{border:0.3mm solid #000;padding:1.5mm;text-align:start;vertical-align:top}' +
  '.merge thead{display:table-header-group}.merge tr{break-inside:avoid}.merge .school{font-weight:700}' +
  '.track{display:flex;gap:0.8mm;margin-top:1mm}.track i{width:3mm;height:3mm;border:0.3mm solid #000}' +
  '.track .done{background:#000}' +
  '.foot{font-size:9pt;margin-top:2mm}' +
  '.sign{border:0.3mm solid #000;padding:2mm;margin-top:3mm;height:16mm;break-inside:avoid}';

/** The place as boxes: filled before it, half from the start side for a resource started, filled for one done. */
function track(row: MergeWords): string {
  if (row.track === null) return '';
  const { of, at, done } = row.track;
  const box = (index: number) => (index < at || (index === at && done) ? 'done' : index === at ? 'now' : '');
  const boxes = Array.from({ length: of }, (_, index) => `<i class="${box(index)}"></i>`);
  return `<div class="track">${boxes.join('')}</div>`;
}

/** The head, the table of rows, then the notes and signature. */
function content(t: Translate, sheet: MergeSheet): string {
  const e = escapeHtml;
  const heads = ['section', 'teacher', 'day', 'unit', 'resource', 'place', 'delay', 'notHeld'] as const;
  const columns = heads.map((head) => `<th>${e(t(`reader.merge.columns.${head}`))}</th>`).join('');
  let school: string | null | undefined;
  const body = sheet.rows
    .map((row) => {
      const group =
        sheet.grouped && row.school !== school
          ? `<tr><td class="school" colspan="8">${e(row.school ?? t('reader.picture.noSchool'))}</td></tr>`
          : '';
      school = row.school;
      const cells = [row.section, row.teacher, row.day, row.unit, row.resource].map((text) => `<td>${e(text)}</td>`);
      return (
        `${group}<tr>${cells.join('')}<td>${e(row.place ?? '—')}${track(row)}</td>` +
        `<td>${e(row.delay)}</td><td>${e(row.notHeld)}</td></tr>`
      );
    })
    .join('');
  return (
    `<h1>${e(sheet.title)}</h1><p class="line">${e(sheet.scope)}</p>` +
    `<p class="line">${e(t('reader.merge.meeting'))} · ${e(t('reader.merge.made', { day: sheet.today }))}</p>` +
    `<table class="merge"><thead><tr>${columns}</tr></thead><tbody>${body}</tbody></table>` +
    `<p class="foot">${e(t('reader.merge.order'))} ${e(t('reader.merge.shared'))}</p>` +
    `<div class="sign">${e(t('reader.merge.signature'))}</div>`
  );
}

/** The whole merge, in the interface's language and direction. */
export function mergeHtml(t: Translate, sheet: MergeSheet, lang: string, dir: 'rtl' | 'ltr'): string {
  const now = `.track .now{background:linear-gradient(to ${dir === 'rtl' ? 'left' : 'right'},#000 50%,#fff 50%)}`;
  return printDocument({ lang, dir, title: sheet.title, landscape: true, css: CSS + now, pages: [content(t, sheet)] });
}
