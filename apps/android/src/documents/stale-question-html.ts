// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «سؤال المفتش»'s A4 portrait page (#230, Plan-stale, answer 384): the
// school, the year and the date, the title, the teacher and the subject,
// the classes, the pack, the reason it is stale, the question and what the
// class does meanwhile, and a box for the teacher's signature and one for
// the inspector's answer and stamp, both by hand. It holds no pupils' data,
// so it has no confidential mark. Black and white, as every printed page.

import type { StaleSheet } from '../plan/stale-question';
import { escapeHtml, printDocument } from './print-html';
import type { Translate } from './document-data';

const CSS =
  '.head{display:flex;justify-content:space-between;font-size:10pt}' +
  'h1{font-family:Ruqaa,Naskh,serif;text-align:center;font-size:20pt;margin:3mm 0 1mm}' +
  '.who{text-align:center;font-weight:700}.classes{text-align:center;font-size:10pt;margin-bottom:3mm}' +
  'p{margin:0 0 2mm}h2{font-size:11pt;margin:3mm 0 1mm}.question{font-weight:700;font-size:12pt}' +
  '.signs{display:flex;gap:4mm;margin-top:4mm}' +
  '.sign{flex:1;border:0.3mm solid #000;height:45mm;padding:2mm;display:flex;flex-direction:column;' +
  'justify-content:space-between;font-weight:700}.sign span{font-weight:400;font-size:9pt}' +
  '.privacy{font-size:9pt;margin-top:3mm}';

/** The page's content. */
function content(t: Translate, sheet: StaleSheet): string {
  const e = escapeHtml;
  const sign = (label: string) => `<div class="sign">${e(label)}<span>${e(t('septCheck.signDate'))}</span></div>`;
  return (
    `<div class="head"><span>${e(sheet.school)}</span><span>${e(sheet.date)}</span></div>` +
    `<h1>${e(t('staleQuestion.title'))}</h1>` +
    `<div class="who">${e(sheet.who)}</div><div class="classes">${e(sheet.classes)}</div>` +
    `<h2>${e(t('staleQuestion.packHead'))}</h2><p>${sheet.pack.map((line) => e(line)).join('<br>')}</p>` +
    `<h2>${e(t('staleQuestion.reasonHead'))}</h2><p>${e(sheet.reason)}</p>` +
    `<h2>${e(t('staleQuestion.questionHead'))}</h2>` +
    `<p class="question">${e(t('staleQuestion.question'))}</p><p>${e(t('staleQuestion.meanwhile'))}</p>` +
    `<div class="signs">${sign(t('septCheck.teacherSign'))}${sign(t('staleQuestion.inspectorSign'))}</div>` +
    `<div class="privacy">${e(t('staleQuestion.privacy'))}</div>`
  );
}

/** The whole printed document, in the interface's language and direction. */
export function staleQuestionHtml(t: Translate, sheet: StaleSheet, lang: string, dir: 'rtl' | 'ltr'): string {
  return printDocument({
    lang,
    dir,
    title: t('staleQuestion.title'),
    landscape: false,
    css: CSS,
    pages: [content(t, sheet)],
  });
}
