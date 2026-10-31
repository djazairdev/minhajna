// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys' state on the director's device (#571, answer 599): on opening, the
// school key is held as D-Issue holds it (started the first time), and the
// facts of the latest keyring this device holds are worked out. A problem is
// said in the catalogue's words; leaving the world drops a slower answer.

import { keysFacts, type KeysFacts } from '@minhajna/core';
import { useEffect, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { problemOf } from '../school/school-join-session';
import { holdSchool } from './issue-session';

/** What D-Keys shows. */
export interface KeysPage {
  readonly facts: KeysFacts | null;
  readonly busy: boolean;
  /** The catalogue key of the problem, or null. */
  readonly problem: string | null;
}

/** D-Keys' state for an open world's school. */
export function useKeysPage(world: Pick<OpenWorld, 'world' | 'book' | 'date'>, kit: WorldKit, send?: Send): KeysPage {
  const [page, setPage] = useState<KeysPage>({ facts: null, busy: true, problem: null });
  useEffect(() => {
    let open = true;
    void (async () => {
      const desk = await holdSchool(world, kit, send);
      const facts = await keysFacts(desk.opened.ring, desk.held.device, desk.crypto);
      if (open) setPage({ facts, busy: false, problem: null });
    })().catch((error: unknown) => open && setPage({ facts: null, busy: false, problem: problemOf(error) }));
    return () => {
      open = false;
    };
  }, [world, kit, send]);
  return page;
}
