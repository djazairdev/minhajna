// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the teacher chose for a session, and the record it makes (PRD §3.3).
// The index exports only the public names; the helpers serve the engine.

import type { Context } from './context.ts';
import { stageCount, type PackItem, type PlanPack } from './pack.ts';
import { findLevel, findSessionType, packKey } from './reference.ts';
import type { Course, Coverage, Homework, ListItemTaken, SchoolClass, SessionRecord, SessionRef } from './records.ts';
import type { Session } from './sessions.ts';
import { mergesOf } from './plan-decisions.ts';
import { layered } from './plan-layer.ts';
import { courseLayers } from './variant-layers.ts';
import { ownPack } from './free-list.ts';
import { propose, proposedCoverage, type Progress, type Proposal } from './progress.ts';

/** What the teacher chose for a session (PRD §3.3). */
export type Choice =
  /** Done as planned: one tap. */
  | { readonly outcome: 'done' }
  /** Last stage reached: the stage count covered once the session ended. */
  | { readonly outcome: 'partial'; readonly reached: number }
  /** Two items taught together: the proposed one and this one. */
  | { readonly outcome: 'merged'; readonly with: string }
  /** The proposed item left out. With `instead`, the next item was taught in its place. */
  | { readonly outcome: 'skipped'; readonly instead: boolean }
  /** An item taught again. */
  | { readonly outcome: 'retaught'; readonly item: string }
  /**
   * Another lesson than the one proposed: an open plan item, up to the stage
   * count `reached` (all its stages when absent), or, with no item, content
   * from outside the plan, written in the details' `unplanned`. The proposed
   * item stays first in its queue (PRD §2.3, §4.7).
   */
  | { readonly outcome: 'changed'; readonly item?: string; readonly reached?: number }
  /**
   * The session did not take place. `makeUp` is the teacher's mark «تُعوَّض
   * هذه الحصة»: only it, or the director's request, makes a session owed a
   * make-up, never the app on its own (PRD §3.3, §7.7).
   */
  | { readonly outcome: 'not-held'; readonly makeUp?: boolean };

/**
 * What else a session can record (PRD §3.3). In a correction, null takes a
 * detail out of the new version; the version before keeps it.
 */
export interface Details {
  readonly sessionType?: string;
  readonly homework?: Homework | null;
  readonly test?: string | null;
  readonly unplanned?: string | null;
  readonly factual?: string | null;
  readonly listItem?: ListItemTaken | null;
}

export function findItem(pack: PlanPack | null, id: string): PackItem {
  const item = pack?.items.find((candidate) => candidate.id === id && candidate.kind !== 'unit');
  if (item === undefined) throw new RangeError(`Unknown plan item: ${id}`);
  return item;
}

export function needProposal(proposal: Proposal | null): Proposal {
  if (proposal === null) throw new RangeError('This outcome needs a proposed item');
  return proposal;
}

/** The pack, progress and settings one course needs. */
export interface CourseSetup {
  readonly course: Course;
  readonly schoolClass: SchoolClass;
  /** The pinned release with the class's own changes over it (#225). */
  readonly pack: PlanPack | null;
  /** True when the course pins a pack release that is not installed. */
  readonly packMissing: boolean;
  /** True when the pinned release is stale: it proposes nothing, and no buffer or delay is counted from it. */
  readonly packStale: boolean;
  readonly sessionMinutes: number;
}

export function courseSetup(context: Context, courseId: string): CourseSetup {
  const { ref, state } = context;
  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  if (course === undefined || schoolClass === undefined) throw new RangeError(`Unknown course: ${courseId}`);
  const pack = course.pack === null ? null : (ref.packs.get(packKey(course.pack.id, course.pack.release)) ?? null);
  const sessionMinutes = course.sessionMinutes ?? findLevel(ref.country, schoolClass.level).sessionMinutes;
  const list = course.pack === null ? state.lists.get(courseId) : undefined;
  return {
    course,
    schoolClass,
    pack:
      list !== undefined
        ? ownPack(list, course, schoolClass, ref.country)
        : pack === null
          ? null
          : layered(pack, state.decisions, courseId, sessionMinutes, courseLayers(state, courseId)),
    packMissing: course.pack !== null && pack === null,
    packStale: pack?.status === 'stale',
    sessionMinutes,
  };
}

