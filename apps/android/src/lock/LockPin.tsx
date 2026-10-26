// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PIN pages «القفل والأمان» opens (#210), on the Lock design's board.
// Changing the PIN asks for the current one, then the new one twice; the
// native module checks the current one last, counting it like any try, so
// a wrong one starts again from the first step and may bring a wait. Turning
// on the fingerprint or face asks for the PIN, then shows the phone's prompt;
// a closed prompt is told apart from a wrong PIN. A wait reads its time left
// from the native module, as on the lock. Back does nothing while the
// native module works, so its answer is never lost, and the typed PINs are
// forgotten once used.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, Text } from 'react-native';
import { colors, sizes, spacing, typography } from '../design/tokens';
import type { PinResult } from '../native/NativeMinhajnaStorage';
import { useText } from '../text/i18n';
import type { LockPinProps } from './lock-props';
import { LockBoard } from './LockBoard';
import { PIN_LENGTH, errorCode, typed, waitWording } from './lock-rules';
import { PinPad } from './PinPad';
import { useWait } from './useWait';

export type { LockPinMode, LockPinProps } from './lock-props';

type Step = 'current' | 'next' | 'repeat';
type Message = 'wrong' | 'noSpace' | 'mismatch' | 'failed' | 'notOn' | null;

const MESSAGES = {
  wrong: 'lock.wrong',
  noSpace: 'lock.noSpace',
  mismatch: 'lock.create.mismatch',
  failed: 'security.failed',
  notOn: 'lock.change.biometricFailed',
} as const;

/** Asks for the PIN, and the new one twice when changing it, then calls `onDone`. */
export function LockPin({ storage, mode, onDone, onCancel }: LockPinProps) {
  const t = useText();
  const [step, setStep] = useState<Step>('current');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useWait(
    storage,
    0,
    useCallback(() => setMessage(null), []),
  );
  const mounted = useRef(true);
  const entered = useRef('');
  const current = useRef('');
  const fresh = useRef('');
  const submitting = useRef(false);

  useEffect(() => {
    mounted.current = true;
    storage.lockStatus().then(
      (status) => {
        if (mounted.current && status.waitSeconds > 0) setWait(status.waitSeconds);
      },
      () => undefined,
    );
    return () => {
      mounted.current = false;
      current.current = '';
      fresh.current = '';
    };
  }, [storage, setWait]);

  useEffect(() => {
    if (!busy) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [busy]);

  const show = (value: string) => {
    entered.current = value;
    setPin(value);
  };
  const goTo = (next: Step) => {
    show('');
    if (next === 'current') {
      current.current = '';
      fresh.current = '';
    }
    setStep(next);
  };

  const settle = (work: Promise<PinResult>) => {
    submitting.current = true;
    setBusy(true);
    work.then(
      (result) => {
        if (!mounted.current) return;
        if (result.opened) {
          onDone();
          return;
        }
        submitting.current = false;
        setBusy(false);
        goTo('current');
        setWait(result.waitSeconds);
        setMessage('wrong');
        if (result.waitSeconds > 0) {
          const { key, count } = waitWording(result.waitSeconds);
          AccessibilityInfo.announceForAccessibility(`${t('lock.wrong')} ${t(key, { count })}`);
        }
      },
      (error: unknown) => {
        const code = errorCode(error);
        if (__DEV__ && code !== 'E_CANCELLED') console.warn('The lock did not change', code);
        if (!mounted.current) return;
        submitting.current = false;
        setBusy(false);
        goTo('current');
        setMessage(code === 'E_NO_SPACE' ? 'noSpace' : code === 'E_CANCELLED' ? 'notOn' : 'failed');
      },
    );
  };

  const complete = (typedPin: string) => {
    if (step === 'current' && mode === 'biometric') {
      settle(storage.enableBiometrics(typedPin, t('lock.biometricAsk.promptTitle'), '', t('lock.biometricAsk.cancel')));
    } else if (step === 'current') {
      current.current = typedPin;
      goTo('next');
    } else if (step === 'next') {
      fresh.current = typedPin;
      goTo('repeat');
      AccessibilityInfo.announceForAccessibility(t('lock.create.repeat'));
    } else if (typedPin === fresh.current) {
      settle(storage.changePin(current.current, typedPin));
    } else {
      goTo('next');
      setMessage('mismatch');
    }
  };

  const waiting = wait > 0;
  const onDigit = (digit: string) => {
    if (busy || waiting || submitting.current) return;
    const before = entered.current;
    const next = typed(before, digit);
    show(next);
    setMessage(null);
    if (next.length === PIN_LENGTH && before.length < PIN_LENGTH) complete(next);
  };

  const prompt =
    step === 'next'
      ? t('lock.change.next')
      : step === 'repeat'
        ? t('lock.create.repeat')
        : t(mode === 'biometric' ? 'lock.change.confirm' : 'lock.change.current');
  const shown = waiting
    ? t(waitWording(wait).key, { count: waitWording(wait).count })
    : message === null
      ? undefined
      : t(MESSAGES[message]);
  return (
    <LockBoard
      prompt={prompt}
      message={shown}
      live={!waiting}
      detail={waiting ? t('lock.waitWhy') : undefined}
      footer={t(mode === 'biometric' ? 'lock.biometricAsk.line' : 'lock.create.line')}
    >
      <PinPad
        length={pin.length}
        onDigit={onDigit}
        onDelete={() => show(entered.current.slice(0, -1))}
        disabled={busy || waiting}
      />
      <Pressable
        testID="lock-pin-cancel"
        accessibilityRole="button"
        disabled={busy}
        onPress={onCancel}
        style={styles.cancel}
      >
        <Text style={styles.cancelText}>{t('lock.biometricAsk.cancel')}</Text>
      </Pressable>
    </LockBoard>
  );
}

const styles = StyleSheet.create({
  cancel: {
    minHeight: sizes.target,
    minWidth: sizes.target,
    justifyContent: 'center',
    paddingHorizontal: spacing['space-16'],
  },
  cancelText: { ...typography.label, color: colors['chalk-82'], textAlign: 'center' },
});
