// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «ورقة غياب الحصة», the session slip handed to the education counsellor
// (PRD §3.4, R-3.4-31, #217, Roll-print, answers 254 and 264): for a class
// whose roll is called per session, as in CEM and lycée, one taken roll
// call's class, its session's subject, the school, day, time, group and
// teacher, then only its absent and late pupils with their numbers, as the
// record names them even after a move, or «لا غياب ولا تأخر», and
// the counsellor's box. It prints once on the top half of an A4 portrait
// page, with a dashed cut line under it, and carries «داخلي · سري» at its
// own head and foot, above the cut, rather than at the page's.

import { current, rollCallUnits, unitKind, type Context, type Day, type RollCallUnit } from '@minhajna/core';
import { unitTime } from '../roll/roll-labels';
import { listNumbers, unitOf } from '../roll/roll-rules';
import { coreContext } from '../storage/core-context';
import { dayTitle, type DocumentData, type Translate } from './document-data';
import { escapeHtml, printDocument } from './print-html';
import { bookScope, ofBook, type RollBook } from './roll-spread-pages';

const CSS =
  '.slip{min-height:136mm;display:flex;flex-direction:column}.mark{text-align:center;font-size:9pt;font-weight:700;' +
  'padding:2mm 0}.mark.end{margin-top:auto}h1{font-family:Ruqaa,Naskh;font-size:15pt;margin:0;line-height:1.3}' +
  '.scope{font-size:10pt;margin:0 0 1mm}.when{font-size:10pt;margin:0 0 3mm}' +
  'table.slip-list{border-collapse:collapse;width:100%;table-layout:fixed;font-size:9.5pt}' +
  'table.slip-list th,table.slip-list td{border:0.6pt solid #000;padding:0 1.5mm;height:5.5mm;' +
  'white-space:nowrap;overflow:hidden}table.slip-list th{text-align:center}table.slip-list td.n{text-align:center}' +
  '.none{font-size:11pt;margin:4mm 0}' +
  'table.signs{width:50%;border-collapse:collapse;margin-top:3mm;font-size:9pt;break-inside:avoid}' +
  'table.signs td{border:0.6pt solid #000;height:14mm;vertical-align:top;padding:1mm}' +
  '.cut{border-top:0.8pt dashed #000}';

/** Whether the class's roll is called per session, so its roll calls have slips. */
export function slipsOffered(data: DocumentData, book: RollBook): boolean {
  const schoolClass = data.state.classes.get(book.classId);
  return schoolClass !== undefined && unitKind(coreContext(data), schoolClass) === 'session';
}

const taken = (context: Context) => (unit: RollCallUnit) => current(context.state.rollCalls.get(unit.key)) !== null;

/** The book's taken roll calls on `day`, in order. */
export function slipUnits(data: DocumentData, book: RollBook, day: Day): RollCallUnit[] {
  const context = coreContext(data);
  return rollCallUnits(context, book.classId, day, day).filter(ofBook(data, book)).filter(taken(context));
}

/** The days of the school year with a taken roll call of the book, in order. */
export function slipDays(data: DocumentData, book: RollBook): Day[] {
  const context = coreContext(data);
  const units = rollCallUnits(context, book.classId, data.year.from, data.year.to)
    .filter(ofBook(data, book))
    .filter(taken(context));
  return [...new Set(units.map((unit) => unit.day))].sort();
}

/** The taken per-session roll call a session belongs to, whose slip the Roll screen's icon opens, or null. */
export function takenSlip(context: Context, sessionKey: string, day: Day): RollCallUnit | null {
  const unit = unitOf(context, sessionKey, day);
  const schoolClass = unit === null ? undefined : context.state.classes.get(unit.classId);
  if (unit === null || schoolClass === undefined || unitKind(context, schoolClass) !== 'session') return null;
  return taken(context)(unit) ? unit : null;
}

