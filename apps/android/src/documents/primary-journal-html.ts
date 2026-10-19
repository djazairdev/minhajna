// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The primary daily journal (الكراس اليومي) as printed pages (#216,
// P-Journal, PS-Journal, R-3.8-09 to R-3.8-11): A4 landscape pages with the
// school and the class, the day and the year on top; then the sessions in
// bands, in six columns: the duration or the time, the subject or the
// class, the activity, the content, the competence indicator, and the
// domain with the lesson note's number; then the teacher's signature and a
// director's visa for each school, which the paper forms leave out. The
// class teacher's journal has a morning and an afternoon band; a
// specialist's has one for each school and half-day, and its pages are in
// the subject's language and direction, set in the Latin face when they
// run left to right. A session awaiting confirmation prints in grey; a band
// with no session is left out; a cell with nothing recorded is left for the
// pen. Codes and numbers are isolated, so they keep their order in any
// language. The type is set so seven sessions of three lines still fit one
// sheet.

import type { BookLine } from '../entry/book-lines';
import { escapeHtml, printDocument } from './print-html';

export interface PrimaryEntry {
  /** The first column: the duration, such as «45 د», or the time, such as «08:00 – 08:45». */
  readonly when: string;
  /** The second column: the subject, or the class in a specialist's journal. */
  readonly what: string;
  readonly activity: string;
  readonly content: readonly BookLine[];
  readonly domain: string;
  readonly awaiting: boolean;
}

export interface PrimaryBand {
  /** Such as «الصبيحة», or «École El Feth · Matinée» in a specialist's journal. */
  readonly name: string;
  readonly entries: readonly PrimaryEntry[];
  /** Empty rows in the blank version. */
  readonly blank?: number;
}

export interface PrimaryDay {
  /** Such as «الأحد 4 أكتوبر 2026»; empty in the blank version. */
  readonly title: string;
  /** Such as «القسم: 5 ابتدائي أ», or empty. */
  readonly className: string;
  /** The page's school, when not the document's, such as a class's in a specialist's journal for each class. */
  readonly school?: string;
  readonly bands: readonly PrimaryBand[];
  /** A director's visa box for each, with the school's name under it, or one empty name for a box with none. */
  readonly visas: readonly string[];
  /** The class whose book the page belongs to, in a journal kept for each class. */
  readonly book?: string;
}

export interface PrimaryTexts {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly book: string;
  readonly school: string;
  readonly year: string;
  /** The six column heads, in order. */
  readonly heads: readonly string[];
  /** The six columns' widths, one of them `auto`. */
  readonly widths: readonly string[];
  readonly teacher: string;
  readonly director: string;
  readonly empty: string;
  /** Between a line's label and its text: «: », or « : » in French. */
  readonly colon: string;
}

/** Empty rows a band keeps in the blank version: the morning's sessions, then the afternoon's. */
export const BLANK_ROWS = { morning: 5, afternoon: 3 } as const;

/** The columns of the class teacher's journal. */
export const PRIMARY_WIDTHS = ['16mm', '30mm', '30mm', 'auto', '48mm', '40mm'];

export const PRIMARY_CSS =
  '.head{display:flex;justify-content:space-between;align-items:flex-end;border:1.2pt solid #000;border-radius:4pt;' +
  'padding:4pt 10pt;margin-bottom:5pt}.head .book{font-family:Ruqaa,Naskh;font-size:18pt}.head small{font-size:10pt}' +
  'table.day{width:100%;border-collapse:collapse;table-layout:fixed}' +
  'table.day th{border:0.8pt solid #000;font-family:Ruqaa,Naskh;font-size:11pt;height:8mm}' +
  'table.day td{border:0.8pt solid #000;padding:1.2mm 2mm;vertical-align:top;font-size:9.5pt;line-height:1.4}' +
  'table.day tr{break-inside:avoid}table.day td.c{text-align:center}' +
  'table.day td.band{font-family:Ruqaa,Naskh;font-weight:700;text-align:center;background:#eee;padding:1mm}' +
  'table.day tr.blank td{height:9mm}.awaiting{color:#555}' +
  '.foot{display:grid;gap:6mm;margin-top:4mm;break-inside:avoid}' +
  '.foot div{border:1.2pt solid #000;border-radius:4pt;height:14mm;padding:3pt 8pt;font-family:Ruqaa,Naskh}' +
  '.foot small{font-family:Naskh,Sans,serif;font-size:9pt}' +
  '.latin .head .book,.latin table.day th,.latin table.day td.band,.latin .foot div' +
  '{font-family:Sans,Naskh,sans-serif;font-weight:700}.latin .head .book{font-size:16pt}';

