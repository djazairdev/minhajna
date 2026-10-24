// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A restore's file that fails its check (#247, the Handover-in-fail screen for
// a restore, answer 478): it changed after it was saved, or, once in 65,536,
// the key or password is not its own and passed the ZIP's two check bytes, so
// the page says both, for a transfer file, a backup or an export. Nothing was
// stored and the file stays as it is. No line goes to the activity log, as
// there is no history yet to hold it.

import { useLocale } from '@react-navigation/native';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { spacing } from '../design/tokens';
import { settingsStyles as styles } from '../settings/styles';
import { useText } from '../text/i18n';
import type { RestoreRoute } from './restore-run';

const WORDS = {
  phone: { why: 'whyPhone', ask: 'askPhone' },
  backup: { why: 'why', ask: 'ask' },
  archive: { why: 'whyArchive', ask: 'askArchive' },
} as const;

/** The refusal of a transfer file, a backup or an export, and the way back to choosing another file. */
export function RestoreFail({ route, onAgain }: { readonly route: RestoreRoute; readonly onAgain: () => void }) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <ScrollView
      testID="restore-fail"
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
      <View style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('settings.restore.fail.title')}
        </Text>
        <Text accessibilityRole="alert" style={[styles.body, align]}>
          {t('settings.restore.fail.head')}
        </Text>
        <Text style={[styles.body, align]}>{t(`settings.restore.fail.${WORDS[route].why}`)}</Text>
      </View>
      <Text style={[styles.body, align]}>{t('settings.restore.fail.nothing')}</Text>
      <Text style={[styles.body, align]}>{t(`settings.restore.fail.${WORDS[route].ask}`)}</Text>
      <Button testID="restore-again" label={t('settings.restore.fail.again')} onPress={onAgain} />
    </ScrollView>
  );
}
