// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { School, State } from '@minhajna/core';

/**
 * The schools where the teacher may enter a cover: those with a middle or
 * secondary level, whose daily journal has a row for it. A primary journal
 * is the class teacher's own, one per class, with no place for a colleague's.
 */
export function coverSchools(state: State): School[] {
  return [...state.schools.values()].filter((school) => school.levels.some((level) => level !== 'primary'));
}
