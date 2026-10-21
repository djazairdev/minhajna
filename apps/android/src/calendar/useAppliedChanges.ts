// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What an applied calendar update changed (R-4.5-15): its changes, and the
// sessions it still takes or gives back from today on (answer 314),
// measured against the calendar without it, from the bundled calendar and
// the other updates; nothing for a release the bundled calendar now holds.

import {
  appliedUpdates,
  teacherChanges,
  updateImpact,
  type AppliedUpdate,
  type CalendarImpact,
  type UpdateChange,
} from '@minhajna/core';
import { useMemo } from 'react';
import { coreContext, contextWithout } from '../storage/core-context';
import type { AppData } from '../storage/AppData';

export interface AppliedChanges {
  readonly applied: AppliedUpdate;
  /** Whether it still lies over the calendar; when the bundled calendar holds it, the rest is empty. */
  readonly laid: boolean;
  readonly mine: readonly UpdateChange[];
  readonly others: number;
  readonly impact: CalendarImpact;
}

/** The changes of one applied release, or null when none was applied. */
export function appliedChanges(data: AppData, release: string): AppliedChanges | null {
  const applied = data.state.calendarUpdates.find((one) => one.update.release === release);
  if (applied === undefined) return null;
  const today = data.today();
  if (!appliedUpdates(coreContext(data)).some((one) => one.update.release === release))
    return {
      applied,
      laid: false,
      mine: [],
      others: 0,
      impact: { asOf: today, changes: [], recorded: 0, courses: [] },
    };
  const before = contextWithout(data, release);
  const { mine, others } = teacherChanges(before, applied.update);
  return { applied, laid: true, mine, others, impact: updateImpact(before, applied.update, today, true) };
}

export function useAppliedChanges(data: AppData, release: string | null): AppliedChanges | null {
  return useMemo(() => (release === null ? null : appliedChanges(data, release)), [data, release]);
}
