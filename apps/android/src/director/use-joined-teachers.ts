// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which of a school's teachers have joined its space, for the director's
// dashboard (#569, #548, answer 625): a teacher has joined once any code or
// security key this device issued them was joined on, whatever came after,
// since the phone or key that joined keeps its place in the space and D-Issue
// issues again only codes never joined, read from the school's space as the
// codes page reads it (issue-session.ts), so a seeded teacher, who joined when
// the world started, reads joined once the device took the seeded key, and a
// teacher sent a new code after joining still reads joined. Only a device that
// holds the school key can read it: otherwise the page says how to hold it, and
// while it is read, or when the reading failed, it says that, in the
// catalogue's words, with no teacher read as joined. It is read when the page
// opens or the world changes, and again when asked, so a teacher who joins
// meanwhile reads joined then. Leaving the world or the school drops a slower
// answer. The same reading, the school key held once, gives each class's
// standing from the school's signed weeks (course-standings.ts, answer 627),
// none while it is read; when only the weeks could not be read, who joined is
// still given, with no standing and the problem said. Once the weeks are read,
// the school's share of the totals is sent for the announced days reached
// (share-send.ts), and the cut rooms of the school exams whose figures day it
// reached are opened (room-open.ts, answer 632), and those of exams past handed
// to every teacher of their subject and grade (answer 634), the one whatever
// the other did, after the page has what it reads, then the rooms read for the
// thresholds card (school-rooms.ts, answer 637), none while they are not; a
// failed send, a room that failed or a failed reading of the rooms is not said,
// and is tried again with the next reading.

import {
  issuesIn,
  joinedKey,
  latestHeld,
  type CourseStanding,
  type DemoSchool,
  type DemoTeacher,
} from '@minhajna/core';
import { useCallback, useEffect, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { problemOf } from '../school/school-join-session';
import { courseStandings } from './course-standings';
import { assignmentsOf, holdSchool, joinedDays } from './issue-session';
import { recordsOf, type ClassRecords } from './records-session';
import { PUBLIC_KEY_BYTES, type IssueDesk } from './school-desk';
import type { TermReference } from './seeded-fill';
import { sendShares } from './share-send';
import { openRooms } from '../threshold/room-open';
import { readSchoolRooms, type SchoolRoom } from '../threshold/school-rooms';

type JoinedWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** The catalogue key of a reading that failed. */
export type JoinedProblem = ReturnType<typeof problemOf>;

/** What the page says while who joined is not known: no key held, or being read. */
export type JoinedNote = 'demo.dashboard.noKey' | 'demo.dashboard.reading';

/** The teachers read as joined, what is said while that is not known, why the reading failed, and the exam rooms. */
export interface JoinedRead {
  readonly joined: ReadonlySet<string>;
  readonly note: JoinedNote | null;
  readonly problem: JoinedProblem | null;
  /** A class and subject's standing from its signed weeks, or null without one. */
  readonly standing: (classId: string, subject: string) => CourseStanding | null;
  /** Reads who joined again. */
  readonly again: () => void;
  /** The school exams' rooms read once this reading opened them (school-rooms.ts), or null while they are not. */
  readonly rooms: readonly SchoolRoom[] | null;
}

const NONE: ReadonlySet<string> = new Set();
const NO_STANDING = () => null;

/** The IDs of the school's teachers that joined on a code or key this device issued them. */
export async function joinedTeachers(
  world: JoinedWorld,
  teachers: readonly DemoTeacher[],
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<ReadonlySet<string>> {
  return joinedOn(world, await holdSchool(world, kit, send, false), teachers, kit, send);
}

/** The IDs of the school's teachers that joined, with the school key as held. */
async function joinedOn(
  world: JoinedWorld,
  desk: IssueDesk,
  teachers: readonly DemoTeacher[],
  kit: WorldKit,
  send: Send,
): Promise<ReadonlySet<string>> {
  const issues = issuesIn(world.book.entries, desk.held.school);
  const days = await joinedDays(world.world, desk, issues, kit, send);
  const joined = new Set(
    issues.filter((one) => days.has(joinedKey(one.assignment, one.issue))).map((one) => one.assignment),
  );
  const assignments = await assignmentsOf(desk, teachers, kit);
  return new Set(teachers.filter((one) => joined.has(assignments.get(one.id) ?? '')).map((one) => one.id));
}

type Found = Pick<JoinedRead, 'joined' | 'standing' | 'problem'> & {
  readonly sharing?: () => Promise<readonly SchoolRoom[]>;
};
type Read = { readonly world: string; readonly school: string; readonly round: number } & (
  Found | { readonly problem: JoinedProblem }
);

/** Which of the school's teachers have joined, read again when the world changes or with `again`. */
export function useJoinedTeachers(
  world: JoinedWorld,
  school: DemoSchool,
  reference: TermReference,
  kit: WorldKit,
  send: Send = worldRequest,
): JoinedRead {
  const holding = latestHeld(world.book.entries, PUBLIC_KEY_BYTES) !== null;
  const [read, setRead] = useState<Read | null>(null);
  const [round, setRound] = useState(0);
  const [rooms, setRooms] = useState<{ key: string; rooms: readonly SchoolRoom[] } | null>(null);
  const roomsKey = JSON.stringify([world.world, world.date, school.id, round]);
  const again = useCallback(() => setRound((one) => one + 1), []);
  useEffect(() => {
    if (!holding) return;
    let open = true;
    const of = { world: world.world, school: school.id, round };
    const reading = async (): Promise<Found> => {
      const desk = await holdSchool(world, kit, send, false);
      const joined = await joinedOn(world, desk, school.teachers, kit, send);
      try {
        const records: ClassRecords[] = await recordsOf(world, desk, school, kit, send);
        const sharing = () =>
          Promise.allSettled([
            sendShares(world, desk, school, records, reference, kit, send),
            openRooms(world, desk, school, records, reference, kit, send),
          ]).then(() => readSchoolRooms(world, desk, school, reference, kit, send));
        return { joined, standing: courseStandings(records, school, reference), problem: null, sharing };
      } catch (error) {
        return { joined, standing: NO_STANDING, problem: problemOf(error) };
      }
    };
    reading().then(
      ({ sharing, ...found }) => {
        if (!open) return;
        setRead({ ...of, ...found });
        sharing?.().then(
          (held) => open && setRooms({ key: roomsKey, rooms: held }),
          () => undefined,
        );
      },
      (error: unknown) => {
        if (open) setRead({ ...of, problem: problemOf(error) });
      },
    );
    return () => {
      open = false;
    };
  }, [world, school, reference, kit, send, holding, round, roomsKey]);
  const none = {
    joined: NONE,
    standing: NO_STANDING,
    problem: null,
    again,
    rooms: rooms?.key === roomsKey ? rooms.rooms : null,
  };
  if (!holding) return { ...none, note: 'demo.dashboard.noKey' };
  if (read?.world !== world.world || read.school !== school.id || read.round !== round) {
    return { ...none, note: 'demo.dashboard.reading' };
  }
  if (!('joined' in read)) return { ...none, note: null, problem: read.problem };
  return { ...none, joined: read.joined, standing: read.standing, problem: read.problem, note: null };
}
