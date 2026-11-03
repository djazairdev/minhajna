// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The announced days M-Totals offers (#598, answer 629): those the world's
// calendar and the bundled one give, after the first term's end and reached by
// the date, a day only one of them announces offered too, a day both announce
// once, with its term from the first, and every day in order. The calendars
// are the bundled one and a made-up release of it.

import { parseDay, type SchoolCalendar } from '@minhajna/core';
import { calendar } from '../jest/world-calendar';
import { sharedDays } from '../src/director/share-send';
import { totalsDays } from '../src/directorate/use-totals';

const [first, second, third] = calendar.year.terms;
const moved = { ...second, from: parseDay('2027-01-05') };
const exam = { ...calendar.entries.find((one) => one.effect === 'exam')!, id: 'made-up-exam' };
const world: SchoolCalendar = {
  ...calendar,
  year: { ...calendar.year, terms: [first, moved, third] },
  entries: [...calendar.entries, { ...exam, from: parseDay('2027-02-10'), to: parseDay('2027-02-11') }],
};

test('both calendars’ days are offered once each, in order, each with its term in the first', () => {
  const date = third.to;
  const days = totalsDays([world, calendar], date);
  const all = [...new Set([...sharedDays(world, date), ...sharedDays(calendar, date)].map((one) => one.day))];
  expect(days.map((one) => one.day)).toEqual(all.sort());
  expect(days.some((one) => one.day === parseDay('2027-02-10'))).toBe(true);
  const inSecond = days.filter((one) => one.day > moved.from && one.day <= second.to);
  expect(inSecond.length).toBeGreaterThan(0);
  for (const one of inSecond) expect(one.term).toEqual(moved);
  const both = inSecond.find((one) => sharedDays(calendar, date).some((other) => other.day === one.day))!;
  expect(totalsDays([calendar, world], date).find((one) => one.day === both.day)?.term).toEqual(second);
  expect(totalsDays([world, calendar], first.to)).toEqual([]);
});
