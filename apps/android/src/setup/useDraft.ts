// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A typed field that is saved once typing pauses, when the field is left, or
// when the screen closes, so nothing typed is lost and the history does not
// take one version per key (PRD §6.8).

import { useCallback, useEffect, useRef, useState } from 'react';

/** How long typing must pause before a field is saved. */
export const TYPING_PAUSE = 600;

export interface Draft {
  readonly value: string;
  readonly change: (value: string) => void;
  /** Saves at once if a change is waiting. */
  readonly flush: () => void;
}

/** Holds a field's text and hands it to `save` after a pause. */
export function useDraft(initial: string, save: (value: string) => void): Draft {
  const [value, setValue] = useState(initial);
  const latest = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(save);
  useEffect(() => {
    saving.current = save;
  });

  const flush = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    saving.current(latest.current);
  }, []);

  useEffect(() => flush, [flush]);

  const change = useCallback(
    (next: string) => {
      latest.current = next;
      setValue(next);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(flush, TYPING_PAUSE);
    },
    [flush],
  );

  return { value, change, flush };
}
