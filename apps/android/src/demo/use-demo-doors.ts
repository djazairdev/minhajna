// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Whether the demo worlds show in the lock's place, and the doors to them
// (#560 and #561, answers 573 and 575). The welcome's and the lock page's
// door is a PC's alone. Help's locks the teacher's history as the automatic
// lock does, keeping the screen to come back to, then shows the entry, so
// no record stays open while a world is. Going back from the entry shows
// what was under it; leaving a world shows the lock, which opens the history
// again on the screen it was on.

import { useCallback, useMemo, useState } from 'react';
import { onPc } from '../text/device-text';

export interface DemoDoors {
  /** True while the demo worlds take the lock's place. */
  readonly shown: boolean;
  readonly gate: (() => void) | null;
  readonly help: (() => void) | null;
  /** Back from the entry, with no world entered. */
  readonly back: () => void;
  /** After a world is left. */
  readonly left: () => void;
}

/** The demo worlds' doors, given whether the app can offer them and how it locks. */
export function useDemoDoors(offered: boolean, lockAway: () => void, lockNow: () => void): DemoDoors {
  const [demo, setDemo] = useState(false);
  const back = useCallback(() => setDemo(false), []);
  const left = useCallback(() => {
    setDemo(false);
    lockNow();
  }, [lockNow]);
  return useMemo(
    () => ({
      shown: demo && offered,
      gate: offered && onPc() ? () => setDemo(true) : null,
      help: offered
        ? () => {
            lockAway();
            setDemo(true);
          }
        : null,
      back,
      left,
    }),
    [demo, offered, lockAway, back, left],
  );
}
