// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Focus going back to the row that opened a page (#622, answer 698): an
// insights page stays mounted but hidden under the page it opens, so its row is
// there to take focus on the frame after that page closes, and its scroll
// stays.

import { useLayoutEffect, useRef } from 'react';
import type { ViewInstance } from 'react-native';
import { focusTarget } from '../components/sheet-focus';

/** A ref for each row by its key, and focus back to the row whose key `opened` held, once it is null again. */
export function useReturnFocus(opened: string | null): (key: string) => (node: ViewInstance | null) => void {
  const rows = useRef(new Map<string, ViewInstance>());
  const left = useRef<string | null>(null);
  useLayoutEffect(() => {
    const from = left.current;
    left.current = opened;
    if (opened !== null || from === null) return;
    const frame = requestAnimationFrame(() => focusTarget(rows.current.get(from) ?? null));
    return () => cancelAnimationFrame(frame);
  }, [opened]);
  return (key: string) => (node: ViewInstance | null) => {
    if (node === null) rows.current.delete(key);
    else rows.current.set(key, node);
  };
}
