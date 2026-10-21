// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class council (#224, Today-council, answer 334): a school's marker for
// one class, a term and a time, on one day. It takes no sessions; once the
// teacher says it was held, the journal's seminars page writes it.

import { CLOCK } from './bells.ts';
import type { Context } from './context.ts';
import type { CalendarEntry } from './reference.ts';

/** Validate a council the teacher entered; it is the teacher's note, not the school's notice. */
export function checkCouncil(context: Context, entry: CalendarEntry): void {
  const council = entry.council;
  const schoolClass = council && context.state.classes.get(council.classId);
  if (
    council === undefined ||
    schoolClass === undefined ||
    entry.layer !== 'school' ||
    entry.effect !== 'marker' ||
    schoolClass.schoolId !== entry.schoolId ||
    entry.from !== entry.to ||
    !context.ref.year.terms.some((term) => term.number === council.term) ||
    typeof council.at !== 'string' ||
    !CLOCK.test(council.at) ||
    (council.held !== undefined && council.held !== true) ||
    entry.half !== undefined ||
    entry.levels !== undefined ||
    entry.grades !== undefined ||
    entry.adds !== undefined ||
    entry.follows !== undefined ||
    entry.takes !== undefined ||
    entry.replaces !== undefined
  )
    throw new RangeError('A council needs one class, a term and a time on one day');
}
