// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Walks a course's sessions in order, counting what was recorded, and
// confirms new sessions against the proposals (PRD §4.7). Items the teacher
// decided to leave out count as skipped from the start, when the pack
// marks them optional (#221), and so do the items the class's own changes
// skip (#225).

import type { Context } from './context.ts';
import type { Day } from './day.ts';
import type { SessionRecord } from './records.ts';
import { sessionsBetween, type Session } from './sessions.ts';
import { current } from './state.ts';
import { allowedBy, decisionsFor } from './plan-decisions.ts';
import { skippedBy } from './plan-layer.ts';
import { Progress, proposedCoverage, type Proposal } from './progress.ts';
import {
  courseSetup,
  coverageFor,
  proposalFor,
  recordOf,
  type Choice,
  type CourseSetup,
  type Details,
} from './choices.ts';

/** Called for each session of a course in order. Returns the record to count, if any. */
type Visitor = (session: Session, proposal: () => Proposal | null, progress: Progress) => SessionRecord | null;

/**
 * Goes through a course's sessions from the start of the year to `upTo`, in
 * order. Recorded sessions move the progress. For the others, `visit`
 * decides what to count: a proposal shown as if done, or a new record.
 * Returns the progress of the recorded sessions alone.
 */
function walk(context: Context, setup: CourseSetup, upTo: Day, ignore: ReadonlySet<string>, visit: Visitor): Progress {
  const { ref, state } = context;
  const recorded = Progress.of(setup.schoolClass);
  const chain = Progress.of(setup.schoolClass);
  for (const decision of decisionsFor(state.decisions, setup.course.id)) {
    if (decision.kind !== 'leave-out' || setup.pack === null || !allowedBy(setup.pack, decision)) continue;
    recorded.leaveOut(decision.item);
    chain.leaveOut(decision.item);
  }
  for (const item of setup.pack === null ? [] : skippedBy(setup.pack, state.decisions, setup.course.id)) {
    recorded.leaveOut(item);
    chain.leaveOut(item);
  }
  for (const session of sessionsBetween(context, ref.year.from, upTo, new Set([setup.course.id]))) {
    const record = ignore.has(session.key) ? null : current(state.sessions.get(session.key));
    if (record !== null) {
      recorded.apply(record);
      chain.apply(record);
      continue;
    }
    const counted = visit(session, () => proposalFor(context, setup, chain, session, session.sessionType), chain);
    if (counted !== null) chain.apply(counted);
  }
  return recorded;
}

export interface CourseWalk {
  readonly setup: CourseSetup;
  /** For every ordinary session awaiting confirmation. */
  readonly proposals: ReadonlyMap<string, Proposal | null>;
  /** The progress of the recorded sessions alone. */
  readonly progress: Progress;
}

/**
 * The proposals for a course's sessions awaiting confirmation, up to
 * `upTo`. Each proposal follows the one before it, as if the earlier
 * sessions went as planned, so confirming a whole week gives exactly what
 * the screens showed.
 */
export function walkCourse(context: Context, courseId: string, upTo: Day): CourseWalk {
  const setup = courseSetup(context, courseId);
  const proposals = new Map<string, Proposal | null>();
  const progress = walk(context, setup, upTo, new Set(), (session, proposal) => {
    if (session.calendar !== null) return null;
    const p = proposal();
    proposals.set(session.key, p);
    return p === null ? null : recordOf(session, { outcome: 'done' }, proposedCoverage(p), {}, session.sessionType);
  });
  return { setup, proposals, progress };
}

export interface Confirmation {
  readonly sessionKey: string;
  /**
   * Done as planned when not set. For a correction, leaving it out keeps the
   * outcome and the stages already recorded.
   */
  readonly choice?: Choice;
  readonly details?: Details;
}

/** The details given, over a record's own; null takes one out. */
function withDetails(record: SessionRecord, details: Details): SessionRecord {
  const merged: Record<string, unknown> = { ...record };
  for (const [name, value] of Object.entries(details)) {
    if (value === null) delete merged[name];
    else if (value !== undefined) merged[name] = value;
  }
  return merged as unknown as SessionRecord;
}

/**
 * The proposal a session had from the sessions before it, its own record
 * set aside: what a correction starts from (PRD §3.1, rule 4).
 */
export function proposalAt(context: Context, session: Session): Proposal | null {
  const setup = courseSetup(context, session.courseId);
  let found: Proposal | null = null;
  walk(context, setup, session.day, new Set([session.key]), (other, proposal) => {
    if (other.calendar !== null) return null;
    const p = proposal();
    if (other.key === session.key) {
      found = p;
      return null;
    }
    return p === null ? null : recordOf(other, { outcome: 'done' }, proposedCoverage(p), {}, other.sessionType);
  });
  return found;
}

/**
 * Records sessions of one course in order. A session that already has a
 * record gets a corrected version, and both versions stay. A correction
 * without a choice changes only the details it gives: it never records a
 * stage the teacher did not confirm (PRD §2.3, rule 1).
 */
export function confirmCourse(
  context: Context,
  courseId: string,
  confirmations: readonly Confirmation[],
  upTo: Day,
): SessionRecord[] {
  const setup = courseSetup(context, courseId);
  const wanted = new Map(confirmations.map((confirmation) => [confirmation.sessionKey, confirmation]));
  const records: SessionRecord[] = [];
  walk(context, setup, upTo, new Set(wanted.keys()), (session, proposal, progress) => {
    const confirmation = wanted.get(session.key);
    if (confirmation === undefined) {
      if (session.calendar !== null) return null;
      const p = proposal();
      return p === null ? null : recordOf(session, { outcome: 'done' }, proposedCoverage(p), {}, session.sessionType);
    }
    const details = confirmation.details ?? {};
    const recorded = current(context.state.sessions.get(session.key));
    let record: SessionRecord;
    if (confirmation.choice === undefined && recorded !== null) {
      record = withDetails(recorded, details);
    } else {
      const choice = confirmation.choice ?? { outcome: 'done' };
      const sessionType = details.sessionType ?? session.sessionType;
      const p = proposalFor(context, setup, progress, session, sessionType);
      record = recordOf(
        session,
        choice,
        coverageFor(context, setup, progress, session, p, choice, sessionType),
        details,
        sessionType,
      );
    }
    records.push(record);
    wanted.delete(session.key);
    return record;
  });
  if (wanted.size > 0) throw new RangeError(`Unknown session: ${[...wanted.keys()].join(', ')}`);
  return records;
}
