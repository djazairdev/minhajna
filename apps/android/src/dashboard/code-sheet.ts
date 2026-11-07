// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed joining codes of a school's teachers (answer 809, as D-Issue's
// sheet): an A4 page with the school's name, then a card for each teacher, the
// code's QR in its quiet zone, the teacher's name and option, and the code
// written in its groups, to be handed over by hand. Black and white; it names
// teachers only, and says the data is made up.

import type { TFunction } from 'i18next';
import { escapeHtml, printDocument } from '../documents/print-html';
import { qrSvg } from '../sharing/statement-page';

export interface SheetTeacher {
  readonly name: string;
  readonly option: string;
  readonly code: string;
  /** The code's QR, as `qrRows` gives it. */
  readonly rows: string;
}

const QUIET = 4;
const CSS =
  'h1{font-family:Ruqaa,Naskh,serif;text-align:center;font-size:18pt;margin:2mm 0 1mm}' +
  '.lead{text-align:center;font-size:10pt;margin-bottom:4mm}' +
  '.codes{display:flex;flex-wrap:wrap;gap:4mm}' +
  '.code{width:calc(50% - 2mm);box-sizing:border-box;border:0.3mm solid #000;padding:3mm;' +
  'display:flex;gap:3mm;align-items:center;break-inside:avoid}' +
  '.code p{margin:0 0 1.5mm}.qr{width:38mm;height:38mm;flex:none}' +
  '.text{font-family:Sans,sans-serif;direction:ltr;unicode-bidi:isolate;font-size:11pt}.note{font-size:9pt}';

function drawn(rows: string): string {
  const lines = rows.split('\n');
  const size = (lines[0]?.length ?? 0) + QUIET * 2;
  const blank = '0'.repeat(size);
  const pad = '0'.repeat(QUIET);
  const quiet = Array.from({ length: QUIET }, () => blank);
  return qrSvg({ size, rows: [...quiet, ...lines.map((line) => pad + line + pad), ...quiet] });
}

/** The sheet, in the interface's language and direction. */
export function codeSheetHtml(
  t: TFunction,
  sheet: { readonly school: string; readonly teachers: readonly SheetTeacher[] },
  lang: string,
  dir: 'rtl' | 'ltr',
): string {
  const e = escapeHtml;
  const cards = sheet.teachers
    .map(
      (one) =>
        `<div class="code">${drawn(one.rows)}<div><p><b>${e(one.name)}</b></p><p>${e(one.option)}</p>` +
        `<p class="text">${e(one.code)}</p>` +
        `<p class="note">${e(t('dashboard.teachers.sheet.handover'))}</p></div></div>`,
    )
    .join('');
  return printDocument({
    lang,
    dir,
    title: t('dashboard.teachers.sheet.title'),
    landscape: false,
    css: CSS,
    pages: [
      `<h1>${e(t('dashboard.teachers.sheet.title'))}</h1>` +
        `<div class="lead">${e(`${sheet.school} · ${t('dashboard.madeUp')}`)}</div><div class="codes">${cards}</div>`,
    ],
  });
}
