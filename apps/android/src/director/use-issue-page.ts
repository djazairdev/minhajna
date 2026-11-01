// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Issue's state on the director's device (#570, answers 598 and 601): on
// opening, the school key is held, never started here, since D-Keys asks
// whether to start it or wait to hold another device's, and each teacher's
// assignment worked out; the joined days are then read from the school's space,
// again with `refresh`, and the school listed quietly in its directorate's
// space as the key is held and on each refresh (school-listing.ts, #593). The
// rows follow the world's store, so each issue recorded shows at once, waiting
// to be scanned, and codes issued again under a new epoch are counted for the
// page to say. A problem keeps what the page already shows and is said in the
// catalogue's words, the page's own failures, such as printing, as well. While
// an issue is recorded the page says it is busy, so a second tap waits. Leaving
// the world, or another world opening, drops what a slower answer brings back.

import {
  issueRows,
  keptIssues,
  type Day,
  type DemoSchool,
  type DemoTeacher,
  type IssueRow,
  type KeptIssue,
} from '@minhajna/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { problemOf } from '../school/school-join-session';
import { assignmentsOf, holdSchool, issueFor, joinedDays, type IssueDesk } from './issue-session';
import { listQuietly } from './school-listing';

/** What D-Issue shows, and what it can do. */
export interface IssuePage {
  /** The desk to issue from, once the school key is held. */
  readonly desk: IssueDesk | null;
  readonly rows: readonly IssueRow[];
  readonly busy: boolean;
  /** An issue is being recorded. */
  readonly issuing: boolean;
  /** The catalogue key of the last problem, or null. */
  readonly problem: string | null;
  /** How many codes not yet scanned were last issued again under a new epoch, to print or show again. */
  readonly reissued: number;
  /** Issues the next code or key for a teacher, and answers it as kept, or null after a problem. */
  readonly issue: (teacher: DemoTeacher, access: 'phone' | 'key') => Promise<KeptIssue | null>;
  readonly refresh: () => void;
  /** Says a problem of the page's own, such as a print that failed. */
  readonly fail: (error: unknown) => void;
}

type Naming = Parameters<typeof issueRows>[5];

/** D-Issue's state for an open world's school. */
export function useIssuePage(
  world: Pick<OpenWorld, 'world' | 'book' | 'date'>,
  school: Pick<DemoSchool, 'id' | 'directorateId' | 'teachers'>,
  naming: Naming,
  kit: WorldKit,
  send?: Send,
): IssuePage {
  const [desk, setDesk] = useState<{ desk: IssueDesk; assignments: ReadonlyMap<string, string> } | null>(null);
  const [joined, setJoined] = useState<ReadonlyMap<string, Day>>(new Map());
  const [busy, setBusy] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const recording = useRef(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [reissued, setReissued] = useState(0);
  const [, setKept] = useState(0);
  const live = useRef<string | null>(null);
  useEffect(() => {
    live.current = world.world;
    return () => {
      live.current = null;
    };
  }, [world.world]);

  const read = useCallback(
    async (held: IssueDesk) => {
      const issues = keptIssues(world.book.entries, held.held.school).values();
      const days = await joinedDays(world.world, held, issues, kit, send);
      if (live.current === world.world) setJoined(days);
    },
    [world, kit, send],
  );

  useEffect(() => {
    let open = true;
    void (async () => {
      const held = await holdSchool(world, kit, send, false);
      const assignments = await assignmentsOf(held, school.teachers, kit);
      if (!open) return;
      setDesk({ desk: held, assignments });
      setReissued(held.reissued);
      listQuietly(world.world, school, held.held.school, kit, send);
      await read(held);
    })()
      .catch((error: unknown) => open && setProblem(problemOf(error)))
      .finally(() => open && setBusy(false));
    return () => {
      open = false;
    };
  }, [world, school, kit, send, read]);

  const refresh = () => {
    if (desk === null) return;
    setBusy(true);
    setProblem(null);
    const asked = world.world;
    listQuietly(world.world, school, desk.desk.held.school, kit, send);
    void read(desk.desk)
      .catch((error: unknown) => live.current === asked && setProblem(problemOf(error)))
      .finally(() => live.current === asked && setBusy(false));
  };

  const issue = async (teacher: DemoTeacher, access: 'phone' | 'key') => {
    const assignment = desk?.assignments.get(teacher.id);
    if (desk === null || assignment === undefined || recording.current) return null;
    recording.current = true;
    setProblem(null);
    setIssuing(true);
    try {
      const { kept, desk: followed, reissued: again } = await issueFor(world, desk.desk, assignment, access, kit, send);
      setDesk({ desk: followed, assignments: desk.assignments });
      if (again > 0) setReissued(again);
      setKept((count) => count + 1);
      return kept;
    } catch (error) {
      setProblem(problemOf(error));
      return null;
    } finally {
      recording.current = false;
      setIssuing(false);
    }
  };
  const fail = useCallback((error: unknown) => setProblem(problemOf(error)), []);

  const rows =
    desk === null
      ? []
      : issueRows(
          school.teachers,
          desk.assignments,
          keptIssues(world.book.entries, desk.desk.held.school),
          joined,
          world.date,
          naming,
        );
  return { desk: desk?.desk ?? null, rows, busy, issuing, problem, reissued, issue, refresh, fail };
}
