// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's plan, item by item (PRD §4.7): what was taught and when, the
// stages covered, where the class is, and the day the plan would reach each
// item if nothing changes. Where the plan says the class should be is
// worked out apart and marked only as a reference: it never moves the class
// and is never a judgement (PRD §3.1, rule 8). Progress belongs to the
// class, the subject and the year (PRD §2.3).

import { courseSetup } from './choices.ts';
import type { Context } from './context.ts';
import { compareDays, type Day } from './day.ts';
import { walkCourse } from './engine.ts';
import { budgetInSessions, queueItems, stageCount, type PackItem, type PlanPack } from './pack.ts';
import { pace } from './pacing.ts';
import { compareSessions, sessionsBetween } from './sessions.ts';
import { current } from './state.ts';

/** `started` once any group of the class was taught it, such as one half in a TD. */
export type PlanItemStatus = 'done' | 'skipped' | 'started' | 'open';

export interface PlanRow {
  readonly item: PackItem;
  readonly status: PlanItemStatus;
  /** The first and last days it was taught, from the records. */
  readonly taught: { readonly from: Day; readonly to: Day } | null;
  /** The day the plan would reach it from today if nothing changes; null once finished. */
  readonly next: Day | null;
  readonly stages: number;
  readonly covered: number;
  /**
   * Where the class is: the item the plan goes on with after its last
   * recorded session, or, with none left, the first item not finished.
   */
  readonly position: boolean;
  /** Where the plan says the class should be, for the main queue only. A reference. */
  readonly expected: boolean;
}

export interface PlanView {
  readonly pack: PlanPack;
  /** The units and sequences, in the plan's order. */
  readonly units: readonly PackItem[];
  readonly main: readonly PlanRow[];
  readonly td: readonly PlanRow[];
}

/** The class's plan as of `today`. Null without a pack. */
export function planView(context: Context, courseId: string, today: Day): PlanView | null {
  const setup = courseSetup(context, courseId);
  const pack = setup.pack;
  if (pack === null) return null;
  const { ref, state } = context;
  const whole = setup.schoolClass.groups.find((group) => group.kind === 'whole')?.id ?? '';
  const progress = walkCourse(context, courseId, today).progress;

  const taught = new Map<string, { from: Day; to: Day }>();
  for (const versions of state.sessions.values()) {
    const record = current(versions);
    if (record === null || record.session.courseId !== courseId || compareDays(record.session.day, today) > 0) continue;
    for (const cover of record.coverage) {
      if (cover.op === 'skipped') continue;
      const known = taught.get(cover.item);
      const day = record.session.day;
      taught.set(cover.item, {
        from: known === undefined || compareDays(day, known.from) < 0 ? day : known.from,
        to: known === undefined || compareDays(day, known.to) > 0 ? day : known.to,
      });
    }
  }

  const reached = new Map<string, Day>();
  const goesOn = new Map<string, string>();
  const ahead = walkCourse(context, courseId, ref.year.to).proposals;
  const sessions = sessionsBetween(context, ref.year.from, ref.year.to, new Set([courseId]));
  const last = sessions
    .filter((session) => compareDays(session.day, today) <= 0 && current(state.sessions.get(session.key)) != null)
    .at(-1);
  for (const session of sessions) {
    const proposal = ahead.get(session.key);
    if (proposal == null) continue;
    if (compareDays(session.day, today) >= 0 && !reached.has(proposal.item.id)) {
      reached.set(proposal.item.id, session.day);
    }
    if ((last === undefined || compareSessions(session, last) > 0) && !goesOn.has(proposal.queue)) {
      goesOn.set(proposal.queue, proposal.item.id);
    }
  }

  const rows = (items: readonly PackItem[], queue: 'main' | 'td', expectedAt: number): PlanRow[] => {
    const next = items.findIndex((item) => item.id === goesOn.get(queue));
    const position = next >= 0 ? next : items.findIndex((item) => !progress.isFinished(pack, item, whole));
    return items.map((item, index) => {
      const finished = progress.isFinished(pack, item, whole);
      const covered = progress.covered(item.id, whole);
      const status: PlanItemStatus = progress.skipped(item.id)
        ? 'skipped'
        : finished
          ? 'done'
          : covered > 0 || progress.spent(item.id, whole) > 0 || taught.has(item.id)
            ? 'started'
            : 'open';
      return {
        item,
        status,
        taught: taught.get(item.id) ?? null,
        next: finished ? null : (reached.get(item.id) ?? null),
        stages: stageCount(pack, item),
        covered,
        position: index === position,
        expected: index === expectedAt,
      };
    });
  };

  const main = queueItems(pack, 'main');
  const expected = pace(context, courseId, today)?.expected ?? 0;
  let sum = 0;
  let expectedAt = main.length - 1;
  for (const [index, item] of main.entries()) {
    sum += budgetInSessions(pack, item, setup.sessionMinutes);
    if (expected < sum) {
      expectedAt = index;
      break;
    }
  }

  return {
    pack,
    units: pack.items.filter((item) => item.kind === 'unit'),
    main: rows(main, 'main', expectedAt),
    td: rows(queueItems(pack, 'td'), 'td', -1),
  };
}
