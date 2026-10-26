// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Choosing the passphrase on a PC (#250, answer 502), in place of the
// phone's first PIN: at least 12 characters, typed twice, then the storage
// module seals a new history key under it. Nobody can recover it, so the
// page says so before it is chosen. The typed passphrases are forgotten
// once sent or refused.

import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useText } from '../text/i18n';
import type { CreatePinProps } from './lock-props';
import { PASSPHRASE_MAX, PASSPHRASE_MIN, errorCode, passphraseLength } from './lock-rules';
import { WebLockPage } from './web/WebLockPage';

export type { CreatePinProps } from './lock-props';

type Message = 'short' | 'long' | 'mismatch' | 'noSpace' | 'failed' | null;

const MESSAGES = {
  short: 'lock.web.short',
  long: 'lock.web.long',
  mismatch: 'lock.web.mismatch',
  noSpace: 'lock.web.create.failed',
  failed: 'lock.web.create.notSaved',
} as const;

/** Asks for a new passphrase twice, and seals the history's key under it. */
export function CreatePin({ storage, lockMinutes, onCreated, onRefused, onFailed, onBack }: CreatePinProps) {
  const t = useText();
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = () => {
    if (busy) return;
    const length = passphraseLength(first);
    if (length < PASSPHRASE_MIN || length > PASSPHRASE_MAX) {
      setMessage(length < PASSPHRASE_MIN ? 'short' : 'long');
      return;
    }
    if (first.normalize('NFC') !== second.normalize('NFC')) {
      setSecond('');
      setMessage('mismatch');
      return;
    }
    setBusy(true);
    setMessage(null);
    storage.createLock(first).then(
      () => {
        if (mounted.current) onCreated(first);
      },
      (error: unknown) => {
        if (!mounted.current) return;
        if (errorCode(error) === 'E_KEY_LOST') {
          onRefused(error);
          return;
        }
        if (__DEV__) console.warn('The passphrase did not save', errorCode(error));
        setBusy(false);
        setFirst('');
        setSecond('');
        setMessage(errorCode(error) === 'E_NO_SPACE' ? 'noSpace' : 'failed');
        onFailed?.();
      },
    );
  };

  return (
    <WebLockPage
      title={t('lock.web.create.title')}
      message={message === null ? undefined : t(MESSAGES[message], { count: PASSPHRASE_MIN })}
      facts={[
        t('lock.web.create.line', { count: PASSPHRASE_MIN }),
        t('lock.web.kept'),
        t('lock.web.locks', { count: lockMinutes }),
      ]}
    >
      <TextField
        testID="passphrase-new"
        label={t('lock.web.passphrase')}
        placeholder=""
        value={first}
        onChangeText={(value) => {
          setFirst(value);
          setMessage(null);
        }}
        secureTextEntry
        autoComplete="new-password"
        autoFocus
        editable={!busy}
      />
      <TextField
        testID="passphrase-repeat"
        label={t('lock.web.repeat')}
        placeholder=""
        value={second}
        onChangeText={(value) => {
          setSecond(value);
          setMessage(null);
        }}
        onSubmitEditing={submit}
        secureTextEntry
        autoComplete="new-password"
        editable={!busy}
      />
      <Button testID="passphrase-create" label={t('lock.web.create.submit')} onPress={submit} disabled={busy} />
      {onBack !== undefined && (
        <Button testID="passphrase-back" variant="line" label={t('lock.web.back')} onPress={onBack} disabled={busy} />
      )}
    </WebLockPage>
  );
}
