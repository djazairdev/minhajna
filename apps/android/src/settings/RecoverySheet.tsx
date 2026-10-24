// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «ورقة الاسترجاع» (#247, Recovery-sheet, R-6.5-01, R-6.5-05, answer 478). The
// first sheet comes with the first backup: a new key, drawn on this phone,
// shown in six numbered groups, printed or written by hand, then typed back in
// full, with no keyboard suggestions; only then is it kept, in the device
// layer, and the backup goes on. Earlier keys are erased only once the new one
// is saved; a failure is said, and the sheet stays. Opened again, the sheet
// shows the key kept, to print again, and offers a new key for a lost sheet: it
// is confirmed the same way, the earlier keys' content is erased, and the
// backups made before stay on the old key, so a new one follows. Screenshots
// are refused here whatever the teacher allowed, and the key reaches no server.

import { deviceFacts, makeRecoveryKey, readRecoveryKey } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { useOutputRun } from '../documents/output-run';
import { isolate } from '../week/grid-labels';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { useAppData } from '../storage/AppData';
import { fromHex } from '../storage/history';
import { currentLanguage, useText } from '../text/i18n';
import { recoveryHtml } from './recovery-html';
import { KeyGroups } from './KeyGroups';
import { settingsStyles as styles } from './styles';

export type RecoverySheetProps = {
  /** The storage module, for the phone's random bytes. */
  readonly storage: Pick<Storage, 'randomBytes'>;
  /** A first sheet, before the first backup, rather than the key kept. */
  readonly first: boolean;
  /** The new key was typed back and kept. */
  readonly onConfirmed: () => void;
};

const LINES = [
  'settings.recovery.keep',
  'settings.recovery.restores',
  'settings.recovery.except',
  'settings.recovery.noCopy',
] as const;

export function RecoverySheet({ storage, first, onConfirmed }: RecoverySheetProps) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { entries, record, erase, allSaved } = useAppData();
  const kept = deviceFacts(entries()).recovery?.key ?? null;
  const draw = () => makeRecoveryKey((length) => fromHex(storage.randomBytes(length)));
  const [fresh, setFresh] = useState<string | null>(() => (first || kept === null ? draw() : null));
  const [typed, setTyped] = useState('');
  const [tried, setTried] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const { busy, print } = useOutputRun();
  const key = fresh ?? kept ?? '';
  const wrong = tried && readRecoveryKey(typed) !== fresh;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const html = () =>
    recoveryHtml(
      {
        lang: currentLanguage(),
        dir: direction,
        title: t('settings.recovery.title'),
        intro: t('settings.recovery.intro'),
        computer: t('settings.recovery.computer', { app: isolate('7-Zip') }),
        lines: LINES.map((line) => t(line)),
      },
      key,
    );
  const confirm = () => {
    setTried(true);
    if (pending.current || fresh === null || readRecoveryKey(typed) !== fresh) return;
    pending.current = true;
    setFailed(false);
    record({ kind: 'recovery.set', recovery: { key: fresh } });
    void allSaved().then(async (kept) => {
      if (kept) {
        erase((event) => event.kind === 'recovery.set' && event.recovery.key !== fresh);
        await allSaved();
        onConfirmed();
        return;
      }
      pending.current = false;
      setFailed(true);
    });
  };
  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      <Text style={[styles.sub, align]}>{t('settings.recovery.given')}</Text>
      <View testID="recovery-key" style={styles.card}>
        <Text style={[styles.body, align]}>{t('settings.recovery.intro')}</Text>
        <KeyGroups value={key} />
        <Button
          testID="recovery-print"
          label={t('settings.recovery.print')}
          disabled={busy}
          onPress={() => print(html, t('settings.recovery.title'), false)}
        />
        <Text style={[styles.body, align]}>{t('settings.recovery.printOrWrite')}</Text>
      </View>
      {LINES.map((line) => (
        <Text key={line} style={[styles.body, align]}>
          {t(line)}
        </Text>
      ))}
      <Text style={[styles.body, align]}>{t('settings.recovery.computer', { app: isolate('7-Zip') })}</Text>
      <Notice icon={controlIcon('lock')} message={t('settings.recovery.guarded')} />
      {fresh === null ? (
        <View testID="recovery-new" style={styles.card}>
          <Text style={[styles.body, align]}>{t('settings.recovery.newLine')}</Text>
          <Button
            testID="recovery-new-key"
            variant="line"
            label={t('settings.recovery.newKey')}
            onPress={() => setFresh(draw())}
          />
        </View>
      ) : (
        <View testID="recovery-check" style={styles.card}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('settings.recovery.check')}
          </Text>
          <TextField
            testID="recovery-typed"
            label={t('settings.recovery.field')}
            placeholder={t('settings.recovery.placeholder')}
            value={typed}
            onChangeText={setTyped}
            textDirection="ltr"
            autoCapitalize="characters"
            keyboardType="visible-password"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            error={wrong ? t('settings.recovery.mismatch') : undefined}
          />
          {failed && (
            <Notice testID="recovery-failed" icon={controlIcon('info')} message={t('settings.recovery.failed')} />
          )}
          <Button testID="recovery-confirm" label={t('settings.recovery.confirm')} onPress={confirm} />
        </View>
      )}
    </ScrollView>
  );
}
