// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Automated source and comparison checks for E-Release (#614, PRD §4.3). A
// failed read leaves its check incomplete. Only a history with no release of
// the pack can establish a first release, and a draft must come after every
// release it holds, with no number skipped within a year. The source must
// provide the week horizon so the last keyed item cannot hide a missing final
// week. Each check has the result shape of checkWeekPack and checkBudgetPack:
// not-checked with its reason, or checked with findings that name their items.
// A comparison lists every other field a kept item or the pack changed, which
// the teachers' summary leaves out; an item merged from several is the
// summary's alone.

import { compareReleases } from './pack-catalogue.ts';
import { checkWeekPack, type WeekPackCheck } from './pack-checks.ts';
import {
  followId,
  misfits,
  releaseChain,
  type Migration,
  type MigrationEntry,
  type ReleaseChain,
} from './pack-migration.ts';
import { parsePlanPack, type PackItem, type PlanPack } from './pack.ts';
import type { ParseProblem } from './read.ts';
import { releaseChanges, type ReleaseChange } from './release-changes.ts';

type MigrationFailure = Extract<ReleaseChain, { ok: false }>;

/** A problem in the draft's source or its place in the release history. */
export type PackReleaseFinding =
  | { readonly kind: 'missing-source-page' | 'invalid-source-page'; readonly items: readonly string[] }
  | {
      readonly kind: 'invalid-migration';
      readonly problem: MigrationFailure['problem'];
      readonly release: string;
      /** The IDs at fault; none when a release is absent or a step skips one. */
      readonly items: readonly string[];
    };

/** The draft's own fields: its parse problems, or the items whose source page is missing or unusable. */
export type PackReleaseSourceCheck =
  | { readonly status: 'not-checked'; readonly reason: 'invalid-pack'; readonly problems: readonly ParseProblem[] }
  | { readonly status: 'checked'; readonly findings: readonly PackReleaseFinding[] };

/** What the teachers' summary leaves out: a kept item's other fields and the pack's own. */
export interface PackReleaseDetails {
  readonly pack: readonly string[];
  readonly items: readonly { readonly item: string; readonly fields: readonly string[] }[];
}

/** The draft against the release before it, for the human comparison (R-4.3-16). */
export type PackReleaseComparison =
  | { readonly status: 'not-checked'; readonly reason: 'invalid-pack' | 'missing-history' }
  | {
      readonly status: 'checked';
      /** Null for a first release, and when a finding stops the comparison. */
      readonly previous: PlanPack | null;
      readonly migrations: readonly MigrationEntry[];
      readonly changes: readonly ReleaseChange[];
      readonly details: PackReleaseDetails;
      readonly findings: readonly PackReleaseFinding[];
    };

/** The automated checks alone: budget capacity and extraction are checked apart, so this is no all-clear. */
export interface PackReleaseReviewChecks {
  readonly source: PackReleaseSourceCheck;
  readonly comparison: PackReleaseComparison;
  readonly weeks:
    | WeekPackCheck
    | { readonly status: 'not-checked'; readonly reason: 'invalid-pack' | 'missing-horizon' | 'invalid-horizon' };
}

const ITEM_FIELDS = [
  'kind',
  'term',
  'week',
  'budget',
  'activity',
  'optional',
  'buffer',
  'stages',
  'sourcePage',
] as const;
const PACK_FIELDS = [
  'status',
  'licence',
  'language',
  'anchor',
  'provenance',
  'stageTemplates',
  'merges',
  'activities',
  'staleReason',
] as const;

function stopped(findings: readonly PackReleaseFinding[]): PackReleaseComparison {
  return { status: 'checked', previous: null, migrations: [], changes: [], details: { pack: [], items: [] }, findings };
}

/** The IDs a failed step names: those misfit, and any an earlier release held and the one before it lacks. */
function faultyIds(failure: MigrationFailure, earlier: readonly PlanPack[], pack: PlanPack): string[] {
  const all = [...earlier, pack];
  const at = all.findIndex((one) => one.release === failure.release);
  const after = all[at];
  const before = after?.migration ? all.find((one) => one.release === after.migration?.from) : all[at - 1];
  if (failure.problem !== 'broken' || after === undefined || before === undefined) return [];
  const kept = new Set(before.items.map((item) => item.id));
  const seen = new Set(all.slice(0, at).flatMap((one) => one.items.map((item) => item.id)));
  const back = after.items.filter((item) => !kept.has(item.id) && seen.has(item.id)).map((item) => item.id);
  return [...new Set([...misfits({ entries: after.migration?.entries ?? [], before, after }), ...back])];
}

function findingsOf(failure: MigrationFailure, earlier: readonly PlanPack[], pack: PlanPack): PackReleaseFinding[] {
  const { problem, release } = failure;
  return [{ kind: 'invalid-migration', problem, release, items: faultyIds(failure, earlier, pack) }];
}

