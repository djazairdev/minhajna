// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The distributions (#237, Dist, R-3.8-30, R-3.8-31, answers 416 (7), 421 and
// 422): a class's plan fitted to its timetable and the calendar for the whole
// year. Each confirmed session counts with the items it taught, and the rest as
// the plan projects them, so the distributions move with what is confirmed.
// They follow the class's main queue: a TD for half the class, or a support
// session, is not in them, nor is a session not held, one that taught nothing
// from the plan, or one the calendar takes. Half-groups that take each item in
// turn, and a rotation's groups, count once a round, on the day the last group
// has it, as the plan's pacing counts them. The annual one goes by sequence,
// with its first and last days and its sessions; the monthly one by teaching
// week, with its resources; the termly one by term, with its sequences, its
// days and its sessions. A session that covers items of two sequences counts in
// each. An item outside any sequence, such as a diagnostic assessment, stands
// as its own; in a plan by weeks with no sequences, the plan week stands
// instead.

import { courseSetup } from './choices.ts';
import type { Context } from './context.ts';
import { compareDays, isWithin, monthOf, startOfWeek, type Day } from './day.ts';
import { walkCourse } from './engine.ts';
import { carriedId } from './pack-migration.ts';
import type { PackItem, PlanPack } from './pack.ts';
import { queueOf } from './pacing.ts';
import { findPackItem } from './plan-layer.ts';
import { halfTurns, sessionCredits } from './rotation-sessions.ts';
import { sessionsBetween, type Session } from './sessions.ts';
import { current } from './state.ts';

/** A session of the year and the items it covers, taught or as the plan projects. */
export interface DistributionSession {
  readonly session: Session;
  readonly items: readonly PackItem[];
  readonly confirmed: boolean;
  /** 1 when it counts as a class session; 0 for a half-group's or a rotation group's before its round ends. */
  readonly credit: number;
}

/** A sequence, an item outside any, or a plan week, which `week` then names and `title` leaves empty. */
export interface Sequence {
  readonly id: string;
  readonly title: string;
  readonly week?: number;
}

/** A sequence over the year: its first and last days, its sessions, and how many of them are confirmed. */
export interface AnnualRow extends Sequence {
  readonly from: Day;
  readonly to: Day;
  readonly sessions: number;
  readonly confirmed: number;
}

/** A teaching week of a month: its first and last session days, its resources in order, and its sessions. */
export interface WeekRow {
  readonly week: Day;
  readonly from: Day;
  readonly to: Day;
  readonly resources: readonly { readonly id: string; readonly title: string }[];
  readonly sessions: number;
}

/** A term: its days from the calendar, its sequences in order, and its sessions. */
export interface TermRow {
  readonly term: number;
  readonly from: Day;
  readonly to: Day;
  readonly sequences: readonly Sequence[];
  readonly sessions: number;
}

/** The course's main-queue sessions of the year with their items, confirmed or projected; none for no course. */
export function distributionSessions(context: Context, courseId: string): DistributionSession[] {
  const { ref, state } = context;
  if (!state.courses.has(courseId)) return [];
  const { pack, migration } = courseSetup(context, courseId);
  if (pack === null) return [];
  const walk = walkCourse(context, courseId, ref.year.to);
  const found: Omit<DistributionSession, 'credit'>[] = [];
  for (const session of sessionsBetween(context, ref.year.from, ref.year.to, new Set([courseId]))) {
    if (queueOf(context, session) !== 'main') continue;
    const record = current(state.sessions.get(session.key));
    if (record !== null) {
      const items = record.coverage
        .filter((one) => one.op !== 'skipped')
        .map((one) => findPackItem(pack, carriedId(migration, one.item) ?? one.item))
        .filter((item) => item !== undefined);
      if (record.outcome !== 'not-held' && items.length > 0) found.push({ session, items, confirmed: true });
      continue;
    }
    if (session.calendar !== null) continue;
    const proposal = walk.proposals.get(session.key);
    if (proposal === null || proposal === undefined) continue;
    const items = proposal.with === undefined ? [proposal.item] : [proposal.item, proposal.with.item];
    found.push({ session, items, confirmed: false });
  }
  const credits = sessionCredits(
    found.map((one) => one.session),
    halfTurns(context),
  );
  return found.map((one, index) => ({ ...one, credit: credits[index]! }));
}

