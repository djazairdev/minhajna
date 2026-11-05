// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// E-Release's automated checks (#614, answer 768), read from the core's. The
// history is every release of the pack this world and the app hold, published
// once, never the draft. Each check is a line, with the items at fault. A line
// that fails or could not run holds the release back, but for the two the
// reader judges: the budget's, advisory as R-4.3-13 reports it to the IGP, and
// a number skipped within a year, which the comparison reports beside the rest
// (answer 742). The budget check needs a grid no bundled data holds, so the
// reviewer types its figures and where they come from; the sessions are laid
// on the working days, first period on, as a timetable's order doesn't change
// what a year can give. Hours and a horizon stay on the screen, not the record:
// each reviewer runs them for themselves.

import {
  checkBudgetPack,
  checkPackReleaseReview,
  compareReleases,
  extractionArtefacts,
  packReleaseKey,
  type BudgetPackGrid,
  type CountryProfile,
  type PackRelease,
  type PackReleaseComparison,
  type PlanPack,
} from '@minhajna/core';
import { termReference, type TermReference } from '../director/seeded-fill';

export const LINES = ['source', 'extraction', 'comparison', 'weeks', 'budget'] as const;
export type LineId = (typeof LINES)[number];
export type LineState = 'pass' | 'fail' | 'advisory' | 'not-checked';

export interface ReviewLine {
  readonly id: LineId;
  readonly state: LineState;
  /** The items at fault; a budget overrun lists the items it covers. */
  readonly items: readonly string[];
}

export interface BudgetFigures {
  readonly main: string;
  readonly td: string;
  readonly minutes: string;
  readonly source: string;
}

export interface ReleaseReview {
  readonly lines: readonly ReviewLine[];
  readonly comparison: PackReleaseComparison;
  /** The lines that hold the release back. */
  readonly blockers: number;
}

const SESSIONS_MOST = 60;

/**
 * Every release of the pack published once, in this world or with the app, but
 * the draft; for a release published itself, the ones before it alone, as a
 * later one says nothing of it.
 */
export function releaseHistory(
  draft: PlanPack,
  bundled: readonly PlanPack[],
  records: ReadonlyMap<string, PackRelease>,
  published = false,
): PlanPack[] {
  const all = new Map(bundled.map((pack) => [packReleaseKey(pack.id, pack.release), pack]));
  for (const [key, one] of records)
    if (one.stage === 'published' || one.stage === 'superseded' || one.stage === 'withdrawn') all.set(key, one.pack);
  return [...all.values()].filter(
    (pack) =>
      pack.id === draft.id &&
      pack.release !== draft.release &&
      (!published || compareReleases(pack.release, draft.release) < 0),
  );
}

/** A whole number of at least `least` a field holds; null otherwise. */
function whole(text: string, least: number) {
  const value = /^[0-9]{1,4}$/.test(text.trim()) ? Number(text.trim()) : null;
  return value !== null && value >= least ? value : null;
}

/** The grid the figures make, or null until they are complete. */
export function reviewGrid(country: CountryProfile, figures: BudgetFigures): BudgetPackGrid | null {
  const main = whole(figures.main, 0);
  const td = whole(figures.td, 0);
  const minutes = whole(figures.minutes, 1);
  const source = figures.source.trim();
  if (main === null || td === null || minutes === null || source === '' || main + td > SESSIONS_MOST) return null;
  const type = (queue: string) => country.sessionTypes.find((one) => one.queue === queue)?.code;
  const [lesson, practice] = [type('main'), type('td')];
  if (lesson === undefined || (td > 0 && practice === undefined)) return null;
  const days = country.workingDays;
  const sessions = Array.from({ length: main + td }, (_, index) => ({
    weekday: days[index % days.length],
    slot: { half: 'morning' as const, index: Math.floor(index / days.length) + 1 },
    weeks: 'every' as const,
    sessionType: index < main ? lesson : practice!,
  }));
  return { source, sessionMinutes: minutes, sessions };
}

function budgetLine(pack: PlanPack, reference: TermReference, figures: BudgetFigures): ReviewLine | null {
  try {
    const ref = termReference(reference);
    const grid = reviewGrid(reference.profile, figures);
    const check = checkBudgetPack(pack, ref, { from: ref.year.from, to: ref.year.to, grid });
    if (check.status === 'not-applicable') return null;
    if (check.status === 'not-checked') return { id: 'budget', state: 'not-checked', items: [] };
    const skipped = check.skippedTargets.map((one) => one.item);
    const items = [...new Set([...check.findings.flatMap((one) => one.items), ...skipped])];
    return { id: 'budget', state: items.length > 0 ? 'advisory' : 'pass', items };
  } catch {
    return { id: 'budget', state: 'not-checked', items: [] };
  }
}

/** The checks on a release, with what the reviewer typed. */
export function reviewRelease(
  draft: PlanPack,
  history: readonly PlanPack[],
  reference: TermReference,
  weeks: string,
  figures: BudgetFigures,
): ReleaseReview {
  const horizon = weeks.trim() === '' ? null : (whole(weeks, 1) ?? Number.NaN);
  const checks = checkPackReleaseReview(draft, history, horizon);
  const { source, comparison } = checks;
  const week = checks.weeks;
  const held = (findings: readonly { items: readonly string[] }[]) => findings.flatMap((one) => one.items);
  const compared = comparison.status === 'checked' ? comparison.findings : [];
  const artefacts = extractionArtefacts(draft);
  const lines: (ReviewLine | null)[] = [
    source.status === 'checked'
      ? { id: 'source', state: source.findings.length > 0 ? 'fail' : 'pass', items: held(source.findings) }
      : { id: 'source', state: 'not-checked', items: [] },
    { id: 'extraction', state: artefacts.length > 0 ? 'fail' : 'pass', items: artefacts },
    comparison.status === 'checked'
      ? {
          id: 'comparison',
          state: compared.length === 0 ? 'pass' : comparison.previous === null ? 'fail' : 'advisory',
          items: held(compared),
        }
      : { id: 'comparison', state: 'not-checked', items: [] },
    week.status === 'not-applicable'
      ? null
      : week.status === 'checked'
        ? {
            id: 'weeks',
            state: week.findings.length > 0 ? 'fail' : 'pass',
            items: week.findings.flatMap((one) =>
              one.kind === 'missing-weeks' ? [`${one.week}-${one.through}`] : one.items,
            ),
          }
        : { id: 'weeks', state: 'not-checked', items: [] },
    budgetLine(draft, reference, figures),
  ];
  const shown = lines.filter((one) => one !== null);
  const blockers = shown.filter((one) => one.id !== 'budget' && (one.state === 'fail' || one.state === 'not-checked'));
  return { lines: shown, comparison, blockers: blockers.length };
}