function detailsOf(previous: PlanPack, pack: PlanPack, steps: Migration): PackReleaseDetails {
  const byId = new Map(pack.items.map((item) => [item.id, item]));
  const followed = previous.items.flatMap((old): { old: PackItem; now: PackItem }[] => {
    const [id, ...more] = followId(steps, old.id);
    const now = id === undefined || more.length > 0 ? undefined : byId.get(id);
    return now === undefined ? [] : [{ old, now }];
  });
  const pairs = followed.filter(({ now }) => followed.filter((one) => one.now === now).length === 1);
  const items = pairs.flatMap(({ old, now }) => {
    const fields: string[] = ITEM_FIELDS.filter((field) => old[field] !== now[field]);
    if (old.unit !== now.unit && (old.unit === undefined || !followId(steps, old.unit).includes(now.unit ?? '')))
      fields.push('unit');
    return fields.length === 0 ? [] : [{ item: now.id, fields }];
  });
  const merges = previous.merges.map((merge) => merge.flatMap((id) => followId(steps, id)[0] ?? []));
  const before = { ...previous, merges };
  const fields: string[] = PACK_FIELDS.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(pack[field]));
  const order = (list: readonly PackItem[]) => list.map((item) => item.id);
  const kept = new Set(pairs.map(({ now }) => now.id));
  const moved =
    JSON.stringify(order(pairs.map(({ now }) => now))) !==
    JSON.stringify(order(pack.items.filter((one) => kept.has(one.id))));
  return { pack: moved ? [...fields, 'order'] : fields, items };
}

/** The first release an edition's numbers skip, as a fix within a year counts up by one; null without a gap. */
function firstSkipped(releases: readonly string[]): string | null {
  for (const [index, release] of releases.entries()) {
    const [year, fix = 0] = release.split('.').map(Number);
    const [nextYear, nextFix = 0] = (releases[index + 1] ?? release).split('.').map(Number);
    if (year === nextYear && nextFix > fix + 1) return `${year}.${fix + 1}`;
  }
  return null;
}

/** A failed step's findings beside the gaps it doesn't already name. */
function stoppedBy(
  failure: MigrationFailure,
  gaps: readonly PackReleaseFinding[],
  earlier: readonly PlanPack[],
  pack: PlanPack,
): PackReleaseComparison {
  const named = failure.problem === 'missing' ? failure.release : null;
  const kept = gaps.filter((gap) => gap.kind !== 'invalid-migration' || gap.release !== named);
  return stopped([...kept, ...findingsOf(failure, earlier, pack)]);
}

function comparePrevious(pack: PlanPack, history: readonly PlanPack[] | null): PackReleaseComparison {
  if (history === null) return { status: 'not-checked', reason: 'missing-history' };
  const earlier = history
    .filter((release) => release.id === pack.id)
    .sort((a, b) => compareReleases(a.release, b.release));
  const oldest = earlier[0];
  const previous = earlier.at(-1);
  if (previous !== undefined && compareReleases(previous.release, pack.release) >= 0) {
    return stopped([{ kind: 'invalid-migration', problem: 'not-newer', release: previous.release, items: [] }]);
  }
  if (oldest === undefined || previous === undefined) {
    if (pack.migration === undefined) return stopped([]);
    return stopped([{ kind: 'invalid-migration', problem: 'missing', release: pack.migration.from, items: [] }]);
  }

  const skipped = firstSkipped([...earlier.map((release) => release.release), pack.release]);
  const gaps: PackReleaseFinding[] =
    skipped === null ? [] : [{ kind: 'invalid-migration', problem: 'missing', release: skipped, items: [] }];
  const step = releaseChain(earlier, pack, previous.release);
  if (!step.ok) return stoppedBy(step, gaps, earlier, pack);
  const start = oldest.migration?.from ?? oldest.release;
  if (start !== previous.release) {
    const chain = releaseChain(earlier, pack, start);
    if (!chain.ok) return stoppedBy(chain, gaps, earlier, pack);
  }
  const reused = faultyIds({ ok: false, problem: 'broken', release: pack.release }, earlier, pack);
  if (reused.length > 0) {
    return stopped([...gaps, { kind: 'invalid-migration', problem: 'broken', release: pack.release, items: reused }]);
  }
  return {
    status: 'checked',
    previous,
    migrations: pack.migration?.entries ?? [],
    changes: releaseChanges(previous, pack, step.steps),
    details: detailsOf(previous, pack, step.steps),
    findings: gaps,
  };
}

function sourcePages(pack: PlanPack): PackReleaseFinding[] {
  const findings: PackReleaseFinding[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const item of pack.items) {
    if (item.sourcePage === undefined) missing.push(item.id);
    else if (!Number.isSafeInteger(item.sourcePage)) invalid.push(item.id);
  }
  if (missing.length > 0) findings.push({ kind: 'missing-source-page', items: missing });
  if (invalid.length > 0) findings.push({ kind: 'invalid-source-page', items: invalid });
  return findings;
}

function checkWeeks(pack: PlanPack, horizon: number | null): PackReleaseReviewChecks['weeks'] {
  if (pack.anchor.kind !== 'weeks') return { status: 'not-applicable' };
  if (horizon === null) return { status: 'not-checked', reason: 'missing-horizon' };
  if (!Number.isSafeInteger(horizon) || horizon < 1) return { status: 'not-checked', reason: 'invalid-horizon' };
  return checkWeekPack(pack, horizon);
}

/**
 * Prepares source findings, a release comparison and weekly findings for review.
 * Pass null when history is unavailable and [] when the pack has no releases.
 * History holds every published release, superseded or withdrawn too, never the
 * draft itself. This result records neither human review nor publication approval.
 */
export function checkPackReleaseReview(
  input: unknown,
  history: readonly PlanPack[] | null,
  weekHorizon: number | null,
): PackReleaseReviewChecks {
  const read = parsePlanPack(input);
  if (!read.ok)
    return {
      source: { status: 'not-checked', reason: 'invalid-pack', problems: read.problems },
      comparison: { status: 'not-checked', reason: 'invalid-pack' },
      weeks: { status: 'not-checked', reason: 'invalid-pack' },
    };

  return {
    source: { status: 'checked', findings: sourcePages(read.value) },
    comparison: comparePrevious(read.value, history),
    weeks: checkWeeks(read.value, weekHorizon),
  };
}
