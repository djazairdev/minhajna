// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where what is left goes on, in words (#33, Sheet, Sheet-nostage): the day,
// the guided-work session for a TD item, and the session of another kind it
// passes over, in the three languages. Made-up sessions only.

import { parseDay, type Session } from '@minhajna/core';
import { openTestData } from '../jest/app-data';
import { i18n } from '../src/text/i18n';
import { carryWords, shortDay } from '../src/today/outcome-rules';

const t = i18n.t.bind(i18n);

const session = (day: string, sessionType: string): Session => ({
  key: `c-1/${day}/m1/k-1-w`,
  courseId: 'c-1',
  classId: 'k-1',
  groupId: 'k-1-w',
  day: parseDay(day),
  slot: { half: 'morning', index: 1 },
  sessionType,
  calendar: null,
  calendarEntry: null,
  scheduled: true,
});

afterEach(async () => {
  await i18n.changeLanguage('ar');
});

test('names the day, and the session of another kind passed over', async () => {
  const { profile } = await openTestData();
  expect(shortDay(t, parseDay('2026-11-09'))).toBe('الإثنين 09/11');
  expect(
    carryWords(t, profile, 'ar', { next: session('2026-11-09', 'lesson'), passed: session('2026-11-08', 'test') }),
  ).toEqual({ day: 'الإثنين 09/11', at: 'حصة الإثنين 09/11', not: '، لا في فرض الأحد 08/11' });
  expect(carryWords(t, profile, 'ar', { next: session('2026-10-11', 'td'), passed: null })).toEqual({
    day: 'الأحد 11/10',
    at: 'حصة الأحد 11/10 للأعمال الموجهة',
    not: '',
  });
  expect(carryWords(t, profile, 'ar', { next: null, passed: null })).toBeNull();
});

test('lowers the session type in French and English', async () => {
  const { profile } = await openTestData();
  const carry = { next: session('2026-11-09', 'lesson'), passed: session('2026-11-08', 'test') };
  await i18n.changeLanguage('en');
  expect(carryWords(t, profile, 'en', carry)?.not).toBe(`, not in the test on ${t('week.days.0')} 08/11`);
  await i18n.changeLanguage('fr');
  expect(carryWords(t, profile, 'fr', carry)?.not).toBe(`, et non à la séance du ${t('week.days.0')} 08/11 (devoir)`);
});
