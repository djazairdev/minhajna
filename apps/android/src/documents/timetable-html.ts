// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's weekly timetable as a printed page (#215, Timetable-doc,
// R-3.8-37): A4 portrait, with the school and the year on top; the title,
// the teacher's name and subjects, and the classes; the week's grid, a
// row a slot with its time, a grey rule between the morning and the
// afternoon, and in each cell what the slot holds; each class's hours and
// the week's total; the day the version applies from (R-4.6-04); and boxes
// for the teacher's signature and the director's and the inspector's visas,
// each with a line for its date, left for the pen; the teacher's carries the
// drawn signature while it is in use (#236, answer 412).

import { escapeHtml, printDocument } from './print-html';

export interface TimetableRow {
  /** Such as «08:00 – 09:00», or the slot's name without bells. */
  readonly time: string;
  /** One a day, in the days' order: each item on its own line; empty for none. */
  readonly cells: readonly (readonly string[])[];
}

export interface TimetablePage {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly school: string;
  readonly year: string;
  readonly title: string;
  /** Such as «الاسم واللقب: … · المادة: …», then «الأقسام: …». */
  readonly lines: readonly string[];
  readonly days: readonly string[];
  readonly morning: readonly TimetableRow[];
  readonly afternoon: readonly TimetableRow[];
  /** Such as «4م1: 5 ساعات · … · المجموع 15 ساعة في الأسبوع»; empty in the blank version. */
  readonly hours: string;
  /** Such as «ساري من الإثنين 21/09/2026». */
  readonly from: string;
  /** The teacher's, the director's and the inspector's boxes. */
  readonly boxes: readonly string[];
  /** The drawn signature for the teacher's box, the first, when the page carries it. */
  readonly mark?: string;
  /** Such as «التاريخ:». */
  readonly date: string;
}

const CSS =
  '.top{display:flex;justify-content:space-between;font-size:10pt;margin-bottom:4mm}' +
  'h1{font-family:Ruqaa,Naskh;font-size:20pt;font-weight:700;text-align:center;margin:2mm 0 3mm}' +
  '.line{text-align:center;font-size:11pt;margin:1mm 0}' +
  'table.week{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:5mm}' +
  'table.week th{border:0.8pt solid #000;height:9mm;font-family:Ruqaa,Naskh;font-size:12pt;background:#f2f2f2}' +
  'table.week td{border:0.8pt solid #000;height:14mm;padding:1mm;text-align:center;font-size:11pt;font-weight:700}' +
  'table.week td.t{font-size:9.5pt;font-weight:400;white-space:nowrap}table.week tr.gap td{height:3mm;background:#e6e6e6}' +
  '.hours{text-align:center;font-size:10.5pt;margin-top:4mm}.from{text-align:center;font-size:10.5pt;margin-top:2mm}' +
  '.boxes{display:grid;grid-template-columns:1fr 1fr 1fr;margin-top:6mm;border:1.2pt solid #000;border-radius:4pt}' +
  '.boxes div{height:34mm;padding:3pt 8pt;display:flex;flex-direction:column;justify-content:space-between}' +
  '.boxes div+div{border-inline-start:0.8pt solid #000}.boxes b{font-family:Ruqaa,Naskh;font-size:12pt}' +
  '.boxes small{font-size:9.5pt}' +
  '.latin h1,.latin table.week th,.latin .boxes b{font-family:Sans,Naskh,sans-serif}';

function rowHtml(row: TimetableRow): string {
  const cells = row.cells.map((items) => `<td>${items.map(escapeHtml).join('<br>')}</td>`).join('');
  return `<tr><td class="t"><bdi>${escapeHtml(row.time)}</bdi></td>${cells}</tr>`;
}

/** The timetable's page, as one HTML document. */
export function timetableHtml(page: TimetablePage): string {
  const columns = page.days.length + 1;
  const gap =
    page.morning.length > 0 && page.afternoon.length > 0 ? `<tr class="gap">${'<td></td>'.repeat(columns)}</tr>` : '';
  const content =
    `<div class="top"><span>${escapeHtml(page.school)}</span><span>${escapeHtml(page.year)}</span></div>` +
    `<h1>${escapeHtml(page.title)}</h1>${page.lines.map((line) => `<div class="line">${escapeHtml(line)}</div>`).join('')}` +
    `<table class="week"><colgroup><col style="width:26mm">${page.days.map(() => '<col>').join('')}</colgroup>` +
    `<thead><tr><th></th>${page.days.map((day) => `<th>${escapeHtml(day)}</th>`).join('')}</tr></thead><tbody>` +
    page.morning.map(rowHtml).join('') +
    gap +
    page.afternoon.map(rowHtml).join('') +
    `</tbody></table><div class="hours">${escapeHtml(page.hours)}</div><div class="from">${escapeHtml(page.from)}</div>` +
    `<div class="boxes">${page.boxes
      .map(
        (box, index) =>
          `<div><b>${escapeHtml(box)}</b>${index === 0 ? (page.mark ?? '') : ''}` +
          `<small>${escapeHtml(page.date)}</small></div>`,
      )
      .join('')}</div>`;
  return printDocument({
    lang: page.lang,
    dir: page.dir,
    title: page.title,
    landscape: false,
    css: CSS,
    pages: [page.dir === 'ltr' ? `<div class="latin">${content}</div>` : content],
  });
}
