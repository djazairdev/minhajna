// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The inspectors' access on the director's PC (#593, answer 621): the requests
// addressed to this device and the grants made for them (grant-session.ts),
// read as the page opens, again whenever the world's date moves or the page is
// read again, and after each approval or finishing; once read, the school is
// listed in its directorate's space in the background, as D-Issue and D-Keys
// list it, so a listing that failed or was pointed elsewhere is put back.
// Reading keeps the controls waiting; approving or finishing a grant says it is
// working, so a second press waits, and the rows are read again either way. A
// problem keeps the rows already read and is said in the access page's words
// for a request gone, lapsed, with a wrong fingerprint or with no signed week,
// and in the catalogue's otherwise. Leaving the page, or the world's date
// moving, drops a slower answer and a problem said for the date before, and
// reading the page again while a grant is made drops its saying, the rows read
// again showing how it went.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Send, WorldKit } from '../demo/world-session';
import { errorCode } from '../lock/lock-rules';
import { problemOf } from '../school/school-join-session';
import { approveGrant } from './grant-make';
import { readGrants, type AskedGrant, type GrantSchool, type GrantWorld } from './grant-session';
import { listQuietly } from './school-listing';

const ACCESS_PROBLEMS = {
  E_GRANT_GONE: 'demo.access.gone',
  E_GRANT_LAPSED: 'demo.access.lapsedRefused',
  E_GRANT_FINGERPRINT: 'demo.access.wrongPrint',
  E_GRANT_NO_WEEKS: 'demo.access.noWeeks',
} as const;

/** The access page's words for what went wrong with a grant. */
export function accessProblem(error: unknown) {
  const code = errorCode(error);
  return code !== undefined && Object.hasOwn(ACCESS_PROBLEMS, code)
    ? ACCESS_PROBLEMS[code as keyof typeof ACCESS_PROBLEMS]
    : problemOf(error);
}

/** What the inspectors' access shows, and what it can do. */
export interface GrantAccess {
  /** The requests addressed to this device, or null until first read. */
  readonly asked: readonly AskedGrant[] | null;
  /** The rows are being read or a grant made, so the controls wait. */
  readonly busy: boolean;
  /** A grant is being made or finished. */
  readonly working: boolean;
  readonly problem: ReturnType<typeof accessProblem> | null;
  /** The last approval or sending again that went through on this page, counted, or null before any. */
  readonly done: { readonly count: number; readonly made: boolean } | null;
  readonly approve: (request: string, fingerprint: string) => void;
  /** Finishes a grant the school recorded, without its fingerprint. */
  readonly finish: (request: string) => void;
}

/** The inspectors' access for a school in an open world. */
export function useGrantAccess(
  world: GrantWorld,
  school: GrantSchool & { readonly id: string },
  kit: WorldKit,
  send?: Send,
  round = 0,
): GrantAccess {
  const key = `${world.world}:${world.date}:${round}`;
  const [asked, setAsked] = useState<readonly AskedGrant[] | null>(null);
  const [readFor, setReadFor] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<{ key: string; words: NonNullable<GrantAccess['problem']> } | null>(null);
  const [done, setDone] = useState<GrantAccess['done']>(null);
  const live = useRef(key);
  const going = useRef(false);
  const refresh = useCallback(
    async (at: string) => {
      const found = await readGrants(world, school, kit, send);
      listQuietly(world.world, school, found.desk.held.school, kit, send);
      if (live.current === at) setAsked(found.asked);
    },
    [world, school, kit, send],
  );
  useEffect(() => {
    live.current = key;
    refresh(key)
      .catch((error: unknown) => live.current === key && setProblem({ key, words: accessProblem(error) }))
      .finally(() => live.current === key && setReadFor(key));
    return () => {
      live.current = '';
    };
  }, [key, refresh]);
  const run = (step: () => Promise<unknown>, made: boolean) => {
    if (going.current) return;
    going.current = true;
    const at = live.current;
    setWorking(true);
    setProblem(null);
    void (async () => {
      let failure: unknown = null;
      await step().catch((error: unknown) => {
        failure = error;
      });
      await refresh(at).catch((error: unknown) => {
        failure ??= error;
      });
      going.current = false;
      setWorking(false);
      if (live.current !== at) return;
      if (failure !== null) setProblem({ key: at, words: accessProblem(failure) });
      else setDone((before) => ({ count: (before?.count ?? 0) + 1, made }));
    })();
  };
  return {
    asked,
    busy: readFor !== key || working,
    working,
    problem: problem?.key === key ? problem.words : null,
    done,
    approve: (request, fingerprint) => run(() => approveGrant(world, school, request, fingerprint, kit, send), true),
    finish: (request) => run(() => approveGrant(world, school, request, '', kit, send), false),
  };
}
