// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Drafting and publishing a version of the school's timetable from the
// director's device in a demo world (#577, #578, answers 605 and 606). A draft
// holds the school key, never started here, takes the next version's number
// from the world's store, and lists what the timetable changes from the
// standing version, the highest published not for one day, for every teacher it
// names. Each of its teachers, and each teacher of the standing version, is
// matched to the staff list (send-session.ts); a teacher matched with a code or
// key is compared with the standing part their channel actually holds, so a
// part that never arrived is sent again, and is affected when their sessions
// change or their channel holds no standing part. A teacher with no code or key
// issued, one not in the staff list, one whose name is shared, and one whose
// part is too long to send, are named apart, and so is how many sessions the
// version cannot keep. A version for one day may be published only once a
// standing version exists and every teacher it changes holds a standing part,
// so a one-day part is never a teacher's only one. For one day, each teacher is
// compared instead with the part that applies to them on that day: a one-day
// part for it, or the standing part in force then, so a standing version still
// to come is not counted and a second one-day version for a day reaches every
// teacher whose day it changes. Publishing keeps the version in the world's
// store first, with its sessions as read or entered, so its number is never
// used twice, then sends a part to each teacher affected, with the draft's
// number as its version, the first day chosen, next Sunday by default, and
// whether it is for one day; the others are told nothing. A part that does not
// reach the server names its teacher with the problem met, and the others are
// still sent. Errors before any part carry world-session.ts's codes, those of
// holding the school key, and E_TIMETABLE_ONCE for a one-day version not
// allowed.

