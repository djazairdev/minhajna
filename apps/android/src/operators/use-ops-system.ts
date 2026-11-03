// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What Ops-Console reads (#618, answer 655): the server's description as the
// page opens, and again on asking after a problem, which is kept in the
// catalogue's words; reading again is offered only once a reading failed, so
// one reading is on its way at a time. Nothing is kept once the page closes.

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { problemOf } from '../school/school-join-session';
import { readSystem, type SystemView } from './ops-system';

/** The server's description, a problem reading it, and a way to read again. */
export function useOpsSystem(world: Pick<OpenWorld, 'world'>, send: Send = worldRequest) {
  const [view, setView] = useState<SystemView | null>(null);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const mounted = useRef(true);
  const load = () =>
    readSystem(world.world, send).then(
      (got) => {
        if (mounted.current) setView(got);
      },
      (error: unknown) => {
        if (mounted.current) setProblem(problemOf(error));
      },
    );
  const first = useEffectEvent(() => void load());
  useEffect(() => {
    mounted.current = true;
    first();
    return () => {
      mounted.current = false;
    };
  }, []);
  const reload = () => {
    setProblem(null);
    setView(null);
    void load();
  };
  return { view, problem, reading: view === null && problem === null, reload };
}
