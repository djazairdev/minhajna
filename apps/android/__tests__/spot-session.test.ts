// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The spot-check sheet on the inspector's phone (#594, answer 622), on the
// made-up term of grant-term.ts: opening it opens 1م2, posting a use for each
// of its weeks, and, the first time, keeps the three days with a held session,
// whose rows are their held sessions; opening it again, or twice at once, keeps
// the days drawn once; saving keeps the notes, which opening again gives back;
// a sheet kept with fewer days is topped up, its day and notes staying; two
// openings at once share one draw; notes on too many sessions are refused; and
// an ended grant's sheet is refused before anything is put or kept. Every
// school, class, teacher and device is made up.

import { addDays, eventOf, parseDay, SPOT_BOOKS_MOST } from '@minhajna/core';
import { grantTerm, STAFFED, WEEKS } from '../jest/grant-term';
import { MINE } from '../jest/term-weeks';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { approveGrant } from '../src/director/grant-make';
import { openSpotSheet, saveSpotSheet } from '../src/inspector/spot-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { deliveryReading } from '../src/week/school-mine-session';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const reading = deliveryReading(MINE, [], []);
const posts = () => server.seen.filter((one) => one.method === 'POST' && one.path.endsWith('/batches')).length;
const kept = (book: { entries: readonly Parameters<typeof eventOf>[0][] }) =>
  book.entries.filter((one) => eventOf(one)?.kind === 'inspector.sheet').length;

async function granted() {
  const term = await grantTerm();
  const grant = await approveGrant(term.director, STAFFED, (await term.ask()).id, term.fingerprint, kit, server.send);
  return { ...term, grant };
}

test('opening the sheet opens its classes, then keeps the days with a held session and lists their rows', async () => {
  const { inspector, grant } = await granted();
  const before = posts();
  const opened = await openSpotSheet(inspector, grant, reading, kit, server.send);
  expect(posts() - before).toBe(WEEKS.length);
  expect(opened.sheet.days).toEqual([WEEKS[0], WEEKS[1], parseDay('2027-01-11')]);
  expect(opened.rows.map((one) => [one.day, one.class, one.start])).toEqual(
    opened.sheet.days.map((day) => [day, '1م2', 480]),
  );
  expect([...opened.classes.values()].map((one) => one?.delivery.class)).toEqual(['1م2']);
  expect(kept(inspector.book)).toBe(1);
});

test('the days are drawn once, even twice at once, and the notes saved come back', async () => {
  const { inspector, grant } = await granted();
  const [one, two] = await Promise.all([
    openSpotSheet(inspector, grant, reading, kit, server.send),
    openSpotSheet(inspector, grant, reading, kit, server.send),
  ]);
  expect(two.sheet).toEqual(one.sheet);
  expect(kept(inspector.book)).toBe(1);
  const books = [{ row: one.rows[0].key, note: 'Matches the made-up exercise books' }];
  const saved = await saveSpotSheet(inspector, { ...one.sheet, notes: 'Made-up visit notes', books });
  expect([saved.notes, saved.books]).toEqual(['Made-up visit notes', books]);
  const again = await openSpotSheet(inspector, grant, reading, kit, server.send);
  expect([again.sheet.days, again.sheet.notes, again.sheet.books]).toEqual([one.sheet.days, saved.notes, books]);
  expect(kept(inspector.book)).toBe(2);
  await expect(saveSpotSheet(inspector, { ...one.sheet, notes: 5 as never })).rejects.toMatchObject({
    code: 'E_WORLD',
  });
});

test('an ended grant’s sheet is refused before anything is put or kept', async () => {
  const { inspector, grant } = await granted();
  const after = { ...inspector, date: addDays(grant.until, 1) };
  const before = posts();
  await expect(openSpotSheet(after, grant, reading, kit, server.send)).rejects.toMatchObject({
    code: 'E_GRANT_ENDED',
  });
  expect([posts() - before, kept(inspector.book)]).toEqual([0, 0]);
});

test('a sheet kept with fewer days is topped up, its day and notes staying', async () => {
  const { inspector, grant } = await granted();
  const books = [{ row: `${WEEKS[1]}\n${grant.weeks[0].course}\n480\n`, note: 'Made-up note' }];
  const short = { grant: grant.id, days: [WEEKS[1]], notes: 'Made-up visit notes', books };
  await inspector.book.record(inspector.date, { kind: 'inspector.sheet', sheet: short });
  const opened = await openSpotSheet(inspector, grant, reading, kit, server.send);
  expect(opened.sheet).toEqual({ ...short, days: [WEEKS[0], WEEKS[1], parseDay('2027-01-11')] });
  expect(kept(inspector.book)).toBe(2);
});

test('two openings at once share one draw, and notes on too many sessions are refused', async () => {
  const { inspector, grant } = await granted();
  const record = inspector.book.record.bind(inspector.book);
  const spy = jest.spyOn(inspector.book, 'record').mockImplementation(async (...args) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return record(...args);
  });
  const [one, two] = await Promise.all([
    openSpotSheet(inspector, grant, reading, kit, server.send),
    openSpotSheet(inspector, grant, reading, kit, server.send),
  ]);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(two.sheet).toEqual(one.sheet);
  spy.mockRestore();
  const books = Array.from({ length: SPOT_BOOKS_MOST + 1 }, (_, at) => ({
    row: `${WEEKS[0]}\n${grant.weeks[0].course}\n${at}\n`,
    note: 'x',
  }));
  await expect(saveSpotSheet(inspector, { ...one.sheet, books })).rejects.toMatchObject({ code: 'E_SHEET_FULL' });
  expect(kept(inspector.book)).toBe(1);
});
