// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The days a move can be dated: today or the next working day first, then
// the working days of the two weeks before and after, for a move recorded
// late or ahead (PRD §3.2).

import { addDays, eachDay, weekday, type CountryProfile, type Day } from '@minhajna/core';

export function moveDays(profile: Pick<CountryProfile, 'workingDays'>, today: Day): { first: Day[]; all: Day[] } {
  const all = eachDay(addDays(today, -14), addDays(today, 14)).filter((day) =>
    profile.workingDays.includes(weekday(day)),
  );
  const first = all.filter((day) => day >= today).slice(0, 2);
  return { first, all };
}
