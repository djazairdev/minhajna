// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The shell an app's screens open in (answer 856), which the teacher app and
// the dashboard's reader mode share. Algeria's reference data is read once,
// and in development every problem in it is logged, for whoever keys it. The
// lock's phase comes from the storage module (#210); only once the lock opens
// does the encrypted history (#19) open, and with the reference data it must
// verify before a navigator opens. Unused for the lock's delay, the app closes
// the history and shows the lock; the screens come back as they were after it,
// from a state kept in memory only. The screen guard follows the screen in
// front, and each navigation action raises it before the next screen is drawn.
// Once the lock or the history shows, the platform is told its first screen
// with content is drawn. The caller gives the route a history opens on, and
// the state its navigator starts from when none was kept, as right after the
// first PIN.

import type { RecordBook } from '@minhajna/core';
import type { InitialState, NavigationState } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { guardScreen, useLockSettings } from '../lock/lock-settings';
import { focusedRoute, gateKind, screenKind } from '../lock/screen-guard';
import { useAutoLock } from '../lock/useAutoLock';
import { useLockPhase, type Lock } from '../lock/useLockPhase';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { readReference, type ReferenceFiles, type ReferenceResult } from '../reference';
import { nativeDeps } from '../storage/history';
import { useHistory, type History } from '../storage/use-history';

export type ShellOptions<Route extends string> = {
  readonly files: ReferenceFiles;
  readonly storage: Storage;
  /** Called once, when the first screen with content is drawn. */
  readonly reportDrawn?: () => void;
  /** The route the navigator opens on, for the history as it opened. */
  readonly startRoute: (book: RecordBook) => Route;
  /** The state the navigator starts from when none was kept; `fresh` right after the first PIN. */
  readonly opening?: (book: RecordBook, fresh: boolean) => InitialState | undefined;
};

/** The history open under verified reference data, for the navigator. */
export type OpenShell = {
  readonly book: RecordBook;
  readonly reference: Extract<ReferenceResult, { ok: true }>;
};

export type Shell<Route extends string> = {
  readonly reference: ReferenceResult;
  readonly lock: Lock;
  readonly history: History;
  readonly lockMinutes: number;
  readonly random: ReturnType<typeof nativeDeps>['random'];
  /** The history and the reference data once both are open; null while the lock or a refusal shows. */
  readonly opened: OpenShell | null;
  /** The route the navigator opens on. */
  readonly startRoute: Route | null;
  /** The state the navigator starts from: the one kept behind the lock, or the caller's. */
  readonly firstState: InitialState | undefined;
  /** Locks now, keeping the screen to come back to, as the automatic lock does. */
  readonly lockAway: () => void;
  /** Opens the history again from its start, as after a restore. */
  readonly reopen: () => void;
  /** Raises the screen guard before a navigation action's screen is drawn. */
  readonly raiseGuard: () => void;
  readonly onStateChange: (state: NavigationState | undefined) => void;
};

const noReport = () => undefined;

/** The shell's state, given the reference files, the storage module and where the navigator starts. */
export function useShell<Route extends string>({
  files,
  storage,
  reportDrawn = noReport,
  startRoute,
  opening,
}: ShellOptions<Route>): Shell<Route> {
  const { delayMinutes: lockMinutes } = useLockSettings();
  const reference = useMemo(() => {
    const result = readReference(files);
    if (!result.ok && __DEV__) console.warn('Reference data refused', result.problems);
    if (result.ok && result.refusedPacks > 0 && __DEV__) console.warn('Plan packs refused', result.refusedPacks);
    if (result.ok && result.refusedKeys && __DEV__) console.warn('The trusted key list was refused');
    return result;
  }, [files]);
  const lock = useLockPhase(storage);
  const { phase } = lock;
  const history = useHistory(storage, phase.kind === 'open' ? phase.opening : null);
  const { status, book, broken } = history;
  const random = useMemo(() => nativeDeps(storage).random, [storage]);
  const navigation = useRef<NavigationState | undefined>(undefined);
  const [restore, setRestore] = useState<InitialState | undefined>(undefined);
  const [route, setRoute] = useState<string | undefined>(undefined);
  const firstState = restore ?? (phase.kind === 'open' && book !== null ? opening?.(book, phase.fresh) : undefined);
  const { lockNow, opened } = lock;
  const reopen = useCallback(() => {
    setRoute(undefined);
    opened();
  }, [opened]);
  const lockAway = useCallback(() => {
    setRestore(navigation.current ?? firstState);
    setRoute(undefined);
    lockNow();
  }, [lockNow, firstState]);
  useAutoLock(book !== null || broken !== null, lockMinutes, lockAway);
  const open = phase.kind === 'open' && reference.ok && book !== null;
  const front = route ?? focusedRoute(firstState) ?? (book === null ? undefined : startRoute(book));
  const refused = !reference.ok || phase.kind === 'refused' || status === 'refused';
  const kind = open ? screenKind(front) : broken !== null ? 'records' : gateKind(phase, refused);
  const [actions, setActions] = useState(0);
  const shown = useRef(kind);
  const raiseGuard = useCallback(() => {
    guardScreen(shown.current === 'pin' ? 'pin' : 'records');
    setActions((count) => count + 1);
  }, []);
  useEffect(() => {
    shown.current = kind;
    guardScreen(kind);
  }, [kind, actions]);
  const reported = useRef(false);
  const drawn = phase.kind !== 'checking' && !(phase.kind === 'open' && status === 'opening');
  useEffect(() => {
    if (!drawn || reported.current) return;
    reported.current = true;
    reportDrawn();
  }, [drawn, reportDrawn]);
  const onStateChange = useCallback((state: NavigationState | undefined) => {
    navigation.current = state;
    setRoute(focusedRoute(state));
  }, []);
  return {
    reference,
    lock,
    history,
    lockMinutes,
    random,
    opened: open && reference.ok && book !== null ? { book, reference } : null,
    startRoute: book === null ? null : startRoute(book),
    firstState,
    lockAway,
    reopen,
    raiseGuard,
    onStateChange,
  };
}