export function proposalFor(
  context: Context,
  setup: CourseSetup,
  progress: Progress,
  session: Session,
  sessionType: string,
): Proposal | null {
  if (setup.pack === null || setup.packStale) return null;
  return propose(setup.pack, progress, {
    queue: findSessionType(context.ref.country, sessionType).queue,
    groupId: session.groupId,
    ...(session.activity !== undefined && { activity: session.activity }),
    sessionMinutes: setup.sessionMinutes,
    merges: mergesOf(setup.pack, context.state.decisions, setup.course.id),
  });
}

export function coverageFor(
  context: Context,
  setup: CourseSetup,
  progress: Progress,
  session: Session,
  proposal: Proposal | null,
  choice: Choice,
  sessionType: string,
): Coverage[] {
  switch (choice.outcome) {
    case 'done':
      return proposal === null ? [] : proposedCoverage(proposal);
    case 'partial': {
      const p = needProposal(proposal);
      if (!Number.isInteger(choice.reached) || choice.reached < p.from || choice.reached > p.stages) {
        throw new RangeError('The stage reached is outside the proposed item');
      }
      return [{ op: 'taught', item: p.item.id, from: p.from, to: choice.reached }];
    }
    case 'merged': {
      const p = needProposal(proposal);
      const other = findItem(setup.pack, choice.with);
      if (other.id === p.item.id) throw new RangeError('An item cannot be merged with itself');
      const pack = setup.pack as PlanPack;
      return [
        { op: 'taught', item: p.item.id, from: p.from, to: p.stages },
        {
          op: 'taught',
          item: other.id,
          from: progress.firstOpen(other.id, session.groupId),
          to: stageCount(pack, other),
        },
      ];
    }
    case 'skipped': {
      const p = needProposal(proposal);
      const skipped: Coverage = { op: 'skipped', item: p.item.id };
      if (!choice.instead) return [skipped];
      const after = progress.clone();
      after.apply({
        session: refOf(session),
        outcome: 'skipped',
        sessionType,
        coverage: [skipped],
      });
      const next = proposalFor(context, setup, after, session, sessionType);
      return next === null ? [skipped] : [skipped, ...proposedCoverage(next)];
    }
    case 'retaught':
      return [{ op: 'retaught', item: findItem(setup.pack, choice.item).id }];
    case 'changed': {
      if (choice.item === undefined) return [];
      const item = findItem(setup.pack, choice.item);
      const pack = setup.pack as PlanPack;
      if (progress.isFinished(pack, item, session.groupId)) throw new RangeError('A finished item is taught again');
      const from = progress.firstOpen(item.id, session.groupId);
      const to = choice.reached ?? stageCount(pack, item);
      if (!Number.isInteger(to) || to < from || to > stageCount(pack, item)) {
        throw new RangeError('The stage reached is outside the chosen item');
      }
      return [{ op: 'taught', item: item.id, from, to }];
    }
    case 'not-held':
      return [];
  }
}

export function refOf(session: Session): SessionRef {
  return {
    key: session.key,
    courseId: session.courseId,
    groupId: session.groupId,
    day: session.day,
    slot: session.slot,
    ...(session.rotation !== undefined && { rotation: session.rotation }),
  };
}

export function recordOf(
  session: Session,
  choice: Choice,
  coverage: Coverage[],
  details: Details,
  sessionType: string,
): SessionRecord {
  return {
    session: refOf(session),
    outcome: choice.outcome,
    sessionType,
    coverage,
    ...(choice.outcome === 'not-held' && choice.makeUp === true && { makeUp: true }),
    ...(details.homework != null && { homework: details.homework }),
    ...(details.test != null && { test: details.test }),
    ...(details.unplanned != null && { unplanned: details.unplanned }),
    ...(details.factual != null && { factual: details.factual }),
    ...(details.listItem != null && choice.outcome !== 'not-held' && { listItem: details.listItem }),
  };
}
