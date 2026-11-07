// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading the week (#28): a slot of the grid, and each class's sessions a
// week under it. The teacher no longer draws the week (answer 808): the
// timetable arrives from the school.

import type { SchoolClass, Slot, TimetableVersion, Weekday } from '@minhajna/core';

export type Cell = { readonly weekday: Weekday; readonly slot: Slot };

/** The class a course belongs to. */
export type ClassOf = (courseId: string) => SchoolClass | undefined;

/** Each class's sessions in a week, in the order of the classes, and their total. */
export function classLoads(version: TimetableVersion, classOf: ClassOf, classes: readonly SchoolClass[]) {
  const counts = new Map<string, number>();
  for (const entry of version.entries) {
    const classId = classOf(entry.courseId)?.id;
    if (classId !== undefined) counts.set(classId, (counts.get(classId) ?? 0) + (entry.weeks === 'every' ? 1 : 0.5));
  }
  const loads = classes.flatMap((schoolClass) => {
    const count = counts.get(schoolClass.id);
    return count === undefined ? [] : [{ name: schoolClass.name, count }];
  });
  return { loads, total: loads.reduce((sum, load) => sum + load.count, 0) };
}
