// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مسح هذا الجهاز» in Settings (#248, Erase, R-5.7-05, R-5.8-09, answer 477):
// one step that cannot be undone. It says what goes from this phone, with the
// classes and pupils counted, and what stays outside it (#482): the last
// backup and its day, and the files saved elsewhere, though no backup holds
// the personal fields or the drawn signature, with the changes since that
// backup counted as lost; or, before any backup, nothing, so every change on
// this phone goes with it. It offers the export first, and erases only once
// the teacher ticks that it cannot be undone, once however often it is
// tapped, after the last changes are saved; the app then starts again on the
// welcome screen. A failure is said, and the screen stays.

import { deviceFacts } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { Notice } from '../components/Notice';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import ui from '../native/NativeMinhajnaInterface';
import type { Spec as Storage } from '../native/NativeMinhajnaStorage';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { settingsStyles as styles } from './styles';

export type EraseDeviceProps = {
  /** The storage module the app opened its history with. */
  readonly storage: Storage;
  readonly onExport: () => void;
};

const GONE = [
  'settings.eraseDevice.goneRoll',
  'settings.eraseDevice.goneBooks',
  'settings.eraseDevice.goneNotes',
  'settings.eraseDevice.goneKey',
] as const;

export function EraseDevice({ storage, onExport }: EraseDeviceProps) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { state, entries, profile, allSaved } = useAppData();
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const counted = t('settings.eraseDevice.goneClasses', {
    classes: t('ready.classes', { count: state.classes.size }),
    pupils: t('setup.pupils', { count: state.pupils.size }),
  });
  const { lastBackup, sinceBackup } = deviceFacts(entries());
  const day = lastBackup === null ? '' : dayName(t, lastBackup, currentLanguage(), profile);
  const kept =
    lastBackup === null
      ? [t('settings.eraseDevice.keptNone')]
      : [t('settings.eraseDevice.keptBackup', { day }), t('settings.eraseDevice.keptLeftOut')];
  const lost =
    lastBackup === null
      ? t('settings.eraseDevice.lost', { count: sinceBackup })
      : sinceBackup === 0
        ? t('settings.eraseDevice.lostNone', { day })
        : t('settings.eraseDevice.lostSince', { count: sinceBackup, day });
  const erase = () => {
    if (pending.current || !understood) return;
    pending.current = true;
    setBusy(true);
    setFailed(false);
    void allSaved()
      .then(() => storage.eraseDevice())
      .then(
        () => ui.restart(),
        () => {
          pending.current = false;
          setBusy(false);
          setFailed(true);
        },
      );
  };
  return (
    <ScrollView
      style={styles.screen}
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
      <Text style={[styles.sub, align]}>{t('settings.eraseDevice.oneStep')}</Text>
      <View testID="erase-gone" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('settings.eraseDevice.gone')}
        </Text>
        {[counted, ...GONE.map((key) => t(key))].map((line) => (
          <Text key={line} style={[styles.body, align]}>
            {line}
          </Text>
        ))}
      </View>
      <View testID="erase-kept" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('settings.eraseDevice.kept')}
        </Text>
        {kept.map((line) => (
          <Text key={line} style={[styles.body, align]}>
            {line}
          </Text>
        ))}
      </View>
      <Notice testID="erase-lost" icon={controlIcon('info')} message={lost} />
      <RowLink
        testID="erase-export"
        icon={controlIcon('lock')}
        title={t('settings.eraseDevice.export')}
        description={t('settings.eraseDevice.exportLine')}
        disabled={busy}
        onPress={onExport}
      />
      <CheckRow
        testID="erase-understood"
        label={t('settings.eraseDevice.understood')}
        checked={understood}
        disabled={busy}
        onCheckedChange={setUnderstood}
      />
      {failed && <Notice testID="erase-failed" icon={controlIcon('info')} message={t('settings.eraseDevice.failed')} />}
      <Button
        testID="erase-confirm"
        variant="danger"
        label={t('settings.eraseDevice.erase')}
        disabled={!understood || busy}
        onPress={erase}
      />
    </ScrollView>
  );
}
