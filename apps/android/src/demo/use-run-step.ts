// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One step at a time on the demo worlds' pages (DemoRoot.tsx): a step asked for
// while another runs is passed over; while one runs the page shows busy, and a
// step that fails leaves the problem in the catalogue's words, by its code
// (world-problems.ts), until the next step starts.

import { useCallback, useRef, useState } from 'react';
import { problemOf, type ProblemKey } from './world-problems';

/** The step running, if any, whether the page is busy, the last step's problem, and how to run a step. */
export function useRunStep() {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ProblemKey | null>(null);
  const working = useRef(false);
  const run = useCallback((step: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setProblem(null);
    step()
      .catch((error: unknown) => setProblem(problemOf(error)))
      .finally(() => {
        working.current = false;
        setBusy(false);
      });
  }, []);
  return { busy, problem, working, run };
}