import {
  channelParts,
  channelStream,
  isTimetablePart,
  keptIssues,
  keptVersions,
  nextVersion,
  partChanges,
  partOn,
  partSessions,
  publishedSessions,
  readJoined,
  standingVersion,
  teachersOf,
  timetableNameKey,
  type BellTimes,
  type Day,
  type DemoSchool,
  type ImportedSession,
  type KeptIssue,
  type PartChange,
  type SignedPart,
  type TimetablePart,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { assignmentsOf, holdSchool, joinCode, type IssueDesk } from '../director/issue-session';
import { worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';
import { byStaff, putPart, signingKey, staffByName, type Signing } from './send-session';

type VersionWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** A teacher of a draft with a code or key issued, their part as it would be sent, and what it changes. */
export interface DraftTeacher {
  readonly teacher: string;
  readonly issue: KeptIssue;
  readonly part: TimetablePart;
  /** What the part changes from the standing part their channel holds; empty when nothing changes. */
  readonly changes: readonly PartChange[];
  /** Whether their channel holds no standing part yet. */
  readonly first: boolean;
  /** The parts their channel holds. */
  readonly held: readonly SignedPart[];
}

/** A version drafted from the timetable read or entered. */
export interface Draft {
  readonly desk: IssueDesk;
  readonly version: number;
  /** The standing version's number and first day, or null before the first. */
  readonly standing: { readonly version: number; readonly from: Day } | null;
  readonly sessions: readonly ImportedSession[];
  /** What the timetable changes from the standing version, for every teacher it names. */
  readonly changes: readonly PartChange[];
  readonly teachers: readonly DraftTeacher[];
  readonly noCode: readonly string[];
  readonly notStaff: readonly string[];
  readonly twoNames: readonly string[];
  readonly tooLong: readonly string[];
  /** How many sessions the version cannot keep, their names too long or not of a session's shape. */
  readonly unkept: number;
}

/** Whether a draft's teacher is affected: their sessions change, or their channel holds no standing part. */
export const affected = (one: DraftTeacher) => one.first || one.changes.length > 0;

/** Whether a draft may be published for one day: a standing version exists, and every teacher affected holds one. */
export const oneDayAllowed = (draft: Draft) => draft.standing !== null && !draft.teachers.some((one) => one.first);

/**
 * A draft's teachers for the choice made: for one day, each compared with the
 * part that applies to them on that day, a one-day part for it or the standing
 * part in force then; otherwise as drafted.
 */
export const teachersOn = (draft: Draft, choice: { readonly from: Day; readonly once: boolean }) =>
  !choice.once
    ? draft.teachers
    : draft.teachers.map((one) => ({
        ...one,
        changes: partChanges(partOn(one.held, choice.from)?.part.sessions ?? [], one.part.sessions),
      }));

/** The teachers sent their part, those told nothing, and those who were not sent it, by the timetable's names. */
export interface SentParts {
  readonly sent: readonly string[];
  /** Matched, with a standing part, whose sessions this version does not change. */
  readonly unchanged: readonly string[];
  readonly noCode: readonly string[];
  readonly notStaff: readonly string[];
  readonly twoNames: readonly string[];
  readonly tooLong: readonly string[];
  /** Whose part did not reach the server. */
  readonly failed: readonly string[];
  /** The last problem met while sending, or null. */
  readonly problem: unknown;
}

type Code = Awaited<ReturnType<typeof joinCode>>;
type Space = Awaited<ReturnType<typeof spaceBatches>>;

/** The next version of the school's timetable, drafted from the sessions read or entered. */
export async function draftVersion(
  world: VersionWorld,
  school: Pick<DemoSchool, 'name' | 'teachers'>,
  sessions: readonly ImportedSession[],
  bells: BellTimes,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<Draft> {
  const desk = await holdSchool(world, kit, send, false);
  const space = desk.held.school;
  const versions = keptVersions(world.book.entries, space);
  const standing = standingVersion(versions);
  const kept = (standing?.sessions ?? []).map((one) => ({ ...one, row: 0 }));
  const staff = staffByName(school.teachers);
  const now = byStaff(sessions, staff);
  const before = byStaff(kept, staff).matched;
  const issues = keptIssues(world.book.entries, space);
  const assignments = await assignmentsOf(desk, school.teachers, kit);
  const [ca, batches] = [await caKey(world.world, send), await spaceBatches(world.world, space, send)];
  const made = (list: readonly ImportedSession[]) => kitStep(() => partSessions(space, list, kit.mac));
  const version = nextVersion(versions);
  const [teachers, noCode, tooLong] = [[] as DraftTeacher[], [] as string[], [] as string[]];
  for (const id of new Set([...now.matched.keys(), ...before.keys()])) {
    const { teacher, sessions: theirs } = now.matched.get(id) ?? { ...before.get(id)!, sessions: [] };
    const issue = issues.get(assignments.get(id) ?? '');
    if (issue === undefined) {
      noCode.push(teacher);
      continue;
    }
    const part = {
      world: world.world,
      school: space,
      schoolName: school.name,
      assignment: issue.assignment,
      issue: issue.issue,
      teacher,
      version,
      from: world.date,
      once: false,
      sessions: await made(theirs),
      bells,
    };
    if (!isTimetablePart(part)) tooLong.push(teacher);
    else {
      const held = await channelHeld(await joinCode(world.world, desk, issue), batches, ca, kit);
      const standing = [...held].reverse().find((one) => !one.part.once)?.part ?? null;
      const changes = partChanges(standing?.sessions ?? [], part.sessions);
      teachers.push({ teacher, issue, part, changes, first: standing === null, held });
    }
  }
  const changes: PartChange[] = [];
  const keyed = (list: readonly ImportedSession[]) =>
    new Map([...teachersOf(list)].map(([name, theirs]) => [timetableNameKey(name), theirs]));
  const [was, is] = [keyed(kept), keyed(sessions)];
  for (const name of standing === null ? [] : new Set([...was.keys(), ...is.keys()])) {
    changes.push(...partChanges(await made(was.get(name) ?? []), await made(is.get(name) ?? [])));
  }
  const unkept = sessions.length - publishedSessions(sessions).length;
  const { notStaff, twoNames } = now;
  const last = standing === null ? null : { version: standing.version, from: standing.from };
  return { desk, version, standing: last, sessions, changes, teachers, noCode, notStaff, twoNames, tooLong, unkept };
}

/**
 * Publishes a draft: keeps the version in the world's store first, so its
 * number is never used again, then sends a part to each teacher it affects,
 * from `from`, for that day only when `once`, and answers who was sent it.
 */
export async function publishVersion(
  world: VersionWorld,
  draft: Draft,
  choice: { readonly from: Day; readonly once: boolean },
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<SentParts> {
  const { desk } = draft;
  if (choice.once && !oneDayAllowed(draft)) {
    throw failed('A version for one day needs every teacher it changes to hold a standing part', 'E_TIMETABLE_ONCE');
  }
  const ca = await caKey(world.world, send);
  const sessions = publishedSessions(draft.sessions);
  const published = { school: desk.held.school, version: draft.version, ...choice, sessions };
  await world.book.record(world.date, { kind: 'school.timetable', published });
  const [sent, unchanged, failedOnes] = [[] as string[], [] as string[], [] as string[]];
  let problem: unknown = null;
  let key: Promise<Signing> | null = null;
  for (const one of teachersOn(draft, choice)) {
    if (!affected(one)) {
      unchanged.push(one.teacher);
      continue;
    }
    try {
      key ??= signingKey(world.world, desk, ca, kit, send);
      await putPart(await joinCode(world.world, desk, one.issue), { ...one.part, ...choice }, await key, ca, kit, send);
      sent.push(one.teacher);
    } catch (error) {
      failedOnes.push(one.teacher);
      problem = error;
    }
  }
  const { noCode, notStaff, twoNames, tooLong } = draft;
  return { sent, unchanged, noCode, notStaff, twoNames, tooLong, failed: failedOnes, problem };
}

/** The parts a code's channel holds for its teacher. */
async function channelHeld(code: Code, space: Space, ca: string, kit: WorldKit): Promise<SignedPart[]> {
  const batches = space.get(await kitStep(() => channelStream(code, kit.mac))) ?? [];
  const checker = { key: ca, checker: kit };
  const joined = await kitStep(() => readJoined(code, batches, checker, kit.cipher, kit.mac));
  return kitStep(() => channelParts(code, batches, checker, joined?.device ?? null, kit.cipher, kit.mac));
}
