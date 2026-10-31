// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's printed timetable grids (#581, D-TT-import step 3, §7.4,
// R-7.4-11, answer 609): every class's, teacher's or room's week from the
// timetable read, one A4 landscape page each, in black and white: a week with a
// session in every slot, long names and all, fits one sheet, and a page whose
// cells hold two or three sessions sets them smaller; a grid still too full
// continues on the next sheet, its days repeated, with the boxes kept together
// at its end. Each page carries the official header every Algerian school
// document carries, the republic above, then the Ministry of National
// Education, the directorate of education of the school's wilaya when it is
// known, and the school, with the school year from August across from them;
// then the grid's title. The grid is laid out as the page shows it
// (timetable-grid.ts), a row for each span; a cell lists its sessions, for a
// class the subject, teacher, room and group, for a teacher the class, group,
// subject and room, for a room the class, group, subject and teacher, each with
// its week last when it alternates, and a page with alternating sessions
// explains weeks A and B under the grid, beside the day printed. Then the
// signature boxes, each with a line for the date: the director and, beside
// them, the censeur in a lycée, the education counsellor in a CEM, which has no
// censeur, or the inspector in a primary school. A mark given, such as a demo
// world's, is said at the head and foot of every page. Text is escaped, and
// names and spans are isolated.

import {
  alternates,
  gridOf,
  timetableNames,
  type DemoLevel,
  type GridOf,
  type ImportedSession,
  type Weekday,
} from '@minhajna/core';
import type { TFunction } from 'i18next';
import { escapeHtml, printDocument } from '../documents/print-html';
import { isolate } from '../week/grid-labels';
import { spanText } from './grid-text';

/** What the printed grids need beside the timetable. */
export interface GridsPrint {
  readonly of: GridOf;
  readonly sessions: readonly ImportedSession[];
  readonly workingDays: readonly Weekday[];
  readonly school: string;
  /** The school's wilaya, as the reference data names it. */
  readonly wilaya: string;
  /** Such as 2026/2027. */
  readonly year: string;
  readonly level: DemoLevel;
  /** The day printed, written out. */
  readonly day: string;
  /** Said at the head and foot of every page, such as a demo world's mark. */
  readonly mark?: string;
}

/** Who signs beside the director: the inspector in a primary school, the education counsellor in a CEM. */
const SECOND = { primary: 'inspector', cem: 'counsellor', lycee: 'censeur' } as const;

const CSS =
  '.state{text-align:center;font-size:10pt;font-weight:700}' +
  '.top{display:flex;justify-content:space-between;align-items:flex-end;font-size:9pt;line-height:1.3}' +
  'h1{font-family:Ruqaa,Naskh;font-size:14pt;font-weight:700;text-align:center;margin:0 0 1.5mm}' +
  'table.week{width:100%;border-collapse:collapse;table-layout:fixed}' +
  'table.week th{border:0.8pt solid #000;height:6mm;font-family:Ruqaa,Naskh;font-size:11pt}' +
  'table.week td{border:0.8pt solid #000;height:8mm;padding:0.5mm;text-align:center;font-size:8.5pt}' +
  'table.week td{vertical-align:middle;line-height:1.25}table.week td.t{white-space:nowrap}' +
  'table.week td p{margin:0}table.week td p+p{margin-top:0.5mm}table.week tr{break-inside:avoid}' +
  'table.week.dense2 td{font-size:7.5pt;line-height:1.2}table.week.dense3 td{font-size:6.5pt;line-height:1.15}' +
  '.foot{display:flex;justify-content:space-between;gap:4mm;font-size:8.5pt;margin-top:1mm}' +
  '.boxes{display:grid;grid-template-columns:1fr 1fr;margin-top:1.5mm;border:1.2pt solid #000;border-radius:4pt}' +
  '.boxes{break-inside:avoid}.boxes div{height:12mm;padding:2pt 8pt;display:flex;flex-direction:column}' +
  '.boxes div{justify-content:space-between}.boxes div+div{border-inline-start:0.8pt solid #000}' +
  '.boxes b{font-family:Ruqaa,Naskh;font-size:11pt}.boxes small{font-size:8.5pt}' +
  '.latin h1,.latin table.week th,.latin .boxes b{font-family:Sans,Naskh,sans-serif}';

