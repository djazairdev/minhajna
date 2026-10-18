// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Choosing the PIN at first use (#210), on the Lock design's board: the PIN
// twice, then the native module seals the history's key under it. A history
// from 0.1.0 keeps its key and its records; the board says so. No class list
// can come in before this, as setup starts after it (choice P2, #252).

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler } from 'react-native';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { useText } from '../text/i18n';
import { LockBoard } from './LockBoard';
import { PIN_LENGTH, errorCode, typed } from './lock-rules';
import { PinPad } from './PinPad';

export type CreatePinProps = {
  readonly storage: Storage;
  /** A history from before the lock is already on this phone. */
  readonly upgrade: boolean;
  readonly lockMinutes: number;
  /** The history is open under the new PIN, which the fingerprint question may need once. */
  readonly onCreated: (pin: string) => void;
  readonly onRefused: (error: unknown) => void;
  /** The PIN did not save, but the native module may have kept it: shows the lock if so. */
  readonly onFailed?: () => void;
  /** Android's Back from the first step, back to the welcome; Back from the second step starts again. */
  readonly onBack?: () => void;
};

/** Asks for a new PIN twice, and seals the history's key under it. */
export function CreatePin({ storage, upgrade, lockMinutes, onCreated, onRefused, onFailed, onBack }: CreatePinProps) {
  const t = useText();
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<'mismatch' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const entered = useRef('');
  const chosen = useRef<string | null>(null);

  const show = (value: string) => {
    entered.current = value;
    setPin(value);
  };
  const choose = (value: string | null) => {
    chosen.current = value;
    setFirst(value);
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) return true;
      if (chosen.current !== null) {
        chosen.current = null;
        entered.current = '';
        setFirst(null);
        setPin('');
        setMessage(null);
        return true;
      }
      if (onBack === undefined) return false;
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [busy, onBack]);

  const create = (fresh: string) => {
    submitting.current = true;
    setBusy(true);
    storage.createLock(fresh).then(
      () => {
        if (mounted.current) onCreated(fresh);
      },
      (error: unknown) => {
        if (!mounted.current) return;
        if (errorCode(error) === 'E_KEY_LOST') {
          onRefused(error);
          return;
        }
        if (__DEV__) console.warn('The PIN did not save', errorCode(error));
        submitting.current = false;
        setBusy(false);
        show('');
        choose(null);
        setMessage('failed');
        onFailed?.();
      },
    );
  };

  const onDigit = (digit: string) => {
    if (busy || submitting.current) return;
    const next = typed(entered.current, digit);
    setMessage(null);
    if (next.length < PIN_LENGTH) {
      show(next);
      return;
    }
    show('');
    if (chosen.current === null) {
      choose(next);
      AccessibilityInfo.announceForAccessibility(t('lock.create.repeat'));
    } else if (chosen.current === next) {
      show(next);
      create(next);
    } else {
      choose(null);
      setMessage('mismatch');
    }
  };

  return (
    <LockBoard
      prompt={first === null ? t('lock.create.title') : t('lock.create.repeat')}
      message={
        message === 'mismatch' ? t('lock.create.mismatch') : message === 'failed' ? t('lock.create.failed') : undefined
      }
      detail={upgrade ? t('lock.create.upgrade') : undefined}
      footer={`${t('lock.create.line')} ${t('lock.footer', { count: lockMinutes })}`}
    >
      <PinPad
        length={pin.length}
        onDigit={onDigit}
        onDelete={() => show(entered.current.slice(0, -1))}
        disabled={busy}
      />
    </LockBoard>
  );
}
