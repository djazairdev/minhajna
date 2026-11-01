// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Week-pack release checks (#609, R-4.3-12). The curator supplies the source
// plan's horizon: the last item alone cannot reveal a missing final week.
// A finding names its week and contributing item IDs; an absent week or
// activity has no invented item ID. Consecutive gaps are ranges, so even a
// mistyped, very large horizon never allocates or visits every missing week.
// The model's sessions are checked exactly, using the engine's week-budget
// rules; the minute argument is immaterial for weeks. Unit headings and TD
// belong outside the main weekly model. A missing model is a finding, not a
// new import restriction: older files remain readable. These checks read no
// class progress, change no pack and carry no translated interface wording.
// Missing ranges include both week and through. An empty items list means
// the source contains no matching item; missing-model is a pack-level finding.
// checkWeekPack accepts a parsed pack and a positive safe whole-week horizon;
// other anchors have no findings here, and an invalid horizon throws.

import { budgetInSessions, queueItems, type PackActivity, type PackItem, type PlanPack } from './pack.ts';

export type WeekPackFinding =
  | { readonly kind: 'missing-model'; readonly week: null; readonly items: readonly string[] }
  | {
      readonly kind: 'missing-weeks';
      readonly week: number;
      readonly through: number;
      readonly items: readonly string[];
    }
  | {
      readonly kind: 'outside-horizon' | 'missing-activity';
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

function activityFindings(
  pack: PlanPack,
  week: number,
  items: readonly PackItem[],
  model: readonly PackActivity[],
): WeekPackFinding[] {
  const findings: WeekPackFinding[] = [];
  const missing = items.filter((item) => item.activity === undefined).map((item) => item.id);
  if (missing.length > 0) findings.push({ kind: 'missing-activity', week, items: missing });
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

export function checkWeekPack(pack: PlanPack, weeks: number): readonly WeekPackFinding[] {
  if (!Number.isSafeInteger(weeks) || weeks < 1) throw new RangeError('Invalid plan horizon');
  if (pack.anchor.kind !== 'weeks') return [];
  const main = queueItems(pack, 'main');
  const held = new Map<number, PackItem[]>();
  for (const item of main) {
    const week = item.week!;
    const items = held.get(week) ?? [];
    items.push(item);
    held.set(week, items);
  }
  const findings: WeekPackFinding[] = [];
  const model = pack.activities;
  if (model === undefined) findings.push({ kind: 'missing-model', week: null, items: main.map((item) => item.id) });
  let next = 1;
  for (const [week, items] of [...held].sort(([a], [b]) => a - b)) {
    if (week > next && next <= weeks)
      findings.push({ kind: 'missing-weeks', week: next, through: Math.min(week - 1, weeks), items: [] });
    if (week > weeks) findings.push({ kind: 'outside-horizon', week, items: items.map((item) => item.id) });
    if (model !== undefined) findings.push(...activityFindings(pack, week, items, model));
    next = week + 1;
  }
  if (next <= weeks) findings.push({ kind: 'missing-weeks', week: next, through: weeks, items: [] });
  return findings;
}
