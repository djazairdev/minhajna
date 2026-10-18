// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The lock screen (Lock, #210). The fourth digit sends the PIN to the
// native module, which counts wrong tries and keeps the wait, so a reload
// resets nothing. Where the teacher turned it on, the phone's fingerprint or
// face prompt opens once by itself, and again from its key, during a wait
// too. A wait reads its time left from the native module (useWait), and
// TalkBack hears it once, not every second.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { useText } from '../text/i18n';
import { LockBoard } from './LockBoard';
import { PIN_LENGTH, errorCode, typed, waitWording } from './lock-rules';
import { PinPad } from './PinPad';
import { useWait } from './useWait';

export type UnlockProps = {
  readonly storage: Storage;
  readonly biometric: boolean;
  /** A wait already running when the screen opens, in seconds. */
  readonly waitSeconds: number;
  readonly lockMinutes: number;
  readonly onOpened: () => void;
  /** The history cannot be opened: its key is gone, or the module failed. */
  readonly onRefused: (error: unknown) => void;
};

type Message = 'wrong' | 'noSpace' | null;

/** Asks for the PIN, or the phone's prompt, and calls `onOpened` once the history is open. */
export function Unlock({ storage, biometric, waitSeconds, lockMinutes, onOpened, onRefused }: UnlockProps) {
  const t = useText();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [wait, setWait] = useWait(
    storage,
    waitSeconds,
    useCallback(() => setMessage(null), []),
  );
  const [busy, setBusy] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const mounted = useRef(true);
  const asked = useRef(false);
  const submitting = useRef(false);
  const started = useRef(false);
  const entered = useRef('');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (waitSeconds > 0) {
      const { key, count } = waitWording(waitSeconds);
      AccessibilityInfo.announceForAccessibility(t(key, { count }));
    }
  }, [t, waitSeconds]);

  const waiting = wait > 0;

  const askPhone = useCallback(() => {
    setPrompting(true);
    storage.unlockWithBiometrics(t('lock.promptTitle'), '', t('lock.promptCancel')).then(
      (opened) => {
        if (!mounted.current) return;
        setPrompting(false);
        if (opened) onOpened();
      },
      (error: unknown) => {
        if (__DEV__) console.warn('Biometric unlock failed', errorCode(error));
        if (mounted.current) setPrompting(false);
      },
    );
  }, [storage, t, onOpened]);

  useEffect(() => {
    if (asked.current || !biometric || waitSeconds > 0) return;
    asked.current = true;
    askPhone();
  }, [askPhone, biometric, waitSeconds]);

  const show = (value: string) => {
    entered.current = value;
    setPin(value);
  };

  const tryPin = (chosen: string) => {
    submitting.current = true;
    setBusy(true);
    storage.unlock(chosen).then(
      (result) => {
        if (!mounted.current) return;
        if (result.opened) {
          onOpened();
          return;
        }
        submitting.current = false;
        show('');
        setBusy(false);
        setWait(result.waitSeconds);
        setMessage('wrong');
        if (result.waitSeconds > 0) {
          const { key, count } = waitWording(result.waitSeconds);
          AccessibilityInfo.announceForAccessibility(`${t('lock.wrong')} ${t(key, { count })}`);
        }
      },
      (error: unknown) => {
        if (!mounted.current) return;
        if (errorCode(error) !== 'E_NO_SPACE') {
          onRefused(error);
          return;
        }
        submitting.current = false;
        show('');
        setBusy(false);
        setMessage('noSpace');
      },
    );
  };

  const onDigit = (digit: string) => {
    if (busy || waiting || submitting.current) return;
    const before = entered.current;
    const next = typed(before, digit);
    show(next);
    setMessage(null);
    if (next.length === PIN_LENGTH && before.length < PIN_LENGTH) tryPin(next);
  };

  const shown = waiting
    ? t(waitWording(wait).key, { count: waitWording(wait).count })
    : message === 'wrong'
      ? t('lock.wrong')
      : message === 'noSpace'
        ? t('lock.noSpace')
        : undefined;
  return (
    <LockBoard
      prompt={biometric ? t('lock.prompt') : t('lock.promptPin')}
      message={shown}
      live={!waiting}
      detail={waiting ? t('lock.waitWhy') : undefined}
      footer={t('lock.footer', { count: lockMinutes })}
    >
      <PinPad
        length={pin.length}
        onDigit={onDigit}
        onDelete={() => show(entered.current.slice(0, -1))}
        onBiometric={biometric ? askPhone : undefined}
        disabled={busy || waiting}
        biometricDisabled={busy || prompting}
      />
    </LockBoard>
  );
}
