// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The spot-check sheet's A4 portrait page (#246, R-Spot, answers 489 and
// 491): the day of the visit, the title, the class, subject, teacher and
// school, the statement it comes from, the period, then one row per day drawn
// with empty columns for «في دفتر النصوص» and «في كراريس التلاميذ», and boxes
// for the inspector's notes and signature. It shows no times, since a
// statement carries no timetable, and no pupils' data, so it has no
// confidential mark. It fits one page, in black and white.

import { escapeHtml, printDocument } from '../documents/print-html';
import type { Translate } from '../documents/document-data';

/** What the sheet shows, in words already. */
export interface SpotSheet {
  /** The day of the visit, as the head gives it. */
  readonly today: string;
  /** The class, subject, teacher and school, such as «4م2 · اللغة العربية · أستاذ لم يُسمَّ». */
  readonly who: string;
  readonly statement: string;
  readonly period: string;
  /** Each day drawn, with its weekday. */
  readonly days: readonly string[];
}

const CSS =
  '.head{display:flex;justify-content:flex-end;font-size:10pt}' +
  'h1{font-family:Ruqaa,Naskh,serif;text-align:center;font-size:20pt;margin:3mm 0 1mm}' +
  '.who{text-align:center;font-weight:700;margin-bottom:2mm}.line{text-align:center;margin:0 0 1mm}' +
  'table.days{width:100%;border-collapse:collapse;margin-top:4mm}' +
  '.days th,.days td{border:0.3mm solid #000;padding:2mm;text-align:start;vertical-align:top}' +
  '.days th{width:22%}.days thead th{width:auto}.days tbody td{height:36mm}.days tr{break-inside:avoid}' +
  '.box{border:0.3mm solid #000;padding:2mm;margin-top:4mm;break-inside:avoid}.notes{height:34mm}.sign{height:20mm}';

/** The page's content. */
function content(t: Translate, sheet: SpotSheet): string {
  const e = escapeHtml;
  const rows = sheet.days.map((day) => `<tr><th>${e(day)}</th><td></td><td></td></tr>`).join('');
  return (
    `<div class="head"><span>${e(sheet.today)}</span></div>` +
    `<h1>${e(t('reader.spot.title'))}</h1><div class="who">${e(sheet.who)}</div>` +
    `<p class="line">${e(sheet.statement)}</p><p class="line">${e(sheet.period)}</p>` +
    `<table class="days"><thead><tr><th>${e(t('reader.spot.day'))}</th><th>${e(t('reader.spot.book'))}</th>` +
    `<th>${e(t('reader.spot.notebooks'))}</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<div class="box notes">${e(t('reader.spot.notes'))}</div>` +
    `<div class="box sign">${e(t('reader.spot.signature'))}</div>`
  );
}

/** The whole printed sheet, in the interface's language and direction. */
export function spotHtml(t: Translate, sheet: SpotSheet, lang: string, dir: 'rtl' | 'ltr'): string {
  return printDocument({
    lang,
    dir,
    title: t('reader.spot.title'),
    landscape: false,
    css: CSS,
    pages: [content(t, sheet)],
  });
}
