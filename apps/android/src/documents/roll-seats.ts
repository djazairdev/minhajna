// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مخطط الجلوس», the seating plan's print (PRD §3.4, #217, Roll-print,
// answers 254 and 265): one A4 page for each of the class's plans, the
// whole class's first, then each group's, or the one plan asked for. The
// room faces as on the setup screen: «السبورة» on top, the rows from the
// board to the back, the seats from the start side, with the aisles. A seat
// shows its pupil's full name only, and an empty seat, or one whose pupil
// is no longer on the list today, is an outlined empty box to write in. The
// pages are landscape when a plan has more than six seats in a row, and
// carry «داخلي · سري», as the plan is private.

import { groupPupils, wholeGroup, type SeatingPlan } from '@minhajna/core';
import { coreContext } from '../storage/core-context';
import type { DocumentData, Translate } from './document-data';
import { escapeHtml, printDocument } from './print-html';
import { bookScope, type RollBook } from './roll-spread-pages';

/** The rows' room on a page, in millimetres, by orientation, and the tallest a seat gets. */
const ROOM = { portrait: 200, landscape: 120 };
const TALLEST = 24;
const WIDE = 6;

const CSS =
  'h1{font-family:Ruqaa,Naskh;font-size:15pt;margin:0;line-height:1.3}.scope{font-size:10pt;margin:0 0 3mm}' +
  '.board{border:0.8pt solid #000;text-align:center;font-weight:700;padding:1.5mm 0;margin:0 15% 4mm}' +
  'table.room{border-collapse:separate;border-spacing:1.5mm 2.5mm;width:100%;table-layout:fixed}' +
  'table.room td{padding:0 1mm;text-align:center;vertical-align:middle;font-size:9pt;line-height:1.2;' +
  'overflow:hidden;word-break:break-word}table.room td.seat{border:0.8pt solid #000}table.room td.aisle{width:4mm}';

/** The class's plans in its groups' order, the whole class's first, or only the one of `only`. */
export function seatPlans(data: DocumentData, classId: string, only?: string): SeatingPlan[] {
  const schoolClass = data.state.classes.get(classId);
  if (schoolClass === undefined) return [];
  const whole = wholeGroup(schoolClass).id;
  const order = [whole, ...schoolClass.groups.map((group) => group.id).filter((id) => id !== whole)];
  return order
    .filter((groupId) => only === undefined || groupId === only)
    .map((groupId) => data.state.seating.get(`${classId}/${groupId}`))
    .filter((plan) => plan !== undefined);
}

/** Whether any of the plans to print is wider than a portrait page holds well. */
export function seatsLandscape(plans: readonly SeatingPlan[]): boolean {
  return plans.some((plan) => plan.columns > WIDE);
}

function page(data: DocumentData, t: Translate, book: RollBook, plan: SeatingPlan, landscape: boolean): string {
  const day = data.today ?? data.day;
  const listed = new Map(
    groupPupils(coreContext(data), plan.classId, plan.groupId, day).map((pupil) => [pupil.id, pupil.name]),
  );
  const aisleEvery = plan.aisleEvery ?? 0;
  const aisle = (column: number) => aisleEvery > 0 && column > 0 && column % aisleEvery === 0;
  const tall = Math.min(
    TALLEST,
    Math.floor(((landscape ? ROOM.landscape : ROOM.portrait) / plan.rows) * 10) / 10 - 2.5,
  );
  const columns = Array.from({ length: plan.columns }, (_, column) => column);
  const cols = columns.map((column) => (aisle(column) ? '<col class="aisle"><col>' : '<col>')).join('');
  const body = Array.from({ length: plan.rows }, (_, row) => {
    const cells = columns.map((column) => {
      const id = plan.seats.find((seat) => seat.row === row && seat.column === column)?.pupilId;
      const name = id === undefined ? '' : (listed.get(id) ?? '');
      return (aisle(column) ? '<td class="aisle"></td>' : '') + `<td class="seat">${escapeHtml(name)}</td>`;
    });
    return `<tr style="height:${tall}mm">${cells.join('')}</tr>`;
  }).join('');
  return (
    `<h1>${escapeHtml(t('rollPrint.seats.name'))}</h1>` +
    `<p class="scope">${escapeHtml(bookScope(data, { ...book, groupId: plan.groupId }, null))}</p>` +
    `<div class="board">${escapeHtml(t('seats.board'))}</div>` +
    `<table class="room"><colgroup>${cols}</colgroup><tbody>${body}</tbody></table>`
  );
}

/** The class's seating plans, or the one of `only`, one A4 page each. */
export function rollSeatsPages(data: DocumentData, t: Translate, book: RollBook, only?: string): string {
  const plans = seatPlans(data, book.classId, only);
  const landscape = seatsLandscape(plans);
  return printDocument({
    lang: data.lang,
    dir: data.dir,
    title: t('rollPrint.seats.name'),
    landscape,
    css: CSS,
    pages: plans.map((plan) => page(data, t, book, plan, landscape)),
    books: plans.map(() => book.classId),
    confidential: t('documents.confidential'),
  });
}
