// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Budget-pack release checks (#610, R-4.3-13). The session engine counts
// a supplied reference grid within the source's explicit horizon, never a
// teacher's progress. Main and TD budgets stay apart. Known term targets
// are checked cumulatively before the first applicable exam, or the term's
// sourced end, as pacing.ts does, as well as against the whole horizon.
// A plan that does not fit yields advisory findings for the source issuer;
// it is not an invalid file or a teacher failing. Missing grid data is an
// explicit not-checked result. Budgets follow the engine's session rounding,
// with buffers and optional items included until a teacher decides otherwise.
// A hybrid pack's week target reads as the plan's does (answer 390): the last
// main item marked with the week, a checkpoint on the items up to it, buffers
// aside. A target outside the horizon or the calendar is listed as skipped.
// Findings and counts carry codes and IDs only; the editor supplies words.

import { budgetPackContext, type BudgetPackScope } from './budget-pack-grid.ts';
import { courseSetup } from './choices.ts';
import { addDays, minDay, type Day } from './day.ts';
import { budgetInSessions, queueItems, type PlanPack } from './pack.ts';
import { packItemTerm, queueOf, termExamParts } from './pacing.ts';
import type { Reference } from './reference.ts';
import { halfTurns, rotationCredits } from './rotation-sessions.ts';
import { sessionsBetween } from './sessions.ts';

export type { BudgetPackGrid, BudgetPackScope } from './budget-pack-grid.ts';

export interface BudgetPackFinding {
  readonly kind: 'budget-overrun';
  readonly severity: 'advisory';
  readonly queue: 'main' | 'td';
  readonly term: number | null;
  readonly week?: number;
  readonly from: Day;
  readonly to: Day;
  readonly needs: number;
  readonly gives: number;
  readonly shortfall: number;
  readonly items: readonly string[];
}

export interface BudgetPackPeriod {
  readonly term: number | null;
  readonly week?: number;
  readonly from: Day;
  readonly to: Day;
  readonly main: { readonly needs: number; readonly gives: number };
  readonly td: { readonly needs: number; readonly gives: number };
}

export type BudgetPackCheck =
  | { readonly status: 'not-applicable' }
  | { readonly status: 'not-checked'; readonly reason: 'missing-grid' }
  | {
      readonly status: 'checked';
      readonly source: string;
      readonly periods: readonly BudgetPackPeriod[];
      /** A hybrid pack's targets that no period checks, by week, each with its item. */
      readonly skippedTargets: readonly { readonly week: number; readonly item: string }[];
      readonly findings: readonly BudgetPackFinding[];
    };

/** Checks cumulative source budgets against the supplied reference grid. */
export function checkBudgetPack(pack: PlanPack, ref: Reference, scope: BudgetPackScope): BudgetPackCheck {
  if (pack.anchor.kind === 'weeks') return { status: 'not-applicable' };
  const grid = scope.grid;
  if (grid === null) return { status: 'not-checked', reason: 'missing-grid' };
  const { context, courseId, school } = budgetPackContext(pack, ref, scope, grid);
  const periods: BudgetPackPeriod[] = [];
  const findings: BudgetPackFinding[] = [];
  const setup = courseSetup(context, courseId);
  const turns = halfTurns(context);
  const limits: { term: number | null; week?: number; to: Day }[] = [];
  const planned = [...queueItems(pack, 'main'), ...queueItems(pack, 'td')];
  for (const term of ref.year.terms) {
    if (!planned.some((item) => packItemTerm(pack, item) === term.number) || term.from > scope.to) continue;
    const exam = termExamParts(context, setup, term.number)[0];
    if (exam === undefined ? term.to < scope.from : exam.from < scope.from) continue;
    const to = minDay(scope.to, exam === undefined ? term.to : addDays(exam.from, -1));
    limits.push({ term: term.number, to });
  }
  const pending = new Map<number, string>();
  if (pack.anchor.kind === 'hybrid') {
    for (const item of queueItems(pack, 'main')) if (item.week !== undefined) pending.set(item.week, item.id);
    for (const { number, start } of context.calendar.teachingWeeks(school)) {
      const to = addDays(start, 6);
      if (pending.has(number) && to >= scope.from && start <= scope.to) {
        limits.push({ term: null, week: number, to: minDay(scope.to, to) });
        pending.delete(number);
      }
    }
  }
  limits.push({ term: null, to: scope.to });
  const available = sessionsBetween(context, scope.from, scope.to, new Set([courseId])).filter(
    (session) => session.calendar === null,
  );
  for (const limit of limits) {
    const { to, term, week } = limit;
    const period = { term, ...(week === undefined ? {} : { week }), from: scope.from, to };
    const metrics = (queue: 'main' | 'td') => {
      const ordered = queueItems(pack, queue);
      let items = ordered;
      if (week !== undefined && queue === 'td') {
        items = [];
      } else if (week !== undefined) {
        const count = ordered.reduce((last, item, index) => (item.week === week ? index + 1 : last), 0);
        items = ordered.slice(0, count).filter((item) => !item.buffer);
      } else if (term !== null) {
        items = ordered.filter((item) => {
          const deadline = packItemTerm(pack, item);
          return deadline !== undefined && deadline <= term;
        });
      }
      const gives = rotationCredits(
        available.filter((session) => session.day <= to && queueOf(context, session) === queue),
        queue === 'main' ? turns : undefined,
      );
      let needs = 0;
      const overflow: string[] = [];
      for (const item of items) {
        needs += budgetInSessions(pack, item, grid.sessionMinutes);
        if (needs > gives) overflow.push(item.id);
      }
      if (needs > gives)
        findings.push({
          kind: 'budget-overrun',
          severity: 'advisory',
          queue,
          ...period,
          needs,
          gives,
          shortfall: needs - gives,
          items: overflow,
        });
      return { needs, gives };
    };
    periods.push({ ...period, main: metrics('main'), td: metrics('td') });
  }
  return {
    status: 'checked',
    source: grid.source,
    periods,
    skippedTargets: [...pending].sort(([a], [b]) => a - b).map(([week, item]) => ({ week, item })),
    findings,
  };
}
