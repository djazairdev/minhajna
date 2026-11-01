// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys' state on a device of a demo world (#571, answers 599 and 600). A
// device that holds the school key holds it as D-Issue does, following the
// school's stream, and lists the school quietly in its directorate's space
// (school-listing.ts, #593), and the facts of the latest keyring are worked
// out, with whether the recovery's maker is gone, again after a change with
// `reload`; a reading that fails keeps the facts read before. A device that
// holds none chooses: waiting to hold the key another device holds, which a
// wait the store keeps resumes, or, in a world seeded when it started (#548,
// answer 625), taking the school's seeded key, read from the world's seeded
// keys, or else starting the school's key here; a seeded world never offers to
// start a second key, and while the seeded keys are read, when they could not
// be, which choosing null reads again, or on a device that holds none of the
// world's keys, or after a take refused because another device took the key,
// only waiting is offered; a device that takes the seeded key never starts one,
// and one that holds a taken key finishes a take that stopped partway each time
// it holds it. The recovery just made is kept here, above the tabs, with
// whether one is being made and what was last said of it, so its parts stay
// until the director says both sheets are printed or leaves the page, and
// coming back to the tab while it is made neither makes another nor misses how
// it ended. A problem is said in the catalogue's words; leaving the world drops
// a slower answer.

import { keptWaiting, keysFacts, latestHeld, recoveryOrphaned, type DemoSchool, type KeysFacts } from '@minhajna/core';
import type { HeldWorld } from '../demo/world-calendar-read';
import { useCallback, useEffect, useState } from 'react';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { problemOf } from '../school/school-join-session';
import { holdSchool } from './issue-session';
import type { MadeRecovery } from './keys-session';
import { PUBLIC_KEY_BYTES, type IssueDesk } from './school-desk';
import { listQuietly } from './school-listing';
import { seededKeyOf, takeSeededKey, tookSeeded } from './seeded-key';

/** Whether the page opens, asks how to hold the key, waits to be added, or shows the key held. */
export type KeysMode = 'opening' | 'choose' | 'waiting' | 'holder';

/** How a device that holds no key chose to hold one: starting, taking the seeded one or waiting; null before. */
export type KeysChoice = 'start' | 'take' | 'wait' | null;

/** What D-Keys shows. */
export interface KeysPage {
  readonly mode: KeysMode;
  readonly facts: KeysFacts | null;
  /** The desk the facts come from, to change the keyring. */
  readonly desk: IssueDesk | null;
  /** Whether the keyring holds a recovery whose maker no longer holds the key. */
  readonly orphaned: boolean;
  readonly busy: boolean;
  /** The catalogue key of the problem, or null. */
  readonly problem: string | null;
  /** Reads the keyring again, after a change. */
  readonly reload: () => void;
  /** Whether the world holds a seeded key for the school, or null while that is read or when it could not be. */
  readonly seeded: boolean | null;
  /** Starts the school's key here, takes the seeded one, waits to be added, or, with null, reads the store again. */
  readonly choose: (choice: KeysChoice) => void;
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

type Read = Pick<KeysPage, 'mode' | 'facts' | 'desk' | 'orphaned' | 'busy' | 'problem'>;

const OPENING: Read = { mode: 'opening', facts: null, desk: null, orphaned: false, busy: true, problem: null };

/** D-Keys' state for an open world's school. */
export function useKeysPage(
  world: Pick<OpenWorld, 'world' | 'book' | 'date'>,
  school: Pick<DemoSchool, 'id' | 'directorateId' | 'teachers'>,
  held: HeldWorld | null,
  kit: WorldKit,
  send?: Send,
): KeysPage {
  const [page, setPage] = useState<Read>(OPENING);
  const [choice, setChoice] = useState<KeysChoice>(null);
  const [recovery, setRecovery] = useState<MadeRecovery | null>(null);
  const [making, setMaking] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [seeded, setSeeded] = useState<{ held: HeldWorld; school: string; found: boolean } | null>(null);
  const entries = world.book.entries;
  const holding = choice === 'start' || choice === 'take' || latestHeld(entries, PUBLIC_KEY_BYTES) !== null;
  const waiting = choice === 'wait' || keptWaiting(entries, PUBLIC_KEY_BYTES) !== null;
  useEffect(() => {
    if (!holding) return;
    let open = true;
    void (async () => {
      if (choice === 'take' || tookSeeded(world)) await takeSeededKey(world, held, school, kit, send);
      const desk = await holdSchool(world, kit, send, choice !== 'take');
      if (open) listQuietly(world.world, school, desk.held.school, kit, send);
      const facts = await keysFacts(desk.opened.ring, desk.held.device, desk.crypto);
      const orphaned = await recoveryOrphaned(desk.opened.ring, desk.crypto);
      if (open) setPage({ mode: 'holder', facts, desk, orphaned, busy: false, problem: null });
    })().catch((error: unknown) => {
      if (!open) return;
      const problem = problemOf(error);
      const removed = problem === 'demo.keys.removed';
      setPage((before) => ({ ...before, ...(removed && { facts: null, desk: null }), busy: false, problem }));
      if (latestHeld(world.book.entries, PUBLIC_KEY_BYTES) === null) setChoice(null);
    });
    return () => {
      open = false;
    };
  }, [world, school, held, kit, send, round, holding, choice]);
  useEffect(() => {
    if (holding || waiting || held === null) return;
    let open = true;
    seededKeyOf(held, school.id, kit, send).then(
      (found) => {
        if (open) setSeeded({ held, school: school.id, found: found !== null });
      },
      (error: unknown) => {
        if (!open) return;
        setPage((before) => ({ ...before, problem: problemOf(error) }));
      },
    );
    return () => {
      open = false;
    };
  }, [held, school.id, kit, send, holding, waiting, round]);
  const reload = useCallback(() => setRound((one) => one + 1), []);
  const choose = useCallback((one: KeysChoice) => {
    setPage(OPENING);
    setChoice(one);
    setRound((before) => before + 1);
  }, []);
  const mode = waiting ? ('waiting' as const) : ('choose' as const);
  const shown = holding ? page : { ...OPENING, mode, busy: false, problem: page.problem };
  const refused = page.problem === 'demo.keys.start.taken';
  const known = !refused && seeded?.held === held && seeded.school === school.id ? seeded.found : null;
  return { ...shown, seeded: known, reload, choose, recovery, setRecovery, making, setMaking, said, setSaid };
}
