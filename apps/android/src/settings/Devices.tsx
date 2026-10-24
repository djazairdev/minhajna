// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «الأجهزة والنسخ» in Settings (#247, Devices-pilot, R-3.11-02, R-6.2-03,
// R-6.5-01, answer 478). Sync is not open in the pilot, and the page says why;
// until it is, a new phone is reached by a direct transfer or a backup file.
// The transfer opens its own screen (answer 480). A backup goes through the
// file picker under the recovery key; the first
// one gives the recovery sheet first, then is saved once the sheet is
// confirmed. The sheet prints again from here. Nothing names where a backup
// went, and the project holds no key.

import { deviceFacts, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { backupLine } from './backup-line';
import { useBackup } from './backup-run';
import { settingsStyles as styles } from './styles';

export type DevicesProps = {
  /** Opens the direct transfer to a new phone. */
  readonly onTransfer: () => void;
  /** Opens the recovery sheet: to print it again, or to give the first one before a backup. */
  readonly onSheet: (first: boolean) => void;
  /** The sheet was just confirmed for a first backup, which starts here once. */
  readonly backupNow: boolean;
  readonly onBackupStarted: () => void;
};

export function Devices({ onTransfer, onSheet, backupNow, onBackupStarted }: DevicesProps) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { entries, profile } = useAppData();
  const { busy, said, backup } = useBackup();
  const facts = deviceFacts(entries());
  const key = facts.recovery?.key;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const started = useRef(false);
  const day = (one: Day) => dayName(t, one, currentLanguage(), profile);
  useEffect(() => {
    if (!backupNow) started.current = false;
    if (!backupNow || key === undefined || started.current) return;
    started.current = true;
    onBackupStarted();
    backup(key);
  }, [backupNow, key, backup, onBackupStarted]);
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
      <Text style={[styles.sub, align]}>{t('settings.devices.yours')}</Text>
      <View testID="devices-sync" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('settings.devices.sync')}
        </Text>
        <Text style={[styles.body, align]}>{t('settings.devices.notOpen')}</Text>
        <Text style={[styles.body, align]}>{t('settings.devices.why')}</Text>
      </View>
      <Text style={[styles.sub, align]}>{t('settings.devices.meanwhile')}</Text>
      <RowLink
        testID="devices-transfer"
        icon={controlIcon('tune')}
        title={t('settings.devices.transfer')}
        description={t('settings.devices.transferLine')}
        disabled={busy}
        onPress={onTransfer}
      />
      <View testID="devices-backup" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('settings.devices.backup')}
        </Text>
        <Text style={[styles.body, align]}>{t('settings.devices.backupLine')}</Text>
        <Text testID="devices-last" style={[styles.body, align]}>
          {backupLine(t, entries(), profile)}
        </Text>
        {said !== null && (
          <Notice
            testID="devices-said"
            icon={controlIcon('info')}
            message={t(said === 'saved' ? 'settings.devices.saved' : 'settings.devices.failed')}
          />
        )}
        <Button
          testID="devices-backup-now"
          label={t('settings.devices.now')}
          disabled={busy}
          onPress={() => (key === undefined ? onSheet(true) : backup(key))}
        />
      </View>
      <RowLink
        testID="devices-sheet"
        icon={controlIcon('lock')}
        title={t('settings.devices.sheet')}
        description={
          facts.recovery === null
            ? t('settings.devices.noSheet')
            : t('settings.devices.sheetLine', { day: day(facts.recovery.day) })
        }
        disabled={facts.recovery === null || busy}
        onPress={() => onSheet(false)}
      />
      <Text style={[styles.body, align]}>{t('settings.devices.noKey')}</Text>
    </ScrollView>
  );
}
