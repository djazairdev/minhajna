// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The drawn signature on the documents (#236, answers 412 and 413): in the
// signature column of the texts book's and the strip's confirmed entries, in
// the teacher's box of the timetable, the roll-call spread and the year's
// summary, and at the foot of a secondary, primary or specialist journal
// page only when none of its sessions awaits confirmation; never in the
// director's or inspector's boxes, never on a blank version, nor when the
// teacher chose «فارغة» or turned it off. It prints as the drawn path, in
// black. Made-up records only.

import { confirmSessions, parseDay, sessionsBetween, type Signature } from '@minhajna/core';
import type { TestData } from '../jest/app-data';
import { withPrimary } from '../jest/primary-class';
import { withSpecialist } from '../jest/specialist-classes';
import { withDay } from '../jest/today-day';
import { documentKind, type DocumentId } from '../src/documents/catalogue';
import type { DocumentData } from '../src/documents/document-data';
import { drawnMark } from '../src/documents/drawn-mark';
import { rollYearPages } from '../src/documents/roll-year-pages';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';

const t = i18n.getFixedT('ar');
const DAY = parseDay('2026-10-15');
const signature: Signature = { width: 600, height: 200, path: 'M 10 20 L 300 150 M 400 40 L 400 40' };
const MARK = '<svg class="drawn"';

const documentData = (data: TestData, drawn?: boolean): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  calendarRelease: data.calendarRelease,
  packs: data.packs,
  bells: data.bells,
  day: DAY,
  lang: 'ar',
  dir: 'rtl',
  ...(drawn !== undefined && { drawn }),
});

const marks = (html: string) => html.split(MARK).length - 1;

/** The signature drawn, and in use unless `on` is false. */
async function signed(data: TestData, on = true): Promise<TestData> {
  await data.book.record(DAY, { kind: 'teacher.personal.set', personal: { signature, signatureOn: on } });
  return data;
}

/** The first `count` of that Thursday's sessions confirmed, or all of them. */
async function confirmed(data: TestData, count?: number): Promise<TestData> {
  const context = coreContext({ ...data, state: data.book.state });
  const sessions = sessionsBetween(context, DAY, DAY).slice(0, count);
  await data.book.recordAll(
    DAY,
    confirmSessions(
      context,
      sessions.map((session) => ({ session })),
    ),
  );
  return data;
}

const pages = (id: DocumentId, data: TestData, blank = false, drawn?: boolean) => {
  const kind = documentKind(id);
  if (kind === undefined) throw new Error(`No ${id}`);
  return kind.pages(documentData(data, drawn), t, blank);
};

test('the mark is the drawn path in black, and nothing without a signature', () => {
  expect(drawnMark(signature)).toBe(
    '<svg class="drawn" viewBox="0 0 600 200" aria-hidden="true">' +
      '<path d="M 10 20 L 300 150 M 400 40 L 400 40" fill="none" stroke="#000" stroke-width="1.2" ' +
      'vector-effect="non-scaling-stroke" ' +
      'stroke-linecap="round" stroke-linejoin="round"/></svg>',
  );
  expect(drawnMark(null)).toBe('');
  expect(drawnMark({ ...signature, path: '<script>' })).toBe('');
});

test.each(['texts', 'strip', 'timetable', 'roll'] as const)(
  'the %s carries it while it is in use, but not blank, «فارغة» or turned off',
  async (id) => {
    const data = await signed(await confirmed(await withDay()));
    expect(marks(pages(id, data))).toBeGreaterThan(0);
    expect(pages(id, data)).toContain(signature.path);
    expect(marks(pages(id, data, false, false))).toBe(0);
    if (documentKind(id)?.blankLine(t) !== null) expect(marks(pages(id, data, true))).toBe(0);
    expect(marks(pages(id, await signed(data, false)))).toBe(0);
  },
);

test('the texts book and the strip sign each confirmed entry in its last column', async () => {
  const data = await signed(await confirmed(await withDay(), 1));
  for (const id of ['texts', 'strip'] as const) {
    const html = pages(id, data);
    expect(html.match(/<tr class="entry">/g)).toHaveLength(1);
    expect(marks(html)).toBe(1);
    expect(html).toMatch(/<td>(?:(?!<td>).)*<svg class="drawn"[^]*?<\/svg><\/td><\/tr>/);
  }
});

test("the timetable, the roll-call spread and the year's summary sign the teacher's box alone", async () => {
  const data = await signed(await confirmed(await withDay()));
  const timetable = pages('timetable', data);
  expect(marks(timetable)).toBe(1);
  expect(timetable).toMatch(/<div class="boxes"><div><b>[^<]*<\/b><svg class="drawn"/);
  const roll = pages('roll', data);
  const year = rollYearPages(documentData(data), t, false);
  for (const html of [roll, year]) {
    const tables = html.match(/<table class="signs">[^]*?<\/table>/g) ?? [];
    expect(tables.length).toBeGreaterThan(0);
    expect(marks(html)).toBe(tables.length);
    for (const table of tables) {
      expect(table.split('<td>').map((cell) => cell.includes(MARK))).toEqual([false, true, false, false]);
    }
  }
  expect(marks(rollYearPages(documentData(data), t, true))).toBe(0);
  expect(marks(rollYearPages(documentData(data, false), t, false))).toBe(0);
});

test('a journal page is signed only once none of its sessions awaits confirmation, in the teacher’s box', async () => {
  const data = await signed(await withDay());
  expect(marks(pages('journal', data))).toBe(0);
  await confirmed(data, 1);
  expect(marks(pages('journal', data))).toBe(0);
  await confirmed(data);
  const html = pages('journal', data);
  expect(marks(html)).toBe(1);
  expect(html).toMatch(/<div class="visa"><div>[^<]*<svg class="drawn"/);
  expect(marks(pages('journal', data, true))).toBe(0);
  expect(marks(pages('journal', data, false, false))).toBe(0);
});

test('a primary or specialist journal page is signed once its day is confirmed, never in a visa', async () => {
  for (const [id, made] of [
    ['primary-journal', withPrimary],
    ['specialist-journal', () => withSpecialist()],
  ] as const) {
    const data = await signed(await made());
    await confirmed(data, 1);
    expect(marks(pages(id, data))).toBe(0);
    await confirmed(data);
    const html = pages(id, data);
    expect(marks(html)).toBeGreaterThan(0);
    const feet = html.match(/<div class="foot"[^>]*><div>[^<]*(?:<svg[^]*?<\/svg>)?<\/div>[^]*?<\/div><\/div>/g) ?? [];
    expect(feet.length).toBe(marks(html));
    expect(feet.every((foot) => foot.split(MARK).length === 2 && foot.indexOf(MARK) < foot.indexOf('</div>'))).toBe(
      true,
    );
    expect(marks(pages(id, data, true))).toBe(0);
  }
});
