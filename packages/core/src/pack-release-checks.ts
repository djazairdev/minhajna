// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Automated source and comparison checks for E-Release (#614, PRD §4.3).
// A failed read leaves its check incomplete. Only a confirmed empty
// history can establish a first release. The source must provide the
// week horizon so the last keyed item cannot hide a missing final week.

import { compareReleases } from './pack-catalogue.ts';
import { checkWeekPack, type WeekPackCheck } from './pack-checks.ts';
import { releaseChain, type MigrationEntry, type ReleaseChain } from './pack-migration.ts';
import { parsePlanPack, type PlanPack } from './pack.ts';
import type { ParseProblem } from './read.ts';
import { releaseChanges, type ReleaseChange } from './release-changes.ts';

type MigrationFailure = Extract<ReleaseChain, { ok: false }>;

export type PackReleaseSourceFinding =
  | { readonly kind: 'invalid-pack'; readonly problems: readonly ParseProblem[] }
  | { readonly kind: 'missing-source-page' | 'invalid-source-page'; readonly items: readonly string[] };

export type PackReleaseComparison =
  | { readonly status: 'not-checked'; readonly reason: 'invalid-pack' | 'missing-history' }
  | { readonly status: 'first-release' }
  | { readonly status: 'invalid-migration'; readonly problem: MigrationFailure['problem']; readonly release: string }
  | {
      readonly status: 'compared';
      readonly previous: PlanPack;
      readonly migrations: readonly MigrationEntry[];
      readonly changes: readonly ReleaseChange[];
    };

export interface PackReleaseReviewChecks {
  readonly source: readonly PackReleaseSourceFinding[];
  readonly comparison: PackReleaseComparison;
  readonly weeks:
    | WeekPackCheck
    | { readonly status: 'not-checked'; readonly reason: 'invalid-pack' | 'missing-horizon' | 'invalid-horizon' };
}

function invalidMigration(failure: MigrationFailure): PackReleaseComparison {
  return { status: 'invalid-migration', problem: failure.problem, release: failure.release };
}

function comparePrevious(pack: PlanPack, history: readonly PlanPack[] | null): PackReleaseComparison {
  if (history === null) return { status: 'not-checked', reason: 'missing-history' };
  const earlier = history
    .filter((release) => release.id === pack.id && compareReleases(release.release, pack.release) < 0)
    .sort((a, b) => compareReleases(a.release, b.release));
  const oldest = earlier[0];
  const previous = earlier.at(-1);
  if (oldest === undefined || previous === undefined) {
    return pack.migration === undefined
      ? { status: 'first-release' }
      : { status: 'invalid-migration', problem: 'missing', release: pack.migration.from };
  }

  const step = releaseChain(earlier, pack, previous.release);
  if (!step.ok) return invalidMigration(step);
  const start = oldest.migration?.from ?? oldest.release;
  if (start !== previous.release) {
    const chain = releaseChain(earlier, pack, start);
    if (!chain.ok) return invalidMigration(chain);
  }
  return {
    status: 'compared',
    previous,
    migrations: pack.migration?.entries ?? [],
    changes: releaseChanges(previous, pack, step.steps),
  };
}

function sourcePages(pack: PlanPack): PackReleaseSourceFinding[] {
  const findings: PackReleaseSourceFinding[] = [];
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
 * Pass null when history is unavailable and [] when there are no earlier
 * releases. This result records neither human review nor publication approval.
 */
export function checkPackReleaseReview(
  input: unknown,
  history: readonly PlanPack[] | null,
  weekHorizon: number | null,
): PackReleaseReviewChecks {
  const read = parsePlanPack(input);
  if (!read.ok)
    return {
      source: [{ kind: 'invalid-pack', problems: read.problems }],
      comparison: { status: 'not-checked', reason: 'invalid-pack' },
      weeks: { status: 'not-checked', reason: 'invalid-pack' },
    };

  return {
    source: sourcePages(read.value),
    comparison: comparePrevious(read.value, history),
    weeks: checkWeeks(read.value, weekHorizon),
  };
}
