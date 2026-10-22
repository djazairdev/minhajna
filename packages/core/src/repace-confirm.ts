// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Confirming a re-pace and taking it back (#229, PRD §4.7, R-4.7-29,
// R-4.7-30, R-4.7-35, answers 363, 366, 367, 370 and 371). Rung 5 is
// offered when the class is behind beyond its buffers, or behind its
// current distribution with items that would land after the next exams,
// and only then recorded. Confirming records each ticked choice as its own
// decision, then the re-pace with the gap it absorbs; in primary only with
// the day the director approved it, no earlier than the day the draft was
// printed, and with the choices printed on it. «تراجع» right after takes
// all of it back; the decisions list takes back the re-pace alone, leaving
// its decisions. Only a class's newest re-pace is taken back (answer 369).

import type { Context } from './context.ts';
import { compareDays, type Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import { pastWindow } from './exam-window.ts';
import { pace } from './pacing.ts';
import { repacesOf, type Repace } from './repace-records.ts';
import { repaceDraft, tickedDecisions, type RepaceDraft } from './repace.ts';
import { choiceKey, repacePrinted } from './repace-print.ts';

/**
 * Whether rung 5 is offered on `today`: behind beyond the buffers, or
 * behind the current distribution with items past the next exams.
 */
export function repaceOffered(context: Context, courseId: string, today: Day): boolean {
  const paced = pace(context, courseId, today);
  if (paced === null) return false;
  const behind = paced.expected - paced.position > 1e-9;
  if (paced.delay <= 0 && !(behind && pastWindow(context, courseId, today) !== null)) return false;
  return repaceDraft(context, courseId, today, []) !== null;
}

export interface RepaceInput {
  readonly courseId: string;
  /** The choices ticked in the draft, by place. */
  readonly ticked: readonly number[];
  /** The re-pace's ID, and one for each ticked choice's decision, in order. */
  readonly ids: { readonly repace: string; readonly decisions: readonly string[] };
  /** In primary, the day the director approved it, from the day it was printed to `today`. */
  readonly approved?: Day;
}

/** The events that confirm a re-pace on `today`: the ticked decisions, then the re-pace. */
export function confirmRepace(context: Context, input: RepaceInput, today: Day): RecordEvent[] {
  const { courseId, ticked, ids, approved } = input;
  const { state } = context;
  if (state.repaces.has(ids.repace)) throw new RangeError('The re-pace exists');
  const draft = repaceOffered(context, courseId, today) ? repaceDraft(context, courseId, today, ticked) : null;
  if (draft === null) throw new RangeError('Nothing to re-pace');
  const unique = new Set([ids.repace, ...ids.decisions]);
  if (
    draft.ticked.length !== ticked.length ||
    ids.decisions.length !== ticked.length ||
    unique.size !== ticked.length + 1
  ) {
    throw new RangeError('Each ticked choice needs its own ID');
  }
  if (ids.decisions.some((id) => state.decisions.has(id))) throw new RangeError('The decision exists');
  if (draft.primary !== (approved !== undefined)) {
    throw new RangeError(draft.primary ? 'The director approves a primary re-pace' : 'Only primary needs approval');
  }
  const print = approved === undefined ? undefined : approval(context, draft, approved, today);
  const decisions = tickedDecisions(draft, ids.decisions);
  const repace: Repace = {
    id: ids.repace,
    courseId,
    on: today,
    from: draft.from,
    to: draft.to,
    gap: draft.behind.sessions,
    ...(draft.behind.weeks !== null && { weeks: draft.behind.weeks }),
    decisions: decisions.map((decision) => decision.id),
    ...(approved !== undefined && { approved }),
    ...(print !== undefined && { print }),
  };
  return [
    ...decisions.map((decision) => ({ kind: 'plan.decided' as const, decision })),
    { kind: 'repace.set', repace },
  ];
}

/**
 * The ID of the print approved; refuses an approval day out of its bounds,
 * or one for choices other than the printed ones.
 */
function approval(context: Context, draft: RepaceDraft, approved: Day, today: Day): string {
  const printed = repacePrinted(context.state, draft.courseId);
  if (printed === null) throw new RangeError('The draft was not printed');
  if (compareDays(approved, today) > 0) throw new RangeError('Approved after today');
  if (compareDays(approved, context.ref.year.from) < 0) throw new RangeError('Approved before the year');
  if (compareDays(approved, printed.day) < 0) throw new RangeError('Approved before the print');
  const ticked = draft.ticked.flatMap((index) => draft.choices[index] ?? []).map(choiceKey);
  const same = (a: readonly string[], b: readonly string[]) => [...a].sort().join('|') === [...b].sort().join('|');
  if (!same(ticked, printed.choices)) throw new RangeError('Not the printed choices');
  return printed.id;
}

/**
 * The events that take back a re-pace: with `decisions`, the decisions
 * confirmed with it too, as «تراجع» right after does.
 */
export function removeRepace(context: Context, id: string, decisions = false): RecordEvent[] {
  const repace = context.state.repaces.get(id);
  if (repace === undefined) throw new RangeError('No such re-pace');
  if (repacesOf(context.state, repace.courseId).at(-1)?.id !== id) throw new RangeError('A later re-pace stands on it');
  const taken = decisions ? repace.decisions.filter((one) => context.state.decisions.has(one)) : [];
  return [{ kind: 'repace.removed', id }, ...taken.map((one) => ({ kind: 'plan.undecided' as const, id: one }))];
}
