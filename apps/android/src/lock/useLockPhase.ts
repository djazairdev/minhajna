// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the app stands with its lock (#210), from the native module's own
// status at start: a fresh install shows the welcome, then the first PIN; a
// history from 0.1.0 asks for a PIN at once; a set PIN shows the lock. A
// history the module still holds open, as when Android closed the screen
// but kept the app, is locked first: every start asks for the PIN. The
// history opens only in the open phase, and every new open counts up, so
// the record book is read again from the store after each unlock.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { errorCode } from './lock-rules';

export type LockPhase =
  | { readonly kind: 'checking' }
  | { readonly kind: 'welcome' }
  | { readonly kind: 'create'; readonly upgrade: boolean }
  | { readonly kind: 'ask'; readonly pin: string; readonly upgrade: boolean }
  | { readonly kind: 'locked'; readonly biometric: boolean; readonly waitSeconds: number }
  | { readonly kind: 'open'; readonly fresh: boolean; readonly opening: number }
  | { readonly kind: 'refused' };

export type Lock = {
  readonly phase: LockPhase;
  /** From the welcome to the first PIN, and back. */
  readonly start: () => void;
  readonly back: () => void;
  readonly created: (pin: string, upgrade: boolean) => void;
  /** The fingerprint question is answered, either way. */
  readonly asked: (upgrade: boolean) => void;
  readonly opened: () => void;
  readonly refused: (error: unknown) => void;
  /** Closes the history and shows the lock. */
  readonly lockNow: () => void;
  /** After a first PIN failed to save: shows the lock if the native module kept it after all. */
  readonly recheck: () => void;
};

/** The lock's phase and the moves between them; the native module keeps everything that must survive a reload. */
export function useLockPhase(storage: Storage): Lock {
  const [phase, setPhase] = useState<LockPhase>({ kind: 'checking' });
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const openings = useRef(0);
  const current = useRef(true);

  const open = useCallback((fresh: boolean) => {
    openings.current += 1;
    setPhase({ kind: 'open', fresh, opening: openings.current });
  }, []);

  const refused = useCallback((error: unknown) => {
    if (__DEV__) console.warn('History refused', errorCode(error) ?? error);
    if (current.current) setPhase({ kind: 'refused' });
  }, []);

  const check = useCallback(
    (keepSetup = false) => {
      const read = (retried: boolean): Promise<void> =>
        storage.lockStatus().then((status) => {
          if (!current.current) return;
          setBiometricAvailable(status.biometricAvailable);
          if (status.state === 'open' && retried) {
            refused(new Error('The history stayed open after it was locked'));
          } else if (status.state === 'open') {
            storage.lockHistory().then(() => read(true), refused);
          } else if (status.state === 'locked') {
            setPhase({ kind: 'locked', biometric: status.biometric, waitSeconds: status.waitSeconds });
          } else if (!keepSetup) {
            setPhase(status.hasHistory ? { kind: 'create', upgrade: true } : { kind: 'welcome' });
          }
        }, refused);
      void read(false);
    },
    [storage, refused],
  );

  useEffect(() => {
    current.current = true;
    check(false);
    return () => {
      current.current = false;
    };
  }, [check]);

  const lockNow = useCallback(() => {
    setPhase({ kind: 'checking' });
    storage.lockHistory().then(() => check(false), refused);
  }, [storage, check, refused]);

  return {
    phase,
    start: useCallback(() => setPhase({ kind: 'create', upgrade: false }), []),
    back: useCallback(() => setPhase({ kind: 'welcome' }), []),
    created: useCallback(
      (pin: string, upgrade: boolean) =>
        biometricAvailable ? setPhase({ kind: 'ask', pin, upgrade }) : open(!upgrade),
      [biometricAvailable, open],
    ),
    asked: useCallback((upgrade: boolean) => open(!upgrade), [open]),
    opened: useCallback(() => open(false), [open]),
    refused,
    lockNow,
    recheck: useCallback(() => check(true), [check]),
  };
}
