// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up reference allocation and two teaching weeks for #610. These
// are source data, never an official hours grid or a teacher's timetable.

import {
  parsePlanPack,
  type BudgetPackGrid,
  type BudgetPackScope,
  type CalendarEntry,
  type PackItem,
  type Reference,
} from '../src/index.ts';
import { d, mathPackSource, reference } from './fixtures.ts';

export const grid: BudgetPackGrid = {
  source: 'Made-up source grid',
  sessionMinutes: 60,
  sessions: [
    { weekday: 0, slot: { half: 'morning', index: 1 }, weeks: 'every', sessionType: 'lesson' },
    { weekday: 1, slot: { half: 'morning', index: 1 }, weeks: 'every', sessionType: 'lesson' },
    { weekday: 2, slot: { half: 'morning', index: 1 }, weeks: 'every', sessionType: 'td' },
  ],
};

export const scope: BudgetPackScope = { from: d('2026-09-20'), to: d('2026-10-01'), grid };

export const ref: Reference = {
  ...reference,
  calendar: [],
  year: { ...reference.year, from: scope.from, to: scope.to, terms: [{ number: 1, from: scope.from, to: scope.to }] },
};

export function source(
  items: readonly PackItem[] = [
    { id: 'l1', kind: 'lesson', title: 'Made-up lesson 1', budget: 2 },
    { id: 'l2', kind: 'lesson', title: 'Made-up lesson 2', budget: 2 },
    { id: 'td1', kind: 'td', title: 'Made-up TD', budget: 2 },
  ],
  unit: 'hours' | 'sessions' = 'hours',
) {
  const read = parsePlanPack({ ...mathPackSource, anchor: { kind: 'budgets', unit }, items, merges: [] });
  if (!read.ok) throw new Error('Invalid made-up source pack');
  return read.value;
}

export function calendar(fields: Partial<CalendarEntry> = {}): CalendarEntry {
  return {
    id: 'source-closure',
    layer: 'national',
    from: scope.from,
    to: scope.from,
    effect: 'closure',
    name: { en: 'Made-up closure' },
    source: 'Made up',
    confidence: 'announced',
    ...fields,
  };
}
