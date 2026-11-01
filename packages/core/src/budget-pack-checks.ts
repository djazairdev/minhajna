// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Budget-pack release checks (#610, R-4.3-13). The calendar/session engine counts a
// supplied reference grid within the source's explicit horizon, never a
// teacher's progress. Main and TD budgets stay apart. Known term targets
// are checked cumulatively before the first applicable exam, or the term's
// sourced end, as pacing.ts does, as well as against the whole horizon.
// A plan that does not fit yields advisory findings for the source issuer;
// it is not an invalid file or a teacher failing. Missing grid data is an
// explicit not-checked result. Budgets follow the engine's session rounding,
// with buffers and optional items included until a teacher decides otherwise.
// Findings and counts carry codes and IDs only; the editor supplies words.

import { budgetPackContext, type BudgetPackScope } from './budget-pack-grid.ts';
import { addDays, compareDays, minDay, type Day } from './day.ts';
import { budgetInSessions, queueItems, type PackItem, type PlanPack } from './pack.ts';
import { findSessionType, type Reference } from './reference.ts';
import { sessionsBetween } from './sessions.ts';

export type { BudgetPackGrid, BudgetPackScope } from './budget-pack-grid.ts';

export interface BudgetPackFinding {
  readonly kind: 'budget-overrun';
  readonly severity: 'advisory';
  readonly queue: 'main' | 'td';
  readonly term: number | null;
  readonly from: Day;
  readonly to: Day;
  readonly needs: number;
  readonly gives: number;
  readonly shortfall: number;
  readonly items: readonly string[];
}

export interface BudgetPackPeriod {
  readonly term: number | null;
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
      readonly findings: readonly BudgetPackFinding[];
    };

function termOf(pack: PlanPack, item: PackItem): number | undefined {
  if (item.term !== undefined || item.kind !== 'td' || item.unit === undefined) return item.term;
  const terms = pack.items.flatMap((other) =>
    other.unit === item.unit && other.kind !== 'td' && other.term !== undefined ? [other.term] : [],
  );
  return terms.length === 0 ? undefined : Math.max(...terms);
}

export function checkBudgetPack(pack: PlanPack, ref: Reference, scope: BudgetPackScope): BudgetPackCheck {
  if (pack.anchor.kind === 'weeks') return { status: 'not-applicable' };
  const grid = scope.grid;
  if (grid === null) return { status: 'not-checked', reason: 'missing-grid' };
  const { context, courseId, school, schoolClass } = budgetPackContext(pack, ref, scope, grid);
  const periods: BudgetPackPeriod[] = [];
  const findings: BudgetPackFinding[] = [];
  const limits: { term: number | null; to: Day }[] = [];
  for (const term of ref.year.terms) {
    if (
      !pack.items.some((item) => termOf(pack, item) === term.number) ||
      compareDays(term.to, scope.from) < 0 ||
      compareDays(term.from, scope.to) > 0
    )
      continue;
    const exam = context.calendar
      .entriesFor(school, schoolClass)
      .filter((entry) => entry.effect === 'exam' && entry.term === term.number)
      .map((entry) => entry.from)
      .sort(compareDays)[0];
    const to = minDay(scope.to, exam === undefined ? term.to : addDays(exam, -1));
    limits.push({ term: term.number, to });
  }
  limits.push({ term: null, to: scope.to });
  for (const limit of limits) {
    const available =
      compareDays(scope.from, limit.to) > 0
        ? []
        : sessionsBetween(context, scope.from, limit.to, new Set([courseId])).filter(
            (session) => session.calendar === null,
          );
    const metrics = (queue: 'main' | 'td') => {
      const items = queueItems(pack, queue).filter(
        (item) => limit.term === null || (termOf(pack, item) !== undefined && termOf(pack, item)! <= limit.term),
      );
      const gives = available.filter(
        (session) => findSessionType(ref.country, session.sessionType).queue === queue,
      ).length;
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
          term: limit.term,
          from: scope.from,
          to: limit.to,
          needs,
          gives,
          shortfall: needs - gives,
          items: overflow,
        });
      return { needs, gives };
    };
    periods.push({ term: limit.term, from: scope.from, to: limit.to, main: metrics('main'), td: metrics('td') });
  }
  return { status: 'checked', source: grid.source, periods, findings };
}
