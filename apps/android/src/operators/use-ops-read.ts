// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How the operators' pages read the demo server (#618, #619): once as the
// page opens, and again on asking after a problem, which is kept in the
// catalogue's words; reading again is offered only once a reading failed, so
// one reading is on its way at a time. Nothing is kept once the page closes.

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { problemOf } from '../school/school-join-session';

/** What a page read, a problem reading it, and a way to read again. */
export function useOpsRead<T>(read: () => Promise<T>) {
  const [value, setValue] = useState<T | null>(null);
  const [problem, setProblem] = useState<ReturnType<typeof problemOf> | null>(null);
  const mounted = useRef(true);
  const load = () =>
    read().then(
      (got) => {
        if (mounted.current) setValue(() => got);
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
    setValue(null);
    void load();
  };
  return { value, problem, reading: value === null && problem === null, reload };
}
