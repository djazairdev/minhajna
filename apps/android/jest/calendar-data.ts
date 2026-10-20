// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay, type CalendarEntry, type RecordEvent } from '@minhajna/core';
import type { TestData } from './app-data';
import { settingsData } from './settings-data';

/** Synthetic calendar entries only, never a real school notice. */
export function calendarEntry(id: string, fields: Partial<CalendarEntry> = {}): CalendarEntry {
  return {
    id,
    layer: 'national',
    from: parseDay('2026-10-15'),
    to: parseDay('2026-10-15'),
    effect: 'marker',
    name: { ar: `موعد تجريبي ${id}`, fr: `Date fictive ${id}`, en: `Made-up entry ${id}` },
    source: `مصدر تجريبي ${id}`,
    confidence: 'announced',
    ...fields,
  };
}

/** Two made-up schools in different wilayas, plus all four calendar layers and a removed entry. */
export async function calendarData(): Promise<TestData> {
  const data = await settingsData();
  const own = [
    calendarEntry('school-1', { layer: 'school', schoolId: 's-1', effect: 'closure' }),
    calendarEntry('school-2', { layer: 'school', schoolId: 's-2', effect: 'closure' }),
    calendarEntry('private', { layer: 'teacher', effect: 'closure' }),
    calendarEntry('same-id', { layer: 'school', schoolId: 's-1' }),
    calendarEntry('removed', { layer: 'school', schoolId: 's-1' }),
  ];
  const school = data.book.state.schools.get('s-2')!;
  await data.book.recordAll(parseDay('2026-10-15'), [
    { kind: 'school.set', school: { ...school, zone: '31' } },
    ...own.map((entry): RecordEvent => ({ kind: 'calendar.set', entry })),
    { kind: 'calendar.removed', id: 'removed', layer: 'school' },
  ]);
  return {
    ...data,
    calendar: [
      calendarEntry('same-id', { confidence: 'projected' }),
      calendarEntry('span', { from: parseDay('2026-10-30'), to: parseDay('2026-11-02'), confidence: 'expected' }),
      calendarEntry('zone-16', { layer: 'zone', zone: '16' }),
      calendarEntry('zone-31', { layer: 'zone', zone: '31' }),
      calendarEntry('cem', { grades: ['4am'], confidence: 'expected' }),
      calendarEntry('primary', { levels: ['primary'], grades: ['5ap'] }),
      calendarEntry('lycee', { levels: ['lycee'] }),
    ],
  };
}
