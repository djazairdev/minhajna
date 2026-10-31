// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Issue's printed sheet of the codes still waiting to be scanned (#570,
// answers 596 and 598), printed from the PC to be handed over: an A4 page
// with the school's name and the day, then a card for each code, its QR with
// the quiet zone, the teacher, the subject and the code's last valid day, and
// that it is for one scan, handed over and never sent. Black and white, as
// every printed page; it names teachers only, so it carries no confidential
// mark.

import type { TFunction } from 'i18next';
import { escapeHtml, printDocument } from '../documents/print-html';
import { qrSvg } from '../sharing/statement-page';

/** A waiting code as the sheet prints it. */
export interface SheetCode {
  readonly teacher: string;
  readonly subject: string;
  readonly until: string;
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
  '.code p{margin:0 0 1.5mm}.qr{width:38mm;height:38mm;flex:none}.note{font-size:9pt}';

/** The QR's rows inside their quiet zone, as a vector drawing. */
function drawn(rows: string): string {
  const lines = rows.split('\n');
  const size = (lines[0]?.length ?? 0) + QUIET * 2;
  const blank = '0'.repeat(size);
  const pad = '0'.repeat(QUIET);
  const quiet = Array.from({ length: QUIET }, () => blank);
  return qrSvg({ size, rows: [...quiet, ...lines.map((line) => pad + line + pad), ...quiet] });
}

/** The whole printed sheet, in the interface's language and direction. */
export function issueSheetHtml(
  t: TFunction,
  sheet: { readonly school: string; readonly day: string; readonly codes: readonly SheetCode[] },
  lang: string,
  dir: 'rtl' | 'ltr',
): string {
  const e = escapeHtml;
  const cards = sheet.codes
    .map(
      (code) =>
        `<div class="code">${drawn(code.rows)}<div><p><b>${e(code.teacher)}</b></p><p>${e(code.subject)}</p>` +
        `<p>${e(t('demo.issue.sheet.until', { until: code.until }))}</p>` +
        `<p class="note">${e(t('demo.issue.sheet.handover'))}</p></div></div>`,
    )
    .join('');
  return printDocument({
    lang,
    dir,
    title: t('demo.issue.sheet.title'),
    landscape: false,
    css: CSS,
    pages: [
      `<h1>${e(t('demo.issue.sheet.title'))}</h1><div class="lead">${e(`${sheet.school} · ${sheet.day}`)}</div>` +
        `<div class="codes">${cards}</div>`,
    ],
  });
}
