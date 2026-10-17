// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today's cards (#43, P-Multi): a joint class's years share a slot, so their
// sessions make one card, in the years' order. Every other session has its
// own card.

import { classGrades, courseGrade, isJoint, slotKey, type State, type TodaySession } from '@minhajna/core';

export type TodayEntry =
  | { readonly kind: 'one'; readonly item: TodaySession }
  | { readonly kind: 'joint'; readonly key: string; readonly items: readonly TodaySession[] };

/** The day's sessions as cards, in order, a joint class's years together. */
export function todayEntries(state: State, items: readonly TodaySession[]): TodayEntry[] {
  const entries: (TodayEntry | { kind: 'joint'; key: string; items: TodaySession[] })[] = [];
  const joint = new Map<string, TodaySession[]>();
  for (const item of items) {
    const schoolClass = state.classes.get(item.course.classId);
    if (schoolClass === undefined || !isJoint(schoolClass)) {
      entries.push({ kind: 'one', item });
      continue;
    }
    const { day, slot, groupId } = item.session;
    const key = `${schoolClass.id}/${day}/${slotKey(slot)}/${groupId}`;
    const found = joint.get(key);
    if (found !== undefined) found.push(item);
    else {
      const group = [item];
      joint.set(key, group);
      entries.push({ kind: 'joint', key, items: group });
    }
  }
  return entries.map((entry): TodayEntry => {
    if (entry.kind === 'one') return entry;
    const [first] = entry.items;
    if (entry.items.length === 1 && first !== undefined) return { kind: 'one', item: first };
    const schoolClass = first && state.classes.get(first.course.classId);
    const grades = schoolClass === undefined ? [] : classGrades(schoolClass);
    const rank = (item: TodaySession) => (schoolClass ? grades.indexOf(courseGrade(item.course, schoolClass)) : 0);
    return { kind: 'joint', key: entry.key, items: [...entry.items].sort((a, b) => rank(a) - rank(b)) };
  });
}
