// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مسح هذا الحاسوب» from the lock page (#250, Web-erase, answer 518), for a
// teacher who forgot the passphrase. The history cannot be read while it is
// locked, so the page says what is erased and what stays elsewhere with no
// counts: whatever reached neither the phone nor a backup is lost. Once the
// teacher ticks that erasing cannot be undone, the storage erases this
// browser's data and the app restarts empty, its welcome saying so (answer
// 519). A failure says so and leaves the button for another try; while the
// app's other tabs keep the erase waiting, the page says so and stays busy
// until it finishes. «رجوع» goes back to the passphrase.

import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { CheckRow } from '../../components/CheckRow';
import { Notice } from '../../components/Notice';
import { controlIcon } from '../../design/Icon';
import { colors, spacing, typography } from '../../design/tokens';
import ui from '../../native/NativeMinhajnaInterface';
import type { Spec as Storage } from '../../native/NativeMinhajnaStorage';
import { useText } from '../../text/i18n';
import { errorCode } from '../lock-rules';
import { WebLockPage } from './WebLockPage';

export type EraseLockedProps = {
  readonly storage: Storage;
  readonly onBack: () => void;
};

const GONE = [
  'lock.web.erase.goneAll',
  'settings.eraseDevice.goneBooks',
  'settings.eraseDevice.goneNotes',
  'lock.web.erase.goneKey',
] as const;

export function EraseLocked({ storage, onBack }: EraseLockedProps) {
  const t = useText();
  const { direction } = useLocale();
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<'failed' | 'waits' | null>(null);
  const pending = useRef(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const erase = () => {
    if (pending.current || !understood) return;
    pending.current = true;
    setBusy(true);
    setSaid(null);
    storage.eraseDevice().then(
      () => ui.restart(),
      (error: unknown) => {
        if (errorCode(error) === 'E_ERASE_WAITS') {
          setSaid('waits');
          return;
        }
        pending.current = false;
        setBusy(false);
        setSaid('failed');
      },
    );
  };
  return (
    <WebLockPage title={t('lock.web.erase.title')} facts={[]}>
      <Text style={[styles.line, align]}>{t('lock.web.erase.oneStep')}</Text>
      <View testID="erase-locked-gone" style={styles.part}>
        <Text accessibilityRole="header" style={[styles.label, align]}>
          {t('lock.web.erase.gone')}
        </Text>
        {GONE.map((key) => (
          <Text key={key} style={[styles.line, align]}>
            {t(key)}
          </Text>
        ))}
      </View>
      <View testID="erase-locked-kept" style={styles.part}>
        <Text accessibilityRole="header" style={[styles.label, align]}>
          {t('settings.eraseDevice.kept')}
        </Text>
        <Text style={[styles.line, align]}>{t('lock.web.erase.keptLine')}</Text>
      </View>
      <Notice testID="erase-locked-lost" icon={controlIcon('info')} message={t('lock.web.erase.lost')} />
      <CheckRow
        testID="erase-locked-understood"
        label={t('settings.eraseDevice.understood')}
        checked={understood}
        disabled={busy}
        onCheckedChange={setUnderstood}
      />
      {said !== null && (
        <Notice
          testID={`erase-locked-${said}`}
          icon={controlIcon('info')}
          message={t(`settings.eraseDevice.${said}`)}
        />
      )}
      <Button
        testID="erase-locked-confirm"
        variant="danger"
        label={t('lock.web.erase.submit')}
        disabled={!understood || busy}
        onPress={erase}
      />
      <Button testID="erase-locked-back" variant="line" label={t('lock.web.back')} disabled={busy} onPress={onBack} />
    </WebLockPage>
  );
}

const styles = StyleSheet.create({
  part: { gap: spacing['space-4'] },
  label: { ...typography.label, color: colors.ink },
  line: { ...typography.body, color: colors.ink },
});
