// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The lock on a PC (#250, Web-unlock design): the passphrase, sent with
// «فتح» or Enter, to the storage module, which counts wrong tries and keeps
// the wait as the phone's does, so a reload resets nothing. A wait reads its
// time left from the module each second (useWait). «نسيت عبارة المرور؟» says
// what is left to do, as nobody can recover the passphrase, and leads to
// «مسح هذا الحاسوب» (EraseLocked, answer 518). While the
// browser has not agreed to keep the data, the page warns at each opening
// (Web-unlock-risk, answer 511), saying too that clearing the site's data
// deletes it either way; the first passphrase sent at each opening asks
// the browser again, while the click still counts as the teacher's.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { askToKeep, useDataKept } from './browser-offers';
import { errorCode, waitWording } from './lock-rules';
import type { UnlockProps } from './lock-props';
import { useWait } from './useWait';
import { EraseLocked } from './web/EraseLocked';
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
  const [erasing, setErasing] = useState(false);
  const kept = useDataKept();
  const mounted = useRef(true);
  const asked = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const waiting = wait > 0;
  const submit = () => {
    if (busy || waiting || passphrase === '') return;
    if (!asked.current) void askToKeep();
    asked.current = true;
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

  if (erasing) return <EraseLocked storage={storage} onBack={() => setErasing(false)} />;
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
      warning={
        kept === false && (
          <Notice
            testID="keep-risk"
            variant="notice"
            badge={t('lock.web.risk.badge')}
            title={t('lock.web.risk.title')}
            message={[
              t('lock.web.risk.why'),
              t('lock.web.cleared'),
              t('lock.web.risk.after'),
              t('lock.web.risk.stays'),
            ].join(' ')}
          />
        )
      }
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
      {forgot && (
        <Pressable
          testID="passphrase-erase"
          accessibilityRole="button"
          disabled={busy}
          onPress={() => setErasing(true)}
          style={styles.link}
        >
          <Text style={styles.linkText}>{t('lock.web.erase.link')}</Text>
        </Pressable>
      )}
    </WebLockPage>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  linkText: { ...typography.label, color: colors.ink, textDecorationLine: 'underline' },
  forgot: { ...typography.small, color: colors.ink2, marginTop: -spacing['space-8'] },
});
