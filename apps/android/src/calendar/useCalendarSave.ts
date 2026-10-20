// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { RecordEvent, State } from '@minhajna/core';
import { useEffect, useRef, useState } from 'react';
import { useAppData } from '../storage/AppData';

/** One queued save at a time; leaving the page cancels navigation, never the write already queued. */
export function useCalendarSave() {
  const data = useAppData();
  const pending = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<'failed' | 'changed' | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const save = async (event: RecordEvent | readonly RecordEvent[], expected: State): Promise<boolean> => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setProblem(null);
    try {
      let queued = data.settled();
      await queued;
      while (queued !== data.settled()) {
        queued = data.settled();
        await queued;
      }
      if (!mounted.current) return false;
      if (data.latestState() !== expected) {
        setProblem('changed');
        return false;
      }
      if (Array.isArray(event)) data.recordAll(event);
      else data.record(event as RecordEvent);
      const saved = await data.allSaved();
      if (!mounted.current) return false;
      if (!saved) setProblem('failed');
      return saved;
    } catch {
      if (mounted.current) setProblem('failed');
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, problem, save, isBusy: () => pending.current };
}
