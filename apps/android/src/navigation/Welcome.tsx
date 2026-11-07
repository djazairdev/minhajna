// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The welcome (Setup-1-Welcome, #24): the name on the board and the language
// choice, before anything is typed (answer 800). It also shows while the
// reference data and the history open, and on a refusal, with no way forward.
// While the history is empty, a settings icon leads to a short page holding
// only the restore, "I have a copy from another phone" (#247, answers 478 and
// 809), through the PIN first on a fresh install, so a new phone restores
// before making a profile. Reader mode is no longer offered here: the app is
// for teachers (answer 799). The preview says what it is before anything else
// (#48), and whether the PIN is set yet, for a build that takes real names
// (#211). A PC whose tab has just erased it says so first, for as long as the
// page lasts (Web-erase, answer 519). Where the app offers demo worlds, on a
// PC, the welcome leads to them (#560), and to the dashboard (answer 809).

import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { Notice } from '../components/Notice';
import { WelcomeHero } from '../components/WelcomeHero';
import { useDashboardDoor } from '../dashboard/door';
import { useDemoDoor } from '../demo/demo-door';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { PreviewNotice } from '../help/BuildFacts';
import browser from '../native/NativeMinhajnaBrowser';
import { useDeviceText } from '../text/device-text';
import { LanguageChoice } from './LanguageChoice';
import { WelcomeSettings } from './WelcomeSettings';

/**
 * The first page; `onStart` leads to the privacy notice once the app may open, and `onRestore`, offered on the
 * settings page, to the restore.
 */
export function Welcome({
  onStart,
  onRestore,
  referenceRefused = false,
  historyRefused = false,
  lockSet = false,
}: {
  onStart?: () => void;
  onRestore?: () => void;
  referenceRefused?: boolean;
  historyRefused?: boolean;
  /** True once the app's PIN is set, as when the welcome is left under the privacy notice. */
  lockSet?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useDeviceText();
  const demo = useDemoDoor();
  const [settings, setSettings] = useState(false);
  const dashboard = useDashboardDoor();
  const refusals = [referenceRefused && t('referenceRefused'), historyRefused && t('historyRefused')];
  if (settings && onRestore) {
    const restore = () => {
      setSettings(false);
      onRestore();
    };
    return <WelcomeSettings onRestore={restore} onBack={() => setSettings(false)} />;
  }
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
        {browser?.erasedHere() === true && (
          <Notice
            testID="welcome-erased"
            variant="notice"
            badge={t('welcome.erased.badge')}
            title={t('welcome.erased.title')}
            message={[t('welcome.erased.line'), t('welcome.erased.kept'), t('welcome.erased.again')].join(' ')}
          />
        )}
        {onStart && onRestore && (
          <View style={styles.tools}>
            <IconButton
              testID="welcome-settings"
              icon={controlIcon('tune')}
              accessibilityLabel={t('welcome.settings')}
              onPress={() => setSettings(true)}
            />
          </View>
        )}
        <PreviewNotice short lockSet={lockSet} />
        <LanguageChoice />
      </View>
      {onStart && (
        <View
          style={[
            styles.foot,
            { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
          ]}
        >
          <Button testID="welcome-start" label={t('welcome.start')} onPress={onStart} />
          {demo !== null && (
            <View style={styles.restore}>
              <Button testID="welcome-demo" variant="plain" label={t('demo.open')} onPress={demo} />
            </View>
          )}
          {dashboard !== null && (
            <View style={styles.restore}>
              <Button testID="welcome-dashboard" variant="plain" label={t('dashboard.door')} onPress={dashboard} />
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
  tools: { flexDirection: 'row', justifyContent: 'flex-end', marginVertical: -spacing['space-8'] },
  foot: {
    gap: spacing['space-8'],
    marginTop: 'auto',
    paddingTop: spacing['space-10'],
    paddingBottom: spacing['space-16'],
  },
});
