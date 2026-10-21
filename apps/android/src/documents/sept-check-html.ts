// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The September check's A4 portrait page for an inspector (#225,
// Sept-check, R-4.11-06): the school, the year and the date, the title, the
// teacher and the subject, the days counted, the table with a column for
// each class, the notes, the pack, where the figures come from, and a box
// for the teacher's signature and one for the inspector's notes and stamp,
// both signed by hand. It holds no pupils' data, so it has no confidential
// mark. Black and white, as every printed document.

import { figure, type SeptSheet } from '../plan/sept-check';
import { escapeHtml, printDocument } from './print-html';
import type { Translate } from './document-data';

const CSS =
  '.head{display:flex;justify-content:space-between;font-size:10pt}' +
  'h1{font-family:Ruqaa,Naskh,serif;text-align:center;font-size:20pt;margin:3mm 0 1mm}' +
  '.who{text-align:center;font-weight:700}.period{text-align:center;font-size:10pt;margin-bottom:3mm}' +
  'table.check{width:100%;border-collapse:collapse;border:0.4mm solid #000;margin-bottom:3mm}' +
  'table.check td,table.check th{border:0.2mm solid #000;padding:1.2mm 2mm;text-align:start}' +
  'table.check td.n,table.check th.n{text-align:center;width:14mm}' +
  'table.check tr.section td{font-weight:700;background:#e6e6e6}' +
  'table.check tr.strong td{font-weight:700}' +
  'p{margin:0 0 2mm}h2{font-size:11pt;margin:3mm 0 1mm}' +
  '.signs{display:flex;gap:4mm;margin-top:4mm}' +
  '.sign{flex:1;border:0.3mm solid #000;height:30mm;padding:2mm;display:flex;flex-direction:column;' +
  'justify-content:space-between;font-weight:700}.sign span{font-weight:400;font-size:9pt}' +
  '.privacy{font-size:9pt;margin-top:3mm}';

/** The page's content. */
function content(t: Translate, sheet: SeptSheet): string {
  const e = escapeHtml;
  const head = `<tr><th></th>${sheet.classes.map((name) => `<th class="n">${e(name)}</th>`).join('')}</tr>`;
  const rows = sheet.rows
    .map((row) =>
      row.values === undefined
        ? `<tr class="section"><td colspan="${sheet.classes.length + 1}">${e(row.label)}</td></tr>`
        : `<tr${row.strong === true ? ' class="strong"' : ''}><td>${e(row.label)}</td>` +
          row.values.map((value) => `<td class="n">${figure(value)}</td>`).join('') +
          '</tr>',
    )
    .join('');
  const sign = (label: string) => `<div class="sign">${e(label)}<span>${e(t('septCheck.signDate'))}</span></div>`;
  return (
    `<div class="head"><span>${e(sheet.school)}</span><span>${e(sheet.date)}</span></div>` +
    `<h1>${e(t('septCheck.title'))}</h1>` +
    `<div class="who">${e(sheet.who)}</div><div class="period">${e(sheet.period)}</div>` +
    `<table class="check"><thead>${head}</thead><tbody>${rows}</tbody></table>` +
    sheet.notes.map((note) => `<p>${e(note)}</p>`).join('') +
    `<h2>${e(t('septCheck.packHead'))}</h2>` +
    sheet.packs
      .map((pack) => `<p><b>${e(pack.title)}</b><br>${pack.lines.map((line) => e(line)).join('<br>')}</p>`)
      .join('') +
    `<h2>${e(t('septCheck.sourcesHead'))}</h2><p>${e(sheet.sources)}</p>` +
    `<div class="signs">${sign(t('septCheck.teacherSign'))}${sign(t('septCheck.inspectorSign'))}</div>` +
    `<div class="privacy">${e(t('septCheck.privacy'))}</div>`
  );
}

/** The whole printed document, in the interface's language and direction. */
export function septCheckHtml(t: Translate, sheet: SeptSheet, lang: string, dir: 'rtl' | 'ltr'): string {
  return printDocument({
    lang,
    dir,
    title: t('septCheck.title'),
    landscape: false,
    css: CSS,
    pages: [content(t, sheet)],
  });
}
