// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { setCalendarEntry, type CalendarEntry } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

export const rotation: CalendarEntry = {
  id: 'rotation-example',
  layer: 'school',
  schoolId: 's-cem',
  from: d('2026-09-20'),
  to: d('2026-10-01'),
  effect: 'rotating-groups',
  rotation: { classId: 'k-1am2', groups: ['g-1', 'g-2'] },
  name: { en: 'Made-up rotation' },
  source: 'Made-up school notice',
  confidence: 'announced',
};

export async function rotatingBook() {
  const book = await openBook(cemEvents());
  await book.record(d('2026-09-19'), setCalendarEntry(contextOf(book), rotation));
  return book;
}