/** A session as a cell of a class's, a teacher's or a room's grid says it, its week last when it alternates. */
export function cellText(t: TFunction, of: GridOf, one: ImportedSession): string {
  const fields =
    of === 'class'
      ? [one.subject, one.teacher, one.room, one.group]
      : of === 'teacher'
        ? [one.class, one.group, one.subject, one.room]
        : [one.class, one.group, one.subject, one.teacher];
  const week = one.week === 'both' ? [] : [t(one.week === 'A' ? 'ttImport.weekA' : 'ttImport.weekB')];
  return [...fields.filter((field) => field !== '').map(isolate), ...week].join(' · ');
}

/** The school year a day of it falls in, from August, such as 2026/2027. */
export function yearOf(day: string): string {
  const [year, month] = day.split('-').map(Number);
  const first = month >= 8 ? year : year - 1;
  return `${first}/${first + 1}`;
}

/** Every grid of one set, a page each, as one HTML document in the interface's language and direction. */
export function gridsHtml(t: TFunction, print: GridsPrint, lang: string, dir: 'rtl' | 'ltr'): string {
  const e = escapeHtml;
  const head =
    `<div class="state">${e(t('ttPrint.republic'))}</div><div class="top"><span>${e(t('ttPrint.ministry'))}<br>` +
    (print.wilaya === '' ? '' : `${e(t('ttPrint.directorate', { wilaya: isolate(print.wilaya) }))}<br>`) +
    `${e(isolate(print.school))}</span><span>${e(t('ttPrint.year', { year: print.year }))}</span></div>`;
  const boxes = (['director', SECOND[print.level]] as const)
    .map((who) => `<div><b>${e(t(`ttPrint.boxes.${who}`))}</b><small>${e(t('ttPrint.date'))}</small></div>`)
    .join('');
  const page = (name: string) => {
    const grid = gridOf(print.sessions, print.of, name, print.workingDays);
    const mine = grid.slots.flatMap((slot) => slot.cells.flat());
    const most = Math.max(0, ...grid.slots.flatMap((slot) => slot.cells.map((cell) => cell.length)));
    const rows = grid.slots
      .map(
        (slot) =>
          `<tr><td class="t"><bdi>${e(spanText(slot.start, slot.end))}</bdi></td>` +
          slot.cells
            .map((cell) => `<td>${cell.map((one) => `<p>${e(cellText(t, print.of, one))}</p>`).join('')}</td>`)
            .join('') +
          '</tr>',
      )
      .join('');
    const dense = most >= 3 ? ' dense3' : most === 2 ? ' dense2' : '';
    const content =
      `${head}<h1>${e(t(`ttPrint.titles.${print.of}`, { name: isolate(name) }))}</h1>` +
      `<table class="week${dense}"><colgroup><col style="width:22mm">` +
      `${grid.days.map(() => '<col>').join('')}</colgroup>` +
      `<thead><tr><th></th>${grid.days.map((day) => `<th>${e(t(`week.days.${day}`))}</th>`).join('')}</tr></thead>` +
      `<tbody>${rows}</tbody></table>` +
      `<div class="foot"><span>${alternates(mine) ? e(t('ttPrint.weeks')) : ''}</span>` +
      `<span>${e(t('ttPrint.printed', { day: print.day }))}</span></div><div class="boxes">${boxes}</div>`;
    return dir === 'ltr' ? `<div class="latin">${content}</div>` : content;
  };
  return printDocument({
    lang,
    dir,
    title: t(`ttPrint.files.${print.of}`),
    landscape: true,
    css: CSS,
    pages: timetableNames(print.sessions, print.of).map(page),
    ...(print.mark === undefined ? {} : { confidential: print.mark }),
  });
}
