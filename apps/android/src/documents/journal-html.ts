// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The daily journal (الدفتر اليومي) as printed pages (Journal, PRD §3.8):
// one A4 page a day, in portrait, with the school, the year and the day on
// top, and the class on a journal kept for one class; then the sessions in
// three columns, from–to, the class, and the session's journal lines; ruled
// lines for the rest of the page; and the teacher's signature and the
// director's visa at the foot. A session still awaiting confirmation prints
// in grey. Times and class codes are isolated, so they keep their order in
// any language.

import type { BookLine } from '../entry/book-lines';
import { escapeHtml, printDocument } from './print-html';

export interface JournalEntry {
  readonly time: string;
  readonly className: string;
  readonly lines: readonly BookLine[];
  readonly awaiting: boolean;
}

export interface JournalDay {
  /** Such as «الأحد 4 أكتوبر 2026». */
  readonly title: string;
  /** Such as «القسم: 1م2», on a journal kept for one class. */
  readonly className?: string;
  readonly entries: readonly JournalEntry[];
  /** The class whose book the page belongs to, in a journal kept for each class. */
  readonly book?: string;
}

export interface JournalTexts {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly book: string;
  readonly school: string;
  readonly year: string;
  readonly time: string;
  readonly className: string;
  readonly content: string;
  readonly teacher: string;
  readonly director: string;
  readonly empty: string;
  /** Between a line's label and its text: «: », or « : » in French. */
  readonly colon: string;
}

const CSS =
  '.head{display:flex;justify-content:space-between;align-items:flex-end;border:1.2pt solid #000;border-radius:4pt;' +
  'padding:6pt 10pt;margin-bottom:8pt}.head .book{font-family:Ruqaa,Naskh;font-size:18pt}.head small{font-size:10pt}' +
  '.sheet{border:1.2pt solid #000;border-radius:4pt;height:236mm;display:flex;flex-direction:column}' +
  '.row{display:grid;grid-template-columns:30mm 18mm 1fr;border-bottom:0.8pt solid #000}' +
  '.row>div{padding:4pt 6pt}.row>div+div{border-inline-start:0.8pt solid #000}' +
  '.cols{font-family:Ruqaa,Naskh;font-size:11pt;text-align:center}' +
  '.entry .x div{border-bottom:0.5pt dotted #777;line-height:20pt}.entry .x div:last-child{border-bottom:0}' +
  '.entry .k{font-weight:700;text-align:center}.entry .d{text-align:center;line-height:20pt;white-space:nowrap}' +
  '.awaiting{color:#555}.blank{flex:1;background:repeating-linear-gradient(transparent 0 19.5pt,#999 19.5pt 20pt)}' +
  '.visa{display:grid;grid-template-columns:1fr 1fr;border-top:1.2pt solid #000;height:30mm}' +
  '.visa div{padding:4pt 8pt;font-family:Ruqaa,Naskh}.visa div+div{border-inline-start:0.8pt solid #000}';

function entryHtml(entry: JournalEntry, colon: string): string {
  const lines = entry.lines
    .map(
      (line) =>
        `<div>${line.label === undefined ? '' : `${escapeHtml(line.label)}${escapeHtml(colon)}`}${escapeHtml(line.text)}</div>`,
    )
    .join('');
  return (
    `<div class="row entry${entry.awaiting ? ' awaiting' : ''}">` +
    `<div class="d"><bdi>${escapeHtml(entry.time)}</bdi></div>` +
    `<div class="k"><bdi>${escapeHtml(entry.className)}</bdi></div>` +
    `<div class="x">${lines}</div></div>`
  );
}

/** The journal's pages for the given days, one page a day, as one HTML document. */
export function journalHtml(texts: JournalTexts, days: readonly JournalDay[]): string {
  const pages = days.map(
    (day) =>
      `<div class="head"><div><div class="book">${escapeHtml(texts.book)}</div>` +
      `<small>${escapeHtml(texts.school)}</small></div><div><b>${escapeHtml(day.title)}</b><br>` +
      (day.className === undefined ? '' : `<small>${escapeHtml(day.className)}</small><br>`) +
      `<small>${escapeHtml(texts.year)}</small></div></div><div class="sheet">` +
      `<div class="row cols"><div>${escapeHtml(texts.time)}</div><div>${escapeHtml(texts.className)}</div>` +
      `<div>${escapeHtml(texts.content)}</div></div>` +
      (day.entries.length === 0
        ? `<div class="row"><div></div><div></div><div>${escapeHtml(texts.empty)}</div></div>`
        : day.entries.map((entry) => entryHtml(entry, texts.colon)).join('')) +
      `<div class="blank"></div><div class="visa"><div>${escapeHtml(texts.teacher)}</div>` +
      `<div>${escapeHtml(texts.director)}</div></div></div>`,
  );
  return printDocument({
    lang: texts.lang,
    dir: texts.dir,
    title: texts.book,
    landscape: false,
    css: CSS,
    pages,
    books: days.map((day) => day.book ?? ''),
  });
}
