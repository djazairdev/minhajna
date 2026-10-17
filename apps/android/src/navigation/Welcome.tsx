// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The welcome (Setup-1-Welcome, #24): the name on the board, the language
// choice and the app's three promises, before anything is typed. It also
// shows while the reference data and the history open, and on a refusal, with
// no way forward. The restore link from another phone stays out of
// field-check builds (choice F4, #49), and no restore exists yet.

import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Facts } from '../components/Facts';
import { WelcomeHero } from '../components/WelcomeHero';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { LanguageChoice } from './LanguageChoice';

/** The first page; `onStart` leads to the privacy notice once the app may open. */
export function Welcome({
  onStart,
  referenceRefused = false,
  historyRefused = false,
}: {
  onStart?: () => void;
  referenceRefused?: boolean;
  historyRefused?: boolean;
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
  foot: { marginTop: 'auto', paddingTop: spacing['space-10'], paddingBottom: spacing['space-16'] },
});
