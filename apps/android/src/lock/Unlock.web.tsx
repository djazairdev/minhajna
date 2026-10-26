// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The lock on a PC (#250, Web-unlock design): the passphrase, sent with
// «فتح» or Enter, to the storage module, which counts wrong tries and keeps
// the wait as the phone's does, so a reload resets nothing. A wait reads its
// time left from the module each second (useWait). «نسيت عبارة المرور؟» says
// what is left to do, as nobody can recover the passphrase.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { errorCode, waitWording } from './lock-rules';
import type { UnlockProps } from './lock-props';
import { useWait } from './useWait';
import { WebLockPage } from './web/WebLockPage';

export type { UnlockProps } from './lock-props';

type Message = 'wrong' | 'noSpace' | null;

/** Asks for the passphrase, and calls `onOpened` once the history is open. */
export function Unlock({ storage, waitSeconds, lockMinutes, onOpened, onRefused }: UnlockProps) {
  const t = useText();
  const [passphrase, setPassphrase] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [wait, setWait] = useWait(
    storage,
    waitSeconds,
    useCallback(() => setMessage(null), []),
  );
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const waiting = wait > 0;
  const submit = () => {
    if (busy || waiting || passphrase === '') return;
    setBusy(true);
    storage.unlock(passphrase).then(
      (result) => {
        if (!mounted.current) return;
        if (result.opened) {
          onOpened();
          return;
        }
        setBusy(false);
        setPassphrase('');
        setWait(result.waitSeconds);
        setMessage('wrong');
      },
      (error: unknown) => {
        if (!mounted.current) return;
        if (errorCode(error) !== 'E_NO_SPACE') {
          onRefused(error);
          return;
        }
        setBusy(false);
        setPassphrase('');
        setMessage('noSpace');
      },
    );
  };

  const shown = waiting
    ? t(waitWording(wait).key, { count: waitWording(wait).count })
    : message === 'wrong'
      ? t('lock.web.wrong')
      : message === 'noSpace'
        ? t('lock.web.noSpace')
        : undefined;
  return (
    <WebLockPage
      title={t('lock.web.title')}
      message={shown}
      live={!waiting}
      detail={waiting ? t('lock.web.waitWhy') : undefined}
      facts={[t('lock.web.kept'), t('lock.web.locks', { count: lockMinutes })]}
    >
      <TextField
        testID="passphrase"
        label={t('lock.web.passphrase')}
        placeholder=""
        value={passphrase}
        onChangeText={(value) => {
          setPassphrase(value);
          if (!waiting) setMessage(null);
        }}
        onSubmitEditing={submit}
        secureTextEntry
        autoComplete="current-password"
        autoFocus
        editable={!busy}
      />
      <Button testID="passphrase-open" label={t('lock.web.open')} onPress={submit} disabled={busy || waiting} />
      <Pressable
        testID="passphrase-forgot"
        accessibilityRole="button"
        accessibilityState={{ expanded: forgot }}
        onPress={() => setForgot((shown) => !shown)}
        style={styles.link}
      >
        <Text style={styles.linkText}>{t('lock.web.forgot')}</Text>
      </Pressable>
      {forgot && <Text style={styles.forgot}>{t('lock.web.forgotLine')}</Text>}
    </WebLockPage>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  linkText: { ...typography.label, color: colors.ink, textDecorationLine: 'underline' },
  forgot: { ...typography.small, color: colors.ink2, marginTop: -spacing['space-8'] },
});
