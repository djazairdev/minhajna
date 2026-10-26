// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Changing the passphrase on a PC (#250, answer 502), from «القفل والأمان»:
// the current one, then the new one twice, on one page. The storage module
// checks the current one, counting it like any try, so a wrong one may
// bring a wait. A PC has no fingerprint prompt, so that mode goes straight
// back. The typed passphrases are forgotten once sent or refused.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useText } from '../text/i18n';
import type { LockPinProps } from './lock-props';
import { PASSPHRASE_MAX, PASSPHRASE_MIN, errorCode, passphraseLength, waitWording } from './lock-rules';
import { useWait } from './useWait';
import { WebLockPage } from './web/WebLockPage';

export type { LockPinMode, LockPinProps } from './lock-props';

type Message = 'wrong' | 'noSpace' | 'short' | 'long' | 'mismatch' | 'failed' | null;

const MESSAGES = {
  wrong: 'lock.web.wrong',
  noSpace: 'lock.web.noSpace',
  short: 'lock.web.short',
  long: 'lock.web.long',
  mismatch: 'lock.web.mismatch',
  failed: 'security.failed',
} as const;

/** Asks for the current passphrase and the new one twice, then calls `onDone`. */
export function LockPin({ storage, mode, onDone, onCancel }: LockPinProps) {
  const t = useText();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useWait(
    storage,
    0,
    useCallback(() => setMessage(null), []),
  );
  const mounted = useRef(true);

  const left = useRef(false);
  useEffect(() => {
    if (mode !== 'biometric' || left.current) return;
    left.current = true;
    onCancel();
  }, [mode, onCancel]);

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
    };
  }, [storage, setWait]);

  const waiting = wait > 0;
  const clear = () => {
    setCurrent('');
    setNext('');
    setRepeat('');
  };
  const submit = () => {
    if (busy || waiting) return;
    const length = passphraseLength(next);
    if (length < PASSPHRASE_MIN || length > PASSPHRASE_MAX) {
      setMessage(length < PASSPHRASE_MIN ? 'short' : 'long');
      return;
    }
    if (next.normalize('NFC') !== repeat.normalize('NFC')) {
      setRepeat('');
      setMessage('mismatch');
      return;
    }
    setBusy(true);
    setMessage(null);
    storage.changePin(current, next).then(
      (result) => {
        if (!mounted.current) return;
        if (result.opened) {
          onDone();
          return;
        }
        setBusy(false);
        clear();
        setWait(result.waitSeconds);
        setMessage('wrong');
      },
      (error: unknown) => {
        const code = errorCode(error);
        if (__DEV__) console.warn('The passphrase did not change', code);
        if (!mounted.current) return;
        setBusy(false);
        clear();
        setMessage(code === 'E_NO_SPACE' ? 'noSpace' : 'failed');
      },
    );
  };

  const field = (value: string, set: (value: string) => void, kind: 'current-password' | 'new-password') => ({
    value,
    onChangeText: (typed: string) => {
      set(typed);
      if (!waiting) setMessage(null);
    },
    placeholder: '',
    secureTextEntry: true,
    autoComplete: kind,
    editable: !busy,
  });
  const shown = waiting
    ? t(waitWording(wait).key, { count: waitWording(wait).count })
    : message === null
      ? undefined
      : t(MESSAGES[message], { count: PASSPHRASE_MIN });
  return (
    <WebLockPage
      title={t('lock.web.change.title')}
      message={shown}
      live={!waiting}
      detail={waiting ? t('lock.web.waitWhy') : undefined}
      facts={[t('lock.web.create.line', { count: PASSPHRASE_MIN })]}
    >
      <TextField
        testID="passphrase-current"
        label={t('lock.web.change.current')}
        autoFocus
        {...field(current, setCurrent, 'current-password')}
      />
      <TextField testID="passphrase-new" label={t('lock.web.change.next')} {...field(next, setNext, 'new-password')} />
      <TextField
        testID="passphrase-repeat"
        label={t('lock.web.repeat')}
        onSubmitEditing={submit}
        {...field(repeat, setRepeat, 'new-password')}
      />
      <Button
        testID="passphrase-change"
        label={t('lock.web.change.submit')}
        onPress={submit}
        disabled={busy || waiting}
      />
      <Button
        testID="lock-pin-cancel"
        variant="line"
        label={t('lock.biometricAsk.cancel')}
        onPress={onCancel}
        disabled={busy}
      />
    </WebLockPage>
  );
}