const packOf = (context: Context, courseId: string) =>
  context.state.courses.has(courseId) ? courseSetup(context, courseId).pack : null;

/** The sequence an item belongs to: its unit, its plan week in a plan by weeks with no units, or the item itself. */
function sequenceOf(pack: PlanPack | null, item: PackItem): Sequence {
  const unit = item.unit === undefined ? undefined : findPackItem(pack, item.unit);
  if (unit !== undefined) return { id: unit.id, title: unit.title };
  const byWeek = pack?.anchor.kind === 'weeks' && !pack.items.some((one) => one.kind === 'unit');
  if (byWeek && item.week !== undefined) return { id: `week-${item.week}`, title: '', week: item.week };
  return { id: item.id, title: item.title };
}

/** The sequences of a session's items, each once, in order. */
function sequencesOf(pack: PlanPack | null, one: DistributionSession): Sequence[] {
  const found = new Map<string, Sequence>();
  for (const item of one.items) {
    const sequence = sequenceOf(pack, item);
    if (!found.has(sequence.id)) found.set(sequence.id, sequence);
  }
  return [...found.values()];
}

/** The annual distribution: each sequence in the order first taught, with its days and sessions. */
export function annualDistribution(
  context: Context,
  courseId: string,
  sessions: readonly DistributionSession[] = distributionSessions(context, courseId),
): AnnualRow[] {
  const pack = packOf(context, courseId);
  const rows = new Map<
    string,
    { sequence: Sequence; days: Day[]; counted: Day[]; sessions: number; confirmed: number }
  >();
  for (const one of sessions) {
    for (const sequence of sequencesOf(pack, one)) {
      const row = rows.get(sequence.id) ?? { sequence, days: [], counted: [], sessions: 0, confirmed: 0 };
      row.days.push(one.session.day);
      if (one.credit > 0) row.counted.push(one.session.day);
      row.sessions += one.credit;
      row.confirmed += one.confirmed ? one.credit : 0;
      rows.set(sequence.id, row);
    }
  }
  return [...rows.values()].map((row) => {
    const days = (row.counted.length > 0 ? row.counted : row.days).sort(compareDays);
    return {
      ...row.sequence,
      from: days[0]!,
      to: days[days.length - 1]!,
      sessions: row.sessions,
      confirmed: row.confirmed,
    };
  });
}

/** The monthly distribution of `month`, such as `2026-10`: each week with a session that counts, and its resources. */
export function monthlyDistribution(
  context: Context,
  courseId: string,
  month: string,
  sessions: readonly DistributionSession[] = distributionSessions(context, courseId),
): WeekRow[] {
  const weeks = new Map<Day, { from: Day; to: Day; resources: Map<string, string>; sessions: number }>();
  for (const one of sessions) {
    const day = one.session.day;
    if (monthOf(day) !== month) continue;
    const week = startOfWeek(day, context.ref.country.weekStartsOn);
    const row = weeks.get(week) ?? { from: day, to: day, resources: new Map<string, string>(), sessions: 0 };
    row.to = day;
    row.sessions += one.credit;
    for (const item of one.items) row.resources.set(item.id, item.title);
    weeks.set(week, row);
  }
  return [...weeks]
    .filter(([, row]) => row.sessions > 0)
    .map(([week, row]) => ({
      week,
      from: row.from,
      to: row.to,
      resources: [...row.resources].map(([id, title]) => ({ id, title })),
      sessions: row.sessions,
    }));
}

/** The termly distribution: each term with a session that counts, and its days, sequences and sessions. */
export function termlyDistribution(
  context: Context,
  courseId: string,
  sessions: readonly DistributionSession[] = distributionSessions(context, courseId),
): TermRow[] {
  const pack = packOf(context, courseId);
  return context.ref.year.terms.flatMap((term) => {
    const within = sessions.filter((one) => isWithin(one.session.day, term.from, term.to));
    const counted = within.reduce((sum, one) => sum + one.credit, 0);
    if (counted === 0) return [];
    const sequences = new Map<string, Sequence>();
    for (const one of within) {
      for (const sequence of sequencesOf(pack, one))
        if (!sequences.has(sequence.id)) sequences.set(sequence.id, sequence);
    }
    return [{ term: term.number, from: term.from, to: term.to, sequences: [...sequences.values()], sessions: counted }];
  });
}
