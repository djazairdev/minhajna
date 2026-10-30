// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo worlds on a PC (#560, answers 569, 572 and 573), in place of the
// welcome or the lock page while the teacher's history is shut: the entry
// starts a world or enters one by its code, then the world's own store opens
// and its roles show, then its home. The platform's cryptography comes from
// the PC's start. Each failure says what went wrong in the catalogue's words,
// by its code, and leaves the entry as it was; a code the server no longer
// knows erases what this PC kept for it (world-mode.ts). Leaving shuts the
// network and the world's store, and hands back to the lock, which opens the
// teacher's history again only through its passphrase.

import { readWorldCode, type CountryProfile, type SchoolCalendar, type WorldKind } from '@minhajna/core';
import { useCallback, useRef, useState } from 'react';
import type { Spec as StorageSpec } from '../native/NativeMinhajnaStorage';
import NativeWorld, { type Spec as WorldSpec } from '../native/NativeMinhajnaWorld';
import { currentLanguage, useText } from '../text/i18n';
import { DemoEntry } from './DemoEntry';
import { worldDate } from './world-date';
import { forgetWorld, leaveWorld, openWorld, type OpenWorld, type WorldRole } from './world-mode';
import { joinWorld, moveWorldDate, startWorld, type Send, type WorldKit } from './world-session';
import { WorldHome } from './WorldHome';

type ProblemKey = `demo.problem.${'code' | 'none' | 'busy' | 'offline' | 'lastDay' | 'store' | 'device' | 'other'}`;

/** The catalogue's words for an error's code. */
const PROBLEMS: Readonly<Record<string, ProblemKey>> = {
  E_WORLD_CODE: 'demo.problem.code',
  E_NO_SUCH_WORLD: 'demo.problem.none',
  E_WORLD_BUSY: 'demo.problem.busy',
  E_OFFLINE: 'demo.problem.offline',
  E_TIMEOUT: 'demo.problem.offline',
  E_REFUSED: 'demo.problem.device',
  E_WORLD_KIT: 'demo.problem.device',
  E_NO_WORLD: 'demo.problem.device',
  E_WORLD_LEFT_DAYS: 'demo.problem.lastDay',
  E_WORLD: 'demo.problem.store',
  E_KEY_LOST: 'demo.problem.store',
};

function problemOf(error: unknown): ProblemKey {
  const code = (error as { code?: unknown } | null)?.code;
  return (typeof code === 'string' ? PROBLEMS[code] : undefined) ?? 'demo.problem.other';
}

export type DemoRootProps = {
  readonly kit: WorldKit;
  readonly calendar: SchoolCalendar;
  readonly profile: Pick<CountryProfile, 'months'>;
  readonly storage: Pick<StorageSpec, 'randomBytes' | 'digest'>;
  readonly world?: WorldSpec;
  readonly send?: Send;
  /** Back to the page the entry came from, with no world entered. */
  readonly onBack: () => void;
  /** After leaving a world: the lock checks the teacher's history again. */
  readonly onLeft: () => void;
};

/** The demo worlds' pages, from the entry to a world's home. */
export function DemoRoot({
  kit,
  calendar,
  profile,
  storage,
  world = NativeWorld,
  send,
  onBack,
  onLeft,
}: DemoRootProps) {
  const t = useText();
  const [open, setOpen] = useState<OpenWorld | null>(null);
  const [role, setRole] = useState<WorldRole | null>(null);
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

  const start = (kind: WorldKind) =>
    run(async () => {
      const started = await startWorld(kind, calendar, kit, send);
      const found = { world: started.keys.world, kind, code: started.code, date: started.date };
      setOpen(await openWorld({ ...found, starter: started.starter }, storage, world));
    });

  const join = (typed: string) =>
    run(async () => {
      const read = readWorldCode(typed);
      const joined = await joinWorld(typed, kit, send).catch(async (error: unknown) => {
        const gone = (error as { code?: unknown } | null)?.code === 'E_NO_SUCH_WORLD';
        if (gone && 'code' in read) await forgetWorld(read.code, storage, world).catch(() => undefined);
        throw error;
      });
      const code = 'code' in read ? read.code : typed;
      const found = { world: joined.keys.world, kind: joined.keys.kind, code, date: joined.date };
      setOpen(await openWorld({ ...found, starter: null }, storage, world));
    });

  const move = () =>
    run(async () => {
      if (open?.starter == null) return;
      const date = await moveWorldDate(open.world, open.starter, open.date, send);
      setOpen({ ...open, date });
    });

  const leave = () =>
    run(async () => {
      await leaveWorld(world);
      setOpen(null);
      setRole(null);
      onLeft();
    });

  const shown = problem === null ? null : t(problem);
  if (open === null) return <DemoEntry busy={busy} problem={shown} onStart={start} onJoin={join} onBack={onBack} />;
  return (
    <WorldHome
      world={open}
      date={worldDate(t, open.date, currentLanguage(), profile)}
      role={role}
      moving={busy}
      problem={shown}
      onRole={setRole}
      onMove={move}
      onLeave={leave}
    />
  );
}
