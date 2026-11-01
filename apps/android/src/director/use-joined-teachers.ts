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
// answer.

import { issuesIn, joinedKey, latestHeld, type DemoSchool, type DemoTeacher } from '@minhajna/core';
import { useCallback, useEffect, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { problemOf } from '../school/school-join-session';
import { assignmentsOf, holdSchool, joinedDays } from './issue-session';
import { PUBLIC_KEY_BYTES } from './school-desk';

type JoinedWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** The catalogue key of a reading that failed. */
export type JoinedProblem = ReturnType<typeof problemOf>;

/** What the page says while who joined is not known: no key held, or being read. */
export type JoinedNote = 'demo.dashboard.noKey' | 'demo.dashboard.reading';

/** The teachers read as joined, what is said while that is not known, and why the reading failed. */
export interface JoinedRead {
  readonly joined: ReadonlySet<string>;
  readonly note: JoinedNote | null;
  readonly problem: JoinedProblem | null;
  /** Reads who joined again. */
  readonly again: () => void;
}

const NONE: ReadonlySet<string> = new Set();

/** The IDs of the school's teachers that joined on a code or key this device issued them. */
export async function joinedTeachers(
  world: JoinedWorld,
  teachers: readonly DemoTeacher[],
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<ReadonlySet<string>> {
  const desk = await holdSchool(world, kit, send, false);
  const issues = issuesIn(world.book.entries, desk.held.school);
  const days = await joinedDays(world.world, desk, issues, kit, send);
  const joined = new Set(
    issues.filter((one) => days.has(joinedKey(one.assignment, one.issue))).map((one) => one.assignment),
  );
  const assignments = await assignmentsOf(desk, teachers, kit);
  return new Set(teachers.filter((one) => joined.has(assignments.get(one.id) ?? '')).map((one) => one.id));
}

type Read = { readonly world: string; readonly school: string; readonly round: number } & (
  { readonly joined: ReadonlySet<string> } | { readonly problem: JoinedProblem }
);

/** Which of the school's teachers have joined, read again when the world changes or with `again`. */
export function useJoinedTeachers(
  world: JoinedWorld,
  school: Pick<DemoSchool, 'id' | 'teachers'>,
  kit: WorldKit,
  send?: Send,
): JoinedRead {
  const holding = latestHeld(world.book.entries, PUBLIC_KEY_BYTES) !== null;
  const [read, setRead] = useState<Read | null>(null);
  const [round, setRound] = useState(0);
  const again = useCallback(() => setRound((one) => one + 1), []);
  useEffect(() => {
    if (!holding) return;
    let open = true;
    const of = { world: world.world, school: school.id, round };
    joinedTeachers(world, school.teachers, kit, send).then(
      (joined) => {
        if (open) setRead({ ...of, joined });
      },
      (error: unknown) => {
        if (open) setRead({ ...of, problem: problemOf(error) });
      },
    );
    return () => {
      open = false;
    };
  }, [world, school, kit, send, holding, round]);
  const none = { joined: NONE, problem: null, again };
  if (!holding) return { ...none, note: 'demo.dashboard.noKey' };
  if (read?.world !== world.world || read.school !== school.id || read.round !== round) {
    return { ...none, note: 'demo.dashboard.reading' };
  }
  if ('problem' in read) return { ...none, note: null, problem: read.problem };
  return { ...none, joined: read.joined, note: null };
}
