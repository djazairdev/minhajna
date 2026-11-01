// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// M-Grant's state on the directorate's PC (#593, answer 621): the requests the
// directorate made, read as the page opens, again whenever the world's date
// moves, and after each request or sending again, with whether each reached its
// school, whether the school says it made the grant, and whether it lapsed.
// Reading keeps the controls waiting; making a request or sending one again
// says it is sending, so a second press waits; the rows are read again either
// way, so a request kept but not delivered shows, and once it is sent, that is
// said. A problem keeps the rows already read and is said in M-Grant's words
// for a school not listed, a fingerprint no key gives and a request that does
// not read, and in the catalogue's words otherwise. Leaving the page, or the
// world's date moving, drops a slower answer and a problem said for the date
// before.

import type { GrantRequest } from '@minhajna/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { errorCode } from '../lock/lock-rules';
import { problemOf } from '../school/school-join-session';
import { deliverRequest, requestGrant, requestsOf, type GrantForm, type RequestMade } from './request-session';

const GRANT_PROBLEMS = {
  E_GRANT_UNLISTED: 'demo.grant.unlisted',
  E_GRANT_FINGERPRINT: 'demo.grant.noKey',
  E_GRANT_FORM: 'demo.grant.form',
} as const;

/** M-Grant's words for what went wrong. */
export function grantProblem(error: unknown) {
  const code = errorCode(error);
  return code !== undefined && Object.hasOwn(GRANT_PROBLEMS, code)
    ? GRANT_PROBLEMS[code as keyof typeof GRANT_PROBLEMS]
    : problemOf(error);
}

/** What M-Grant shows, and what it can do. */
export interface GrantDesk {
  /** The requests made, or null until first read. */
  readonly rows: readonly RequestMade[] | null;
  /** The rows are being read or a request sent, so the controls wait. */
  readonly busy: boolean;
  /** A request is being made or sent again. */
  readonly sending: boolean;
  readonly problem: ReturnType<typeof grantProblem> | null;
  /** How many requests or sendings again reached the school on this page. */
  readonly sent: number;
  readonly request: (form: GrantForm) => void;
  readonly again: (request: GrantRequest) => void;
}

/** M-Grant's requests for a directorate in an open world. */
export function useGrantDesk(
  world: Pick<OpenWorld, 'world' | 'book' | 'date'>,
  directorate: string,
  kit: WorldKit,
  send?: Send,
): GrantDesk {
  const key = `${world.world}:${world.date}`;
  const [rows, setRows] = useState<readonly RequestMade[] | null>(null);
  const [readFor, setReadFor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<{ key: string; words: NonNullable<GrantDesk['problem']> } | null>(null);
  const [sent, setSent] = useState(0);
  const live = useRef(key);
  const working = useRef(false);
  const refresh = useCallback(
    async (asked: string) => {
      const found = await requestsOf(world, directorate, kit, send);
      if (live.current === asked) setRows(found);
    },
    [world, directorate, kit, send],
  );
  useEffect(() => {
    live.current = key;
    refresh(key)
      .catch((error: unknown) => live.current === key && setProblem({ key, words: grantProblem(error) }))
      .finally(() => live.current === key && setReadFor(key));
    return () => {
      live.current = '';
    };
  }, [key, refresh]);
  const run = (step: () => Promise<unknown>) => {
    if (working.current) return;
    working.current = true;
    const asked = live.current;
    setSending(true);
    setProblem(null);
    void (async () => {
      let failure: unknown = null;
      await step().catch((error: unknown) => {
        failure = error;
      });
      await refresh(asked).catch((error: unknown) => {
        failure ??= error;
      });
      working.current = false;
      setSending(false);
      if (live.current !== asked) return;
      if (failure !== null) setProblem({ key: asked, words: grantProblem(failure) });
      else setSent((one) => one + 1);
    })();
  };
  return {
    rows,
    busy: readFor !== key || sending,
    sending,
    problem: problem?.key === key ? problem.words : null,
    sent,
    request: (form) => run(() => requestGrant(world, directorate, form, kit, send)),
    again: (request) => run(() => deliverRequest(world.world, request, kit, send)),
  };
}