function entryHtml(entry: PrimaryEntry, colon: string): string {
  const content = entry.content
    .map(
      (line) => `<div>${line.label === undefined ? '' : escapeHtml(line.label + colon)}${escapeHtml(line.text)}</div>`,
    )
    .join('');
  return (
    `<tr${entry.awaiting ? ' class="awaiting"' : ''}><td class="c"><bdi>${escapeHtml(entry.when)}</bdi></td>` +
    `<td>${escapeHtml(entry.what)}</td><td>${escapeHtml(entry.activity)}</td><td>${content}</td>` +
    `<td></td><td>${escapeHtml(entry.domain)}</td></tr>`
  );
}

function bandHtml(band: PrimaryBand, columns: number, colon: string): string {
  const blank = band.blank ?? 0;
  if (band.entries.length === 0 && blank === 0) return '';
  const rows =
    band.entries.length > 0
      ? band.entries.map((entry) => entryHtml(entry, colon)).join('')
      : `<tr class="blank">${'<td></td>'.repeat(columns)}</tr>`.repeat(blank);
  return `<tr><td class="band" colspan="${columns}">${escapeHtml(band.name)}</td></tr>${rows}`;
}

/** One day's page: the head, the bands of sessions, and the boxes. */
export function primaryPageHtml(texts: PrimaryTexts, day: PrimaryDay, blank: boolean): string {
  const columns = texts.widths.length;
  const none = !blank && day.bands.every((band) => band.entries.length === 0);
  const visas = day.visas.map(
    (school) =>
      `<div>${escapeHtml(texts.director)}${school === '' ? '' : `<br><small>${escapeHtml(school)}</small>`}</div>`,
  );
  return (
    `<div class="head"><div><div class="book">${escapeHtml(texts.book)}</div>` +
    `<small>${escapeHtml([day.school ?? texts.school, day.className].filter(Boolean).join(' · '))}</small></div>` +
    `<div><b>${escapeHtml(day.title)}</b><br><small>${escapeHtml(texts.year)}</small></div></div>` +
    `<table class="day"><colgroup>${texts.widths.map((width) => (width === 'auto' ? '<col>' : `<col style="width:${width}">`)).join('')}</colgroup>` +
    `<thead><tr>${texts.heads.map((head) => `<th>${escapeHtml(head)}</th>`).join('')}</tr></thead><tbody>` +
    (none
      ? `<tr><td class="c" colspan="${columns}">${escapeHtml(texts.empty)}</td></tr>`
      : day.bands.map((band) => bandHtml(band, columns, texts.colon)).join('')) +
    `</tbody></table><div class="foot" style="grid-template-columns:repeat(${visas.length + 1},1fr)">` +
    `<div>${escapeHtml(texts.teacher)}</div>${visas.join('')}</div>`
  );
}

/** The journal's pages for the given classes and days, one page each, as one HTML document. */
export function primaryJournalHtml(texts: PrimaryTexts, days: readonly PrimaryDay[], blank: boolean): string {
  return printDocument({
    lang: texts.lang,
    dir: texts.dir,
    title: texts.book,
    landscape: true,
    css: PRIMARY_CSS,
    pages: days.map((day) => primaryPageHtml(texts, day, blank)),
    books: days.map((day) => day.book ?? ''),
  });
}
