// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the teacher chose for a session, and the record it makes (PRD §3.3).
// The index exports only the public names; the helpers serve the engine.

import type { Context } from './context.ts';
import { stageCount, type PackItem, type PlanPack } from './pack.ts';
import { findLevel, findSessionType, packKey } from './reference.ts';
import type { Course, Coverage, Homework, SchoolClass, SessionRecord, SessionRef } from './records.ts';
import type { Session } from './sessions.ts';
import { propose, type Progress, type Proposal } from './progress.ts';

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
   * The session did not take place. `makeUp` is the teacher's mark «تُعوَّض
   * هذه الحصة»: only it, or the director's request, makes a session owed a
   * make-up, never the app on its own (PRD §3.3, §7.7).
   */
  | { readonly outcome: 'not-held'; readonly makeUp?: boolean };

/** What else a session can record (PRD §3.3). */
export interface Details {
  readonly sessionType?: string;
  readonly homework?: Homework;
  readonly test?: string;
  readonly unplanned?: string;
  readonly factual?: string;
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
  readonly pack: PlanPack | null;
  /** True when the course pins a pack release that is not installed. */
  readonly packMissing: boolean;
  readonly sessionMinutes: number;
}

export function courseSetup(context: Context, courseId: string): CourseSetup {
  const { ref, state } = context;
  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  if (course === undefined || schoolClass === undefined) throw new RangeError(`Unknown course: ${courseId}`);
  const pack = course.pack === null ? null : (ref.packs.get(packKey(course.pack.id, course.pack.release)) ?? null);
  return {
    course,
    schoolClass,
    pack,
    packMissing: course.pack !== null && pack === null,
    sessionMinutes: course.sessionMinutes ?? findLevel(ref.country, schoolClass.level).sessionMinutes,
  };
}

export function proposalFor(
  context: Context,
  setup: CourseSetup,
  progress: Progress,
  session: Session,
  sessionType: string,
): Proposal | null {
  if (setup.pack === null) return null;
  return propose(setup.pack, progress, {
    queue: findSessionType(context.ref.country, sessionType).queue,
    groupId: session.groupId,
    ...(session.activity !== undefined && { activity: session.activity }),
    sessionMinutes: setup.sessionMinutes,
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
      return proposal === null ? [] : [{ op: 'taught', item: proposal.item.id, from: proposal.from, to: proposal.to }];
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
      return next === null ? [skipped] : [skipped, { op: 'taught', item: next.item.id, from: next.from, to: next.to }];
    }
    case 'retaught':
      return [{ op: 'retaught', item: findItem(setup.pack, choice.item).id }];
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
    ...(details.homework !== undefined && { homework: details.homework }),
    ...(details.test !== undefined && { test: details.test }),
    ...(details.unplanned !== undefined && { unplanned: details.unplanned }),
    ...(details.factual !== undefined && { factual: details.factual }),
  };
}
