// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The welcome (Setup-1-Welcome, #24): the name on the board, the language
// choice and the app's three promises, before anything is typed. It also shows
// while the reference data and the history open, and on a refusal, with no way
// forward. «لديّ نسخة من هاتف آخر» leads to the restore (#247, answer 478),
// through the PIN first on a fresh install, and «فتح بيان أستاذ» to reader
// mode, for a director or an inspector (#246, answer 490). The preview says
// what it is before anything else (#48), and whether the PIN is set yet, for a
// build that takes real names (#211).

import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Facts } from '../components/Facts';
import { WelcomeHero } from '../components/WelcomeHero';
import { colors, spacing, typography } from '../design/tokens';
import { PreviewNotice } from '../help/BuildFacts';
import { useText } from '../text/i18n';
import { LanguageChoice } from './LanguageChoice';

/**
 * The first page; `onStart` leads to the privacy notice once the app may open, `onReader` to it for reader mode, and
 * `onRestore` to the restore.
 */
export function Welcome({
  onStart,
  onReader,
  onRestore,
  referenceRefused = false,
  historyRefused = false,
  lockSet = false,
}: {
  onStart?: () => void;
  onReader?: () => void;
  onRestore?: () => void;
  referenceRefused?: boolean;
  historyRefused?: boolean;
  /** True once the app's PIN is set, as when the welcome is left under the privacy notice. */
  lockSet?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const refusals = [referenceRefused && t('referenceRefused'), historyRefused && t('historyRefused')];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { direction, paddingBottom: insets.bottom }]}
    >
      <WelcomeHero mark title={t('name')} tagline={t('tagline')} line={t('welcome.line')} />
      <View
        style={[
          styles.form,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        {refusals
          .filter((line) => line !== false)
          .map((line) => (
            <Text
              key={line}
              accessibilityRole="alert"
              style={[styles.refusal, { writingDirection: direction, textAlign: 'start' }]}
            >
              {line}
            </Text>
          ))}
        <PreviewNotice short lockSet={lockSet} />
        <LanguageChoice />
        <Facts
          facts={[
            { icon: 'no_account', text: t('welcome.noAccount') },
            { icon: 'offline', text: t('welcome.offline') },
            { icon: 'phone', text: t('welcome.onPhone') },
          ]}
        />
      </View>
      {onStart && (
        <View
          style={[
            styles.foot,
            { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
          ]}
        >
          <Button testID="welcome-start" label={t('welcome.start')} onPress={onStart} />
          {onReader && <Button testID="welcome-reader" variant="line" label={t('welcome.reader')} onPress={onReader} />}
          {onRestore && (
            <View style={styles.restore}>
              <Button testID="welcome-restore" variant="plain" label={t('welcome.restore')} onPress={onRestore} />
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1 },
  form: { gap: spacing['space-16'], paddingTop: spacing['space-20'], paddingBottom: spacing['space-16'] },
  refusal: { ...typography.body, color: colors.ink },
  restore: { flexDirection: 'row', justifyContent: 'center' },
  foot: {
    gap: spacing['space-8'],
    marginTop: 'auto',
    paddingTop: spacing['space-10'],
    paddingBottom: spacing['space-16'],
  },
});
