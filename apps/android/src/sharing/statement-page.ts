// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «بيان التقدّم»'s A4 portrait page (#438, Share, R-3.10-02, R-5.5-07,
// R-5.9-08, answer 485): the day, the title, the class, every field the
// statement carries, and a box with «توقيع رقمي للتحقق، وليس توقيعاً قانونياً»,
// the teacher's key fingerprint and, when it fits one code, the signed text as
// a QR code, which reader mode reads from the paper (#246). That line links to
// the whole signed text (`statementLink`), which the PDF keeps as the link's
// address, so a saved PDF carries it however long it is; a statement too long
// for one code says it is checked from its file. It holds no pupils' data, so
// it has no confidential mark and no password. Black and white, as every
// printed page.

import { statementLink } from '@minhajna/core';
import type { QrMatrix } from '../native/NativeMinhajnaSignature';
import type { Translate } from '../documents/document-data';
import { escapeHtml, printDocument } from '../documents/print-html';
import type { StatementLine } from './statement-lines';

/** What the page shows, worked out once the statement is signed. */
export interface StatementSheet {
  readonly day: string;
  readonly className: string;
  readonly lines: readonly StatementLine[];
  /** The signed text, which the signature line links to. */
  readonly text: string;
  readonly fingerprint: string;
  readonly qr: QrMatrix | null;
}

const CSS =
  '.head{display:flex;justify-content:flex-end;font-size:10pt}' +
  'h1{font-family:Ruqaa,Naskh,serif;text-align:center;font-size:20pt;margin:3mm 0 1mm}' +
  '.who{text-align:center;font-weight:700;margin-bottom:4mm}' +
  'table.fields{width:100%;border-collapse:collapse}' +
  '.fields th,.fields td{border:0.3mm solid #000;padding:2mm;text-align:start;vertical-align:top}' +
  '.fields th{width:35%}.fields .note{font-size:9pt}' +
  '.privacy{font-size:9pt;margin:3mm 0}' +
  '.sign{border:0.3mm solid #000;padding:3mm;display:flex;gap:4mm;align-items:center}' +
  '.sign div{flex:1}.sign p{margin:0 0 2mm}.key{font-family:Sans,monospace;font-size:9pt;direction:ltr}' +
  '.qr{width:60mm;height:60mm;flex:none}a{color:#000;text-decoration:none}';

/** The fingerprint in groups of four, as a reader compares it by eye. */
export function groupedFingerprint(fingerprint: string): string {
  return fingerprint.replace(/(.{4})(?=.)/g, '$1 ');
}

/** The QR code as a vector drawing, one black run per row, the quiet zone included. */
export function qrSvg(qr: QrMatrix): string {
  const runs = qr.rows.flatMap((row, y) =>
    [...row.matchAll(/1+/g)].map((run) => `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`),
  );
  return (
    `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.size} ${qr.size}" ` +
    `shape-rendering="crispEdges"><rect width="${qr.size}" height="${qr.size}" fill="#fff"/>` +
    `<path fill="#000" d="${runs.join('')}"/></svg>`
  );
}

/** The page's content. */
function content(t: Translate, sheet: StatementSheet): string {
  const e = escapeHtml;
  const rows = sheet.lines
    .map(({ label, lines: [value, ...notes] }) => {
      const more = notes.map((note) => `<div class="note">${e(note)}</div>`).join('');
      return `<tr><th>${e(label)}</th><td>${e(value ?? '')}${more}</td></tr>`;
    })
    .join('');
  const code = sheet.qr === null ? `<p>${e(t('statement.page.tooLong'))}</p>` : `<p>${e(t('statement.page.code'))}</p>`;
  return (
    `<div class="head"><span>${e(sheet.day)}</span></div>` +
    `<h1>${e(t('statement.title'))}</h1><div class="who">${e(sheet.className)}</div>` +
    `<table class="fields"><tbody>${rows}</tbody></table>` +
    `<p class="privacy">${e(t('statement.page.privacy'))}</p>` +
    `<div class="sign"><div><p><a href="${e(statementLink(sheet.text))}">` +
    `<b>${e(t('statement.page.signed'))}</b></a></p>` +
    `<p>${e(t('statement.page.key'))} <span class="key">${e(groupedFingerprint(sheet.fingerprint))}</span></p>` +
    `${code}</div>${sheet.qr === null ? '' : qrSvg(sheet.qr)}</div>`
  );
}

/** The whole printed document, in the interface's language and direction. */
export function statementHtml(t: Translate, sheet: StatementSheet, lang: string, dir: 'rtl' | 'ltr'): string {
  return printDocument({
    lang,
    dir,
    title: t('statement.title'),
    landscape: false,
    css: CSS,
    pages: [content(t, sheet)],
  });
}
