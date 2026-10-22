// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «سجل النشاط» from Settings (#235, Log, R-5.5-06, answer 425): what is
// corrected, printed, exported and deleted, by day and with no clock time,
// worked out from the history each time the screen draws, which only a new
// change makes it do. The chain is intact, since the history only opens
// once it verifies; nothing goes to the sector's system in teacher mode.
// «الأجهزة» waits for transfer and backup (#247) and «الإحصاءات» for
// insights, which the pilot has none of.

import { activityLog } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { LogList } from './LogList';

export function Log() {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { state, profile, entries } = useAppData();
  const lang = currentLanguage();
  const days = activityLog(entries());
  const align = { writingDirection: direction, textAlign: 'start' } as const;
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
      <Text style={[styles.sub, align]}>{t('log.sub')}</Text>
      <Notice testID="log-intact" icon={controlIcon('check')} message={t('log.intact')} />
      <Notice testID="log-sector" icon={controlIcon('info')} message={t('log.sector')} />
      <LogList days={days} names={{ state, profile, lang }} />
      <Text style={[styles.sub, align]}>{t('log.kept')}</Text>
    </ScrollView>
  );
}
