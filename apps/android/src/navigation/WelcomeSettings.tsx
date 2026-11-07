// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The welcome's settings page (answers 800 and 809): before any profile exists,
// it holds only the restore, "I have a copy from another phone", so a new phone
// takes its copy before setup. Its title is announced as it opens on the phone.
// Back, or the phone's back gesture, returns to the welcome; the page closes
// before the restore opens, so its back gesture never outlives it under the
// restore. Its top is the board's, as the welcome's, for the light status bar.

import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent } from 'react';
import { AccessibilityInfo, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { OptionRow } from '../components/OptionRow';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';

/** The page; `onRestore` leads to the restore and `onBack` to the welcome. */
export function WelcomeSettings({ onRestore, onBack }: { onRestore: () => void; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useDeviceText();
  const title = t('welcome.settings');
  const back = useEffectEvent(onBack);
  const announce = useEffectEvent(() => {
    if (!onPc()) AccessibilityInfo.announceForAccessibility(title);
  });
  useEffect(() => {
    announce();
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => listener.remove();
  }, []);
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  return (
    <View testID="welcome-settings-page" style={[styles.screen, { direction }]}>
      <View style={[styles.top, sides, { paddingTop: insets.top + spacing['space-24'] }]}>
        <Text accessibilityRole="header" style={[styles.heading, { writingDirection: direction, textAlign: 'start' }]}>
          {title}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, sides]}>
        <OptionRow
          testID="welcome-restore"
          icon={controlIcon('phone')}
          label={t('welcome.restore')}
          onPress={onRestore}
        />
      </ScrollView>
      <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button testID="welcome-settings-back" variant="line" label={t('navigation.back')} onPress={onBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  top: { backgroundColor: colors.board, paddingBottom: spacing['space-16'] },
  content: { flexGrow: 1, gap: spacing['space-16'], paddingVertical: spacing['space-16'] },
  heading: { ...typography.h2, color: colors.chalk },
  foot: { paddingTop: spacing['space-12'], backgroundColor: colors.paper },
});
