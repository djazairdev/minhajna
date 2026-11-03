// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Week-pack release checks (#609, R-4.3-12). The curator supplies the source
// plan's horizon: the last item alone cannot reveal a missing final week.
// A finding names its week and contributing item IDs; an absent week or
// activity has no invented item ID. Consecutive gaps are ranges, so even a
// mistyped, very large horizon never allocates or visits every missing week.
// Only a supplied model is checked. Unclassified items remain available
// for untyped slots, and a week reserved for assessment or remediation can
// have a different mix. The checks read no class progress or teacher data.

import { budgetInSessions, queueItems, type PackActivity, type PackItem, type PlanPack } from './pack.ts';

export type WeekPackFinding =
  | { readonly kind: 'invalid-week'; readonly week: null; readonly items: readonly string[] }
  | {
      readonly kind: 'missing-weeks';
      readonly week: number;
      readonly through: number;
      readonly items: readonly string[];
    }
  | {
      readonly kind: 'outside-horizon';
      readonly week: number;
      readonly items: readonly string[];
    }
  | {
      readonly kind: 'activity-sessions';
      readonly week: number;
      readonly activity: string;
      readonly expected: number;
      readonly actual: number;
      readonly items: readonly string[];
    };

/** Whether the weekly check applies, with source findings when it does. */
export type WeekPackCheck =
  { readonly status: 'not-applicable' } | { readonly status: 'checked'; readonly findings: readonly WeekPackFinding[] };

function activityFindings(
  pack: PlanPack,
  week: number,
  items: readonly PackItem[],
  model: readonly PackActivity[],
): WeekPackFinding[] {
  const findings: WeekPackFinding[] = [];
  for (const activity of model) {
    const held = items.filter((item) => item.activity === activity.code);
    const actual = held.reduce((sum, item) => sum + budgetInSessions(pack, item, 60), 0);
    if (actual !== activity.sessions)
      findings.push({
        kind: 'activity-sessions',
        week,
        activity: activity.code,
        expected: activity.sessions,
        actual,
        items: held.map((item) => item.id),
      });
  }
  return findings;
}

/** Checks source weeks against an explicit horizon and, where present, a weekly model. */
export function checkWeekPack(pack: PlanPack, weeks: number): WeekPackCheck {
  if (!Number.isSafeInteger(weeks) || weeks < 1) throw new RangeError('Invalid plan horizon');
  if (pack.anchor.kind !== 'weeks') return { status: 'not-applicable' };
  const main = queueItems(pack, 'main');
  const held = new Map<number, PackItem[]>();
  const invalid: string[] = [];
  for (const item of main) {
    const week = item.week;
    if (week === undefined || !Number.isSafeInteger(week) || week < 1) {
      invalid.push(item.id);
      continue;
    }
    const items = held.get(week) ?? [];
    items.push(item);
    held.set(week, items);
  }
  const findings: WeekPackFinding[] = [];
  const model = pack.activities;
  if (invalid.length > 0) findings.push({ kind: 'invalid-week', week: null, items: invalid });
  let next = 1;
  for (const [week, items] of [...held].sort(([a], [b]) => a - b)) {
    if (week > next && next <= weeks)
      findings.push({ kind: 'missing-weeks', week: next, through: Math.min(week - 1, weeks), items: [] });
    if (week > weeks) findings.push({ kind: 'outside-horizon', week, items: items.map((item) => item.id) });
    const regular = items.some((item) => !item.buffer && item.kind !== 'assessment-remediation');
    if (model !== undefined && regular) findings.push(...activityFindings(pack, week, items, model));
    next = week + 1;
  }
  if (next <= weeks) findings.push({ kind: 'missing-weeks', week: next, through: weeks, items: [] });
  return { status: 'checked', findings };
}
