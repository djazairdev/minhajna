// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A version's days and words (#578, answer 606): a standing version starts on
// one of four Sundays from the next one, never before the standing version it
// is drafted from; a version for one day takes a school day of the coming two
// weeks; an affected teacher's line says from which day their changes apply, or
// on which day only; teaching hours read as whole hours and minutes, each with
// its plural; and a session of week A or B names its week. Every session is
// made up.

import { addDays, weekday, type Day, type PartSession } from '@minhajna/core';
import { i18n } from '../src/text/i18n';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import { slotText } from '../src/timetable/proposal-text';
import { hoursText, oneDays, startDays, teacherLine } from '../src/timetable/version-text';

const thursday = '2026-11-05' as Day;
const sunday = addDays(thursday, 3);

test('a standing version starts on four Sundays, never before the one it is drafted from', () => {
  expect(weekday(sunday)).toBe(0);
  expect(startDays(thursday)).toEqual([0, 7, 14, 21].map((days) => addDays(sunday, days)));
  expect(startDays(thursday, addDays(sunday, 7))[0]).toBe(addDays(sunday, 7));
  expect(startDays(thursday, addDays(sunday, 8))[0]).toBe(addDays(sunday, 14));
  expect(startDays(thursday, thursday)[0]).toBe(sunday);
});

test('a version for one day takes a school day of the coming two weeks', () => {
  const days = oneDays(thursday, [0, 1, 2, 3, 4]);
  expect(days).toHaveLength(10);
  expect(days[0]).toBe(sunday);
  expect(days.every((one) => weekday(one) <= 4)).toBe(true);
});

test('a teacher’s line says from which day, or on which day only', () => {
  const t = i18n.getFixedT('en');
  const before: PartSession = {
    id: 'a'.repeat(22),
    class: '1M2',
    group: '',
    subject: 'Maths',
    room: 'R1',
    day: 1,
    start: 600,
    end: 660,
    week: 'both',
  };
  const change = { kind: 'moved', before, after: { ...before, start: 540, end: 600 } } as const;
  const standing = teacherLine(t, 'Sunday', [change]);
  const once = teacherLine(t, 'Sunday', [change], true);
  expect(standing.startsWith(en.ttVersion.teacherLine.split('{{day}}')[0])).toBe(true);
  expect(once.startsWith(en.ttVersion.onceLine.split('{{day}}')[0])).toBe(true);
  expect(once).toContain('09:00');
});

test('hours read as whole hours and minutes, each with its plural', () => {
  const [english, arabic] = [i18n.getFixedT('en'), i18n.getFixedT('ar')];
  expect([hoursText(english, 17.5), hoursText(english, 1), hoursText(english, 0.75)]).toEqual([
    '17 hours 30 minutes',
    '1 hour',
    '45 minutes',
  ]);
  expect(hoursText(arabic, 2)).toBe(ar.count.hours_two);
});

test('a session of week A or B names its week', () => {
  const t = i18n.getFixedT('en');
  const one = { class: '1M2', group: '', subject: 'Maths', room: '', day: 0, start: 480, end: 540 } as const;
  expect(slotText(t, { ...one, week: 'A' })).toContain(en.week.weekA);
  expect(slotText(t, { ...one, week: 'both' })).not.toContain(en.week.weekA);
});
