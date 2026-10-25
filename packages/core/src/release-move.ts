// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Moving a class to a newer release of its pack (#322, answer 487, R-4.2-17,
// R-4.2-18). The move is offered only when every release between the
// class's and the newer one is on the phone. Each change of the class's own,
// exam answer or change of a layer it follows that the newer releases make
// unclear is asked once, its choices the parts or the merged item, or not
// carrying it; one made unclear by an earlier move was answered then, so only
// the releases after the class's own are asked about. The move records
// `course.moved`, then each answer as the class's own change on the newer
// release's IDs: a leave-out becomes a skip and an exam merge a join, and a
// postponement stays an exam answer (answer 488); a move goes before where its
// item was placed before carries to, and one now before itself is already
// done. Nothing recorded is rewritten, and a change on a removed item is
// listed, for the screen to say.

import type { Context } from './context.ts';
import type { Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import { recordedDecisions } from './lineage.ts';
import { carryDecisions, courseMigration, placedBefore } from './migration-carry.ts';
import type { PlanPack } from './pack.ts';
import {
  followId,
  newIds,
  oldIds,
  PART_ID,
  releaseChain,
  type Migration,
  type MigrationEntry,
} from './pack-migration.ts';
import { recordChange } from './plan-changes.ts';
import { allowedBy, type PlanDecision } from './plan-decisions.ts';
import { nextSeq } from './plan-layer.ts';
import { packKey } from './reference.ts';
import { courseLayers, layerChanges, type PlanLayer } from './variant-layers.ts';

/** A change the newer releases make unclear, as the class reads it on its own release. */
export interface MoveQuestion {
  readonly decision: PlanDecision;
  /** The layer whose change it is; none for the class's own. */
  readonly layer?: PlanLayer;
  /** The release whose entry makes it unclear, and that entry. */
  readonly release: string;
  readonly entry: MigrationEntry;
  /** The newer release's items it can go to; not carrying it is always a choice too. */
  readonly choices: readonly string[];
}

export type MovePlan =
  | {
      readonly ok: true;
      readonly from: PlanPack;
      readonly to: PlanPack;
      readonly steps: Migration;
      readonly questions: readonly MoveQuestion[];
      /** Changes on an item the newer releases remove: left out, or carried without it. */
      readonly removed: readonly { readonly decision: PlanDecision; readonly layer?: PlanLayer }[];
    }
  | { readonly ok: false; readonly problem: 'no-pack' | 'missing' | 'broken' | 'not-newer'; readonly release?: string };

/** What moving a class to release `to` of its pack carries, asks and leaves out; or why no move is offered. */
export function movePlan(context: Context, courseId: string, to: string): MovePlan {
  const pin = context.state.courses.get(courseId)?.pack;
  if (pin == null) return { ok: false, problem: 'no-pack' };
  const { packs } = context.ref;
  const from = packs.get(packKey(pin.id, pin.release));
  const target = packs.get(packKey(pin.id, to));
  if (from === undefined || target === undefined) {
    return { ok: false, problem: 'missing', release: from === undefined ? pin.release : to };
  }
  const chain = releaseChain(packs.values(), target, pin.release);
  if (!chain.ok) return { ok: false, problem: chain.problem, release: chain.release };
  const current = courseMigration(context, courseId);
  const own = [...recordedDecisions(context.state, courseId).values()].filter((one) => one.courseId === courseId);
  const lists: { readonly layer?: PlanLayer; readonly list: readonly PlanDecision[] }[] = [
    { list: own },
    ...courseLayers(context.state, courseId).on.map((layer) => ({ layer, list: layerChanges(layer, courseId) })),
  ];
  const questions: MoveQuestion[] = [];
  const removed: { readonly decision: PlanDecision; readonly layer?: PlanLayer }[] = [];
  for (const { layer, list } of lists) {
    const carried = carryDecisions(carryDecisions(list, current).decisions, chain.steps);
    for (const { decision, release, entry } of carried.unclear) {
      const later = chain.steps.slice(chain.steps.findIndex((step) => step.after.release === release) + 1);
      const choices = [...new Set(newIds(entry).flatMap((id) => followId(later, id)))];
      questions.push({ decision, ...(layer !== undefined && { layer }), release, entry, choices });
    }
    for (const decision of carried.removed) removed.push({ decision, ...(layer !== undefined && { layer }) });
  }
  return { ok: true, from, to: target, steps: chain.steps, questions, removed };
}

/** Where one of the question's items goes: the item chosen for the one made unclear, else where it was taken. */
function answeredIds(question: MoveQuestion, steps: Migration, chosen: string, id: string): string[] {
  const hits = (one: string) => oldIds(question.entry).includes(PART_ID.exec(one)?.[1] ?? one);
  let now = [id];
  for (const step of steps) {
    if (step.after.release === question.release && now.some(hits)) return [chosen];
    now = now.flatMap((one) => followId([step], one));
  }
  return now;
}

/** The answer as a change on the newer release's IDs, without its place in the class's order. */
function answerOf(question: MoveQuestion, steps: Migration, chosen: string, made: { id: string; day: Day }) {
  const ids = (id: string) => answeredIds(question, steps, chosen, id);
  const one = (id: string) => ids(id)[0] ?? chosen;
  const base = { id: made.id, courseId: question.decision.courseId, day: made.day, seq: 0 };
  const decision = question.decision;
  switch (decision.kind) {
    case 'move':
      return {
        ...base,
        kind: 'move',
        item: one(decision.item),
        before: placedBefore(steps, decision.before),
      } as const;
    case 'budget':
      return { ...base, kind: 'budget', item: one(decision.item), sessions: decision.sessions } as const;
    case 'split':
      return { ...base, kind: 'split', item: one(decision.item), titles: decision.titles } as const;
    case 'skip':
    case 'leave-out':
      return { ...base, kind: 'skip', item: one(decision.item) } as const;
    case 'join':
    case 'merge':
      return { ...base, kind: 'join', items: [one(decision.items[0]), one(decision.items[1])] as const } as const;
    case 'postpone':
      return { ...decision, id: made.id, items: [...new Set(decision.items.flatMap(ids))] };
    case 'add':
    case 'undo':
      throw new RangeError('An added item or an undo is never unclear');
  }
}

/**
 * The move's events: `course.moved`, then each answer, in the questions'
 * order, `null` for not carrying it. Each answer is checked against the plan
 * on the newer release; one that does not fit throws, so nothing is recorded.
 */
export function moveEvents(
  context: Context,
  courseId: string,
  plan: Extract<MovePlan, { ok: true }>,
  answers: readonly (string | null)[],
  made: { readonly newId: () => string; readonly day: Day },
): RecordEvent[] {
  const course = context.state.courses.get(courseId);
  if (course?.pack == null || answers.length !== plan.questions.length) throw new RangeError('Answer every question');
  const move = { courseId, from: plan.from.release, to: plan.to.release };
  const events: RecordEvent[] = [{ kind: 'course.moved', move }];
  const courses = new Map(context.state.courses).set(courseId, {
    ...course,
    pack: { ...course.pack, release: move.to },
  });
  let after: Context = { ...context, state: { ...context.state, courses } };
  plan.questions.forEach((question, index) => {
    const chosen = answers[index];
    if (chosen === null || chosen === undefined) return;
    if (!question.choices.includes(chosen)) throw new RangeError('Not one of the choices');
    const draft = answerOf(question, plan.steps, chosen, { id: made.newId(), day: made.day });
    let event: RecordEvent;
    if (draft.kind === 'postpone') {
      if (!allowedBy(plan.to, draft)) throw new RangeError('The postponement does not fit the newer release');
      event = { kind: 'plan.decided', decision: draft };
    } else if (draft.kind === 'move' && draft.before === draft.item) {
      return;
    } else {
      const seq = nextSeq(recordedDecisions(after.state, courseId), courseId);
      event = recordChange(after, { ...draft, seq });
    }
    if (event.kind !== 'plan.decided') return;
    events.push(event);
    const decisions = new Map(after.state.decisions).set(event.decision.id, event.decision);
    after = { ...after, state: { ...after.state, decisions } };
  });
  return events;
}

/** A question's choices that fit after the answers given to the questions before it, as `moveEvents` checks them. */
export function fittingChoices(
  context: Context,
  courseId: string,
  plan: Extract<MovePlan, { ok: true }>,
  index: number,
  before: { readonly answers: readonly (string | null)[]; readonly day: Day },
): string[] {
  return (plan.questions[index]?.choices ?? []).filter((choice) => {
    const answers = plan.questions.map((_, at) =>
      at === index ? choice : at < index ? (before.answers[at] ?? null) : null,
    );
    let next = 0;
    try {
      moveEvents(context, courseId, plan, answers, { newId: () => `check-${(next += 1)}`, day: before.day });
      return true;
    } catch {
      return false;
    }
  });
}
