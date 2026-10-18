// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The primary daily journal (الكراس اليومي) as printed pages (#216,
// P-Journal, R-3.8-09, R-3.8-10): one A4 landscape page a class a day, with
// the school and the class, the day and the year on top; then the sessions in
// a morning and an afternoon band, in six columns: the duration, the
// subject, the activity, the content, the competence indicator, and the
// domain with the lesson note's number; then the teacher's signature and
// the director's visa, which the paper forms leave out. A session awaiting
// confirmation prints in grey; a band with no session is left out; a cell
// with nothing recorded is left for the pen. Codes and numbers are
// isolated, so they keep their order in any language. The type is set so
// seven sessions of three lines still fit one sheet.

import type { BookLine } from '../entry/book-lines';
import { escapeHtml, printDocument } from './print-html';

export interface PrimaryEntry {
  readonly minutes: string;
  readonly subject: string;
  readonly activity: string;
  readonly content: readonly BookLine[];
  readonly domain: string;
  readonly awaiting: boolean;
}

export interface PrimaryDay {
  /** Such as «الأحد 4 أكتوبر 2026»; empty in the blank version. */
  readonly title: string;
  /** Such as «القسم: 5 ابتدائي أ». */
  readonly className: string;
  readonly morning: readonly PrimaryEntry[];
  readonly afternoon: readonly PrimaryEntry[];
}

export interface PrimaryTexts {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly book: string;
  readonly school: string;
  readonly year: string;
  /** The six column heads, in order. */
  readonly heads: readonly string[];
  readonly morning: string;
  readonly afternoon: string;
  readonly teacher: string;
  readonly director: string;
  readonly empty: string;
  /** Between a line's label and its text: «: », or « : » in French. */
  readonly colon: string;
}

/** Empty rows a band keeps in the blank version: the morning's sessions, then the afternoon's. */
export const BLANK_ROWS = { morning: 5, afternoon: 3 } as const;

const CSS =
  '.head{display:flex;justify-content:space-between;align-items:flex-end;border:1.2pt solid #000;border-radius:4pt;' +
  'padding:4pt 10pt;margin-bottom:5pt}.head .book{font-family:Ruqaa,Naskh;font-size:18pt}.head small{font-size:10pt}' +
  'table.day{width:100%;border-collapse:collapse;table-layout:fixed}' +
  'table.day th{border:0.8pt solid #000;font-family:Ruqaa,Naskh;font-size:11pt;height:8mm}' +
  'table.day td{border:0.8pt solid #000;padding:1.2mm 2mm;vertical-align:top;font-size:9.5pt;line-height:1.4}' +
  'table.day tr{break-inside:avoid}table.day td.c{text-align:center}' +
  'table.day td.band{font-family:Ruqaa,Naskh;font-weight:700;text-align:center;background:#eee;padding:1mm}' +
  'table.day tr.blank td{height:9mm}.awaiting{color:#555}' +
  '.foot{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:4mm;break-inside:avoid}' +
  '.foot div{border:1.2pt solid #000;border-radius:4pt;height:14mm;padding:3pt 8pt;font-family:Ruqaa,Naskh}';

const WIDTHS = ['16mm', '30mm', '30mm', 'auto', '48mm', '40mm'];

function entryHtml(entry: PrimaryEntry, colon: string): string {
  const content = entry.content
    .map(
      (line) => `<div>${line.label === undefined ? '' : escapeHtml(line.label + colon)}${escapeHtml(line.text)}</div>`,
    )
    .join('');
  return (
    `<tr${entry.awaiting ? ' class="awaiting"' : ''}><td class="c"><bdi>${escapeHtml(entry.minutes)}</bdi></td>` +
    `<td>${escapeHtml(entry.subject)}</td><td>${escapeHtml(entry.activity)}</td><td>${content}</td>` +
    `<td></td><td>${escapeHtml(entry.domain)}</td></tr>`
  );
}

function bandHtml(name: string, entries: readonly PrimaryEntry[], blank: number, colon: string): string {
  if (entries.length === 0 && blank === 0) return '';
  const rows =
    entries.length > 0
      ? entries.map((entry) => entryHtml(entry, colon)).join('')
      : `<tr class="blank">${WIDTHS.map(() => '<td></td>').join('')}</tr>`.repeat(blank);
  return `<tr><td class="band" colspan="${WIDTHS.length}">${escapeHtml(name)}</td></tr>${rows}`;
}

/** The journal's pages for the given classes and days, one page each, as one HTML document. */
export function primaryJournalHtml(texts: PrimaryTexts, days: readonly PrimaryDay[], blank: boolean): string {
  const pages = days.map((day) => {
    const none = !blank && day.morning.length === 0 && day.afternoon.length === 0;
    return (
      `<div class="head"><div><div class="book">${escapeHtml(texts.book)}</div>` +
      `<small>${escapeHtml([texts.school, day.className].filter(Boolean).join(' · '))}</small></div>` +
      `<div><b>${escapeHtml(day.title)}</b><br><small>${escapeHtml(texts.year)}</small></div></div>` +
      `<table class="day"><colgroup>${WIDTHS.map((width) => (width === 'auto' ? '<col>' : `<col style="width:${width}">`)).join('')}</colgroup>` +
      `<thead><tr>${texts.heads.map((head) => `<th>${escapeHtml(head)}</th>`).join('')}</tr></thead><tbody>` +
      (none
        ? `<tr><td class="c" colspan="${WIDTHS.length}">${escapeHtml(texts.empty)}</td></tr>`
        : bandHtml(texts.morning, day.morning, blank ? BLANK_ROWS.morning : 0, texts.colon) +
          bandHtml(texts.afternoon, day.afternoon, blank ? BLANK_ROWS.afternoon : 0, texts.colon)) +
      `</tbody></table><div class="foot"><div>${escapeHtml(texts.teacher)}</div>` +
      `<div>${escapeHtml(texts.director)}</div></div>`
    );
  });
  return printDocument({ lang: texts.lang, dir: texts.dir, title: texts.book, landscape: true, css: CSS, pages });
}
