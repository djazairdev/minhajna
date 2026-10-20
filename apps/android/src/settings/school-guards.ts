// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { State } from '@minhajna/core';

/** Existing classes keep their school's levels and subjects; changing assignments is not deleting setup data. */
export function protectedChoices(
  state: State,
  schoolId: string,
  key: 'levels' | 'subjects',
  chosen: readonly string[],
): readonly string[] {
  const classes = [...state.classes.values()].filter((schoolClass) => schoolClass.schoolId === schoolId);
  const ids = new Set(classes.map((schoolClass) => schoolClass.id));
  const used =
    key === 'levels'
      ? classes.map((schoolClass) => schoolClass.level)
      : [...state.courses.values()].filter((course) => ids.has(course.classId)).map((course) => course.subject);
  return [...new Set([...chosen, ...used])];
}
