// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class whose Tuesday TD halves take a main-plan lesson in turn, for the
// half-group tests (#231, answer 387). Made-up classes only.

import type { RecordEvent } from '../src/index.ts';
import { cemEvents } from './fixtures.ts';

/**
 * The class's Tuesday TD, taken by each half in turn, made a lesson; `only` keeps the first half alone, and `apart`
 * gives each half its own activity.
 */
export function labEvents(only = false, apart = false): RecordEvent[] {
  return cemEvents().map((event) =>
    event.kind === 'timetable.set'
      ? {
          ...event,
          version: {
            ...event.version,
            entries: event.version.entries
              .filter((entry) => !only || entry.id !== 'e-tue-2')
              .map((entry) =>
                entry.id.startsWith('e-tue')
                  ? { ...entry, sessionType: 'lesson', ...(apart && { activity: entry.id.endsWith('1') ? 'a' : 'b' }) }
                  : entry,
              ),
          },
        }
      : event,
  );
}