/** A roll call's time, or its half when the bells give none, as the screen and the slip name it. */
export function slipTime(data: DocumentData, t: Translate, unit: RollCallUnit): string {
  return (
    unitTime({ state: data.state, bells: data.bells, calendar: data.calendar }, unit, data.dir) ??
    t(`rollBook.spoken.${unit.half}`)
  );
}

/** The roll call's group when it is not the whole class, such as a TD half. */
export function slipGroup(data: DocumentData, unit: RollCallUnit): string | undefined {
  const schoolClass = data.state.classes.get(unit.classId);
  return schoolClass?.groups.find((one) => one.id === unit.groupId && one.kind !== 'whole')?.name;
}

/** A session chip's words: its time, and its group when it is not the whole class. */
export function slipLabel(data: DocumentData, t: Translate, unit: RollCallUnit): string {
  return [slipTime(data, t, unit), slipGroup(data, unit)].filter((part) => part !== undefined).join(' · ');
}

function slip(data: DocumentData, t: Translate, book: RollBook, unit: RollCallUnit): string {
  const context = coreContext(data);
  const record = current(context.state.rollCalls.get(unit.key));
  const numbers = listNumbers(context, unit.classId);
  const rows = [
    ...(record?.absent ?? []).map((absence) => ({
      id: absence.pupilId,
      state: t(absence.justified ? 'rollPrint.slip.justified' : 'rollPrint.slip.absent'),
    })),
    ...(record?.late ?? []).map((id) => ({ id, state: t('rollPrint.slip.late') })),
  ]
    .map((row) => ({ ...row, number: numbers.get(row.id) ?? 0, name: data.state.pupils.get(row.id)?.name ?? '' }))
    .sort((a, b) => a.number - b.number);
  const course = data.state.courses.get(unit.sessions[0]?.courseId ?? '');
  const when = [
    dayTitle(data, t, unit.day),
    `${t('rollPrint.slip.session')}${t('documents.journalLines.colon')}${slipTime(data, t, unit)}`,
    slipGroup(data, unit),
    `${t('rollPrint.slip.teacher')}${t('documents.journalLines.colon')}${data.state.personal?.name ?? ''}`,
  ].filter((part) => part !== undefined);
  const list =
    rows.length === 0
      ? `<p class="none">${escapeHtml(t('rollPrint.slip.none'))}</p>`
      : '<table class="slip-list"><colgroup><col style="width:12mm"><col><col style="width:40mm"></colgroup>' +
        `<thead><tr><th>${escapeHtml(t('documents.number'))}</th><th>${escapeHtml(t('documents.name'))}</th>` +
        `<th>${escapeHtml(t('rollPrint.slip.state'))}</th></tr></thead><tbody>` +
        rows
          .map(
            (row) =>
              `<tr><td class="n">${row.number}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.state)}</td></tr>`,
          )
          .join('') +
        '</tbody></table>';
  return (
    '<div class="slip">' +
    `<div class="mark">${escapeHtml(t('documents.confidential'))}</div>` +
    `<h1>${escapeHtml(t('rollPrint.slip.name'))}</h1>` +
    `<p class="scope">${escapeHtml(bookScope(data, { ...book, subject: course?.subject ?? book.subject }, null))}</p>` +
    `<p class="when">${when.map((part) => `<bdi>${escapeHtml(part)}</bdi>`).join(' · ')}</p>` +
    list +
    `<table class="signs"><tr><td>${escapeHtml(t('rollPrint.slip.supervisor'))}</td></tr></table>` +
    `<div class="mark end">${escapeHtml(t('documents.confidential'))}</div>` +
    '</div><div class="cut"></div>'
  );
}

/** The slip of one taken roll call of the book, on the top half of one A4 portrait page. */
export function rollSlipPages(data: DocumentData, t: Translate, book: RollBook, unit: RollCallUnit): string {
  return printDocument({
    lang: data.lang,
    dir: data.dir,
    title: t('rollPrint.slip.name'),
    landscape: false,
    css: CSS,
    pages: [slip(data, t, book, unit)],
    books: [book.classId],
  });
}
