// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { recordOf, type CourseSetup } from './choices.ts';
import type { Context } from './context.ts';
import type { Day } from './day.ts';
import { carriedId } from './pack-migration.ts';
import { Progress, proposedCoverage, type Proposal } from './progress.ts';
import type { Session } from './sessions.ts';
import { current } from './state.ts';

/** Completion belongs to the date the last required group finishes, never the first group's lesson. */
export function rotationProgress(
  context: Context,
  setup: CourseSetup,
  sessions: readonly Session[],
  proposals: ReadonlyMap<string, Proposal | null>,
  today: Day,
) {
  const actual = Progress.of(setup.schoolClass, setup.migration);
  const chain = Progress.of(setup.schoolClass, setup.migration);
  const completed = new Map<string, Day>();
  const projected = new Map<string, Day>();
  const groups = new Map<string, Set<string>>();
  const rotatingItems = new Set<string>();
  const whole = setup.schoolClass.groups.find((one) => one.kind === 'whole')!.id;
  for (const session of sessions) {
    const saved = current(context.state.sessions.get(session.key));
    const proposal = proposals.get(session.key);
    const record =
      saved ??
      (proposal == null
        ? null
        : recordOf(session, { outcome: 'done' }, proposedCoverage(proposal), {}, session.sessionType));
    if (record === null) continue;
    chain.apply(record);
    const recorded = saved !== null && session.day <= today;
    if (recorded) actual.apply(record);
    for (const coverage of record.coverage) {
      const id = carriedId(setup.migration, coverage.item);
      const item = setup.pack?.items.find((one) => one.id === id);
      if (item === undefined || setup.pack === null || coverage.op !== 'taught') continue;
      if (session.rotation !== undefined) rotatingItems.add(item.id);
      if (!projected.has(item.id) && chain.isFinished(setup.pack, item, whole)) projected.set(item.id, session.day);
      if (!recorded) continue;
      if (!completed.has(item.id) && actual.isFinished(setup.pack, item, whole)) completed.set(item.id, session.day);
      const taught = groups.get(item.id) ?? new Set<string>();
      if (session.groupId === whole)
        for (const group of setup.schoolClass.groups.filter((one) => one.kind === 'half')) taught.add(group.id);
      else taught.add(session.groupId);
      groups.set(item.id, taught);
    }
  }
  return { completed, projected, groups, rotatingItems };
}
