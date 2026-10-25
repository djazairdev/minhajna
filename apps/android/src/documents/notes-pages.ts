// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A day's lesson notes (#237, answers 416 to 420): one A4 portrait page for
// each of the day's sessions that has a lesson from the plan, in the day's
// order. The page names the note, its number once kept, the class, the subject
// with the level a joint class's course follows, the day and the time; then the
// head from the plan; then each paragraph accepted or written, in ink under its
// title, each one still grey as its title over lines left for the pen, and the
// teacher's own; and the box «تأشيرة المدير أو المفتش», always blank. A note
// has no teacher's box, so it takes no drawn signature. The blank version keeps
// the head and every title over lines. A day with no such session prints a page
// that says so.

import { courseMigration, courseSetup, noteDraft, noteFor, todayView } from '@minhajna/core';
import { bookSpan } from '../entry/book-lines';
import { noteBlocks, noteSubject, sessionItem } from '../notes/note-rules';
import { localized } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { sessionTime } from '../times/times-rules';
import { isolate } from '../week/grid-labels';
import type { DocumentKind } from './catalogue';
import { dayTitle, taughtClasses, type DocumentData, type Translate } from './document-data';
import { escapeHtml, printDocument } from './print-html';

const PEN_LINES = 3;

const CSS =
  'h1{font-family:Ruqaa,Naskh;font-size:16pt;text-align:center;margin:0 0 1mm}' +
  '.scope{text-align:center;font-size:10.5pt;margin:0 0 4mm}' +
  'table.head{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:3mm}' +
  'table.head td{border:0.8pt solid #000;padding:1.5mm 2mm;font-size:10.5pt;vertical-align:top}' +
  'table.head b{font-weight:700}' +
  '.para{margin:0 0 1.5mm;break-inside:avoid;page-break-inside:avoid}' +
  '.para h2{font-size:11.5pt;font-weight:700;margin:0 0 1mm;border-bottom:0.6pt solid #000}' +
  '.para p{margin:0;white-space:pre-line;line-height:1.6}' +
  '.pen i{display:block;height:5.8mm;border-bottom:0.5pt dotted #000}' +
  '.visa{margin-top:3mm;border:1.2pt solid #000;border-radius:4pt;height:20mm;padding:2mm 3mm;' +
  'break-inside:avoid;page-break-inside:avoid}.visa b{font-family:Ruqaa,Naskh;font-size:12pt}' +
  '.none{text-align:center;margin-top:20mm}' +
  '.latin h1,.latin .visa b{font-family:Sans,Naskh,sans-serif}';

const pen = '<div class="pen">' + '<i></i>'.repeat(PEN_LINES) + '</div>';

function paragraph(title: string, text: string | null): string {
  const body = text === null ? pen : `<p>${escapeHtml(text)}</p>`;
  return `<div class="para"><h2>${escapeHtml(title)}</h2>${body}</div>`;
}

/** The pages' content: one for each session with a lesson, or one saying there is none. */
function notePages(data: DocumentData, t: Translate, blank: boolean): string[] {
  const context = coreContext(data);
  const pages = todayView(context, data.day).sessions.flatMap((item) => {
    const itemId = sessionItem(item);
    const courseId = item.session.courseId;
    const draft = itemId === null ? null : noteDraft(context, courseId, itemId);
    if (itemId === null || draft === null) return [];
    const note = blank ? undefined : noteFor(data.state, courseId, itemId, courseMigration(context, courseId));
    const { schoolClass, course } = courseSetup(context, courseId);
    const subject = noteSubject(t, data.profile, data.lang, course, schoolClass);
    const school = data.state.schools.get(schoolClass.schoolId);
    const time = bookSpan(t, sessionTime(data, school, item.session.slot, item.session.day), data.dir);
    const scope = [isolate(schoolClass.name), subject, dayTitle(data, t, data.day), time].filter(Boolean).join(' · ');
    const head = [
      [t('notes.head.unit'), draft.unit ?? ''],
      [t('notes.head.domain'), draft.domain === undefined ? '' : localized(draft.domain)],
      [t('notes.head.resource'), draft.resource],
      [t('notes.head.duration'), t('notes.minutes', { minutes: draft.minutes })],
    ];
    const cells = head.map(([label, value]) => `<td><b>${escapeHtml(`${label}: `)}</b>${escapeHtml(value)}</td>`);
    const body = noteBlocks(t, draft, note)
      .map((block) => paragraph(block.title, block.inked && block.text.trim() !== '' ? block.text : null))
      .join('');
    const title = note === undefined ? t('notes.title') : t('notes.number', { number: note.number });
    return [
      `<h1>${escapeHtml(title)}</h1><p class="scope">${escapeHtml(scope)}</p>` +
        `<table class="head"><tr>${cells[0]}${cells[1]}</tr><tr>${cells[2]}${cells[3]}</tr></table>` +
        body +
        `<div class="visa"><b>${escapeHtml(t('notes.print.visa'))}</b></div>`,
    ];
  });
  const all = pages.length > 0 ? pages : [`<p class="none">${escapeHtml(t('notes.print.none'))}</p>`];
  return data.dir === 'ltr' ? all.map((page) => `<div class="latin">${page}</div>`) : all;
}

/** The whole document: the day's notes, as kept or blank with their headings. */
export function notesPages(data: DocumentData, t: Translate, blank: boolean): string {
  return printDocument({
    lang: data.lang,
    dir: data.dir,
    title: t('notes.row.name'),
    landscape: false,
    css: CSS,
    pages: notePages(data, t, blank),
  });
}

/** The notes as a document of a day; the tab's own row «المذكرات» opens the next note or this (answer 420). */
export const NOTES_KIND: DocumentKind = {
  id: 'notes',
  icon: 'pencil',
  pupils: false,
  landscape: false,
  empty: (data) => taughtClasses(data).length === 0,
  period: (data) => data.day,
  title: (t) => t('notes.row.name'),
  line: (data, t) => dayTitle(data, t, data.day),
  blankLine: (t) => t('notes.print.blank'),
  signatureLine: (t) => t('notes.print.signature'),
  emptyLine: (t) => t('notes.print.noClasses'),
  shown: () => false,
  byDay: true,
  pages: notesPages,
};
