// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { addDays, parseDay, weekday, type Day } from '@minhajna/core';

test('runs the shared core from its TypeScript source', () => {
  const day: Day = parseDay('2026-10-04');

  expect(weekday(day)).toBe(0);
  expect(addDays(day, 1)).toBe('2026-10-05');
});

test('keeps leap days when the app uses the shared calendar rules', () => {
  const leapDay = addDays(parseDay('2028-02-28'), 1);

  expect(leapDay).toBe('2028-02-29');
  expect(addDays(leapDay, 1)).toBe('2028-03-01');
});

test('refuses clock times in a record day', () => {
  expect(() => parseDay('2026-10-04T08:00:00Z')).toThrow(RangeError);
});
