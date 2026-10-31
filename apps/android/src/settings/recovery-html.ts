// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The printed «ورقة الاسترجاع» (#247, Recovery-sheet, R-6.5-05, answer 478):
// one A4 page with the title, what the key does, the key in its six numbered
// groups, large and left to right on two lines of three, then the key as one
// line, as a computer's 7-Zip takes it, and the lines on keeping it, what it
// restores and what it does not, and that the project has no copy. It names no
// teacher, school or pupil, so the page alone tells nothing of whose it is.

import { recoveryGroups } from '@minhajna/core';
import { escapeHtml, printDocument } from '../documents/print-html';

export interface RecoveryTexts {
  readonly lang: string;
  readonly dir: 'rtl' | 'ltr';
  readonly title: string;
  /** What the key does, above it. */
  readonly intro: string;
  /** How a computer takes the key, above the one line. */
  readonly computer: string;
  /** The lines below, in order. */
  readonly lines: readonly string[];
}

/** Groups on each line of the table, so the key fits an A4 page's width. */
const ROW = 3;

/** The sheet's style, which the school's recovery parts share (#571). */
export const RECOVERY_CSS =
  'h1{font-family:Ruqaa,Naskh;font-size:18pt;margin:0 0 6mm;text-align:center}' +
  'p{margin:0 0 3mm;line-height:1.5}' +
  'table.key{direction:ltr;margin:6mm auto;border-collapse:collapse}' +
  'table.key td{border:0.5pt solid #000;padding:2mm 4mm;text-align:center}' +
  'table.key .n{font-size:9pt}table.key .g{font-family:Sans;font-size:20pt;font-weight:700;letter-spacing:1.5mm}' +
  '.line{direction:ltr;text-align:center;font-family:Sans;font-size:13pt;letter-spacing:0.6mm;margin:0 0 6mm}';

/** A sheet's page for `key`: the title, the intro, the key in its groups and on one line, then the lines. */
export function recoveryPage(texts: Omit<RecoveryTexts, 'lang' | 'dir'>, key: string): string {
  const groups = recoveryGroups(key);
  const rows = [groups.slice(0, ROW), groups.slice(ROW)].map((row, at) => {
    const numbers = row.map((_, index) => `<td class="n">${at * ROW + index + 1}</td>`).join('');
    const cells = row.map((group) => `<td class="g">${escapeHtml(group)}</td>`).join('');
    return `<tr>${numbers}</tr><tr>${cells}</tr>`;
  });
  return (
    `<h1>${escapeHtml(texts.title)}</h1><p>${escapeHtml(texts.intro)}</p>` +
    `<table class="key">${rows.join('')}</table>` +
    `<p>${escapeHtml(texts.computer)}</p><p class="line">${escapeHtml(key)}</p>` +
    texts.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')
  );
}

/** The sheet for `key`, as one A4 portrait page. */
export function recoveryHtml(texts: RecoveryTexts, key: string): string {
  return printDocument({
    lang: texts.lang,
    dir: texts.dir,
    title: texts.title,
    landscape: false,
    css: RECOVERY_CSS,
    pages: [recoveryPage(texts, key)],
  });
}
