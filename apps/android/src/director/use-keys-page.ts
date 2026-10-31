// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys' state on the director's device (#571, answer 599): on opening, the
// school key is held as D-Issue holds it (started the first time), and the
// facts of the latest keyring this device holds are worked out, again after a
// change with `reload`; a reading that fails keeps the facts read before. The
// recovery just made is kept here, above the tabs, with whether one is being
// made and what was last said of it, so its parts stay until the director says
// both sheets are printed or leaves the page, and coming back to the tab while
// it is made neither makes another nor misses how it ended. A problem is said
// in the catalogue's words; leaving the world drops a slower answer.

import { keysFacts, type KeysFacts } from '@minhajna/core';
import { useCallback, useEffect, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { problemOf } from '../school/school-join-session';
import { holdSchool, type IssueDesk } from './issue-session';
import type { MadeRecovery } from './keys-session';

/** What D-Keys shows. */
export interface KeysPage {
  readonly facts: KeysFacts | null;
  /** The desk the facts come from, to change the keyring. */
  readonly desk: IssueDesk | null;
  readonly busy: boolean;
  /** The catalogue key of the problem, or null. */
  readonly problem: string | null;
  /** Reads the keyring again, after a change. */
  readonly reload: () => void;
  /** The recovery just made, until its sheets are printed. */
  readonly recovery: MadeRecovery | null;
  readonly setRecovery: (recovery: MadeRecovery | null) => void;
  /** Whether a recovery is being made. */
  readonly making: boolean;
  readonly setMaking: (making: boolean) => void;
  /** What was last said of the recovery's making, or null. */
  readonly said: string | null;
  readonly setSaid: (said: string | null) => void;
}

type Read = Pick<KeysPage, 'facts' | 'desk' | 'busy' | 'problem'>;

/** D-Keys' state for an open world's school. */
export function useKeysPage(world: Pick<OpenWorld, 'world' | 'book' | 'date'>, kit: WorldKit, send?: Send): KeysPage {
  const [page, setPage] = useState<Read>({ facts: null, desk: null, busy: true, problem: null });
  const [recovery, setRecovery] = useState<MadeRecovery | null>(null);
  const [making, setMaking] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let open = true;
    void (async () => {
      const desk = await holdSchool(world, kit, send);
      const facts = await keysFacts(desk.opened.ring, desk.held.device, desk.crypto);
      if (open) setPage({ facts, desk, busy: false, problem: null });
    })().catch(
      (error: unknown) => open && setPage((before) => ({ ...before, busy: false, problem: problemOf(error) })),
    );
    return () => {
      open = false;
    };
  }, [world, kit, send, round]);
  const reload = useCallback(() => setRound((one) => one + 1), []);
  return { ...page, reload, recovery, setRecovery, making, setMaking, said, setSaid };
}
