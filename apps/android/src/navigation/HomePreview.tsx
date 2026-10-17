// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The tabs' stand-in pages until Today, Classes and Documents are built: the
// hero, the tab's name, an inner screen that covers the tabs, and Help.

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useLocale, type CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { WelcomeHero } from '../components/WelcomeHero';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import type { HomeTabParamList, RootStackParamList } from './AppNavigator';

/** Each tab's label in the catalogue. */
export const tabLabels = {
  Today: 'navigation.today',
  Classes: 'navigation.classes',
  Documents: 'navigation.documents',
} as const satisfies Record<keyof HomeTabParamList, string>;

type HomeProps = CompositeScreenProps<
  BottomTabScreenProps<HomeTabParamList>,
  NativeStackScreenProps<RootStackParamList>
>;

/** A tab's page, with no record contents. */
export function HomePreview({ navigation, route }: HomeProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ direction }}>
      <WelcomeHero title={t('name')} tagline={t('tagline')} line={t('latinName')} />
      <View
        style={[
          styles.content,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Text style={styles.tabTitle} accessibilityRole="header">
          {t(tabLabels[route.name])}
        </Text>
        <Button
          variant="line"
          label={t('navigation.openPreview')}
          onPress={() => navigation.navigate('NavigationPreview')}
        />
        <Button variant="line" label={t('help.title')} onPress={() => navigation.navigate('Help')} />
      </View>
    </ScrollView>
  );
}

/** An inner screen that covers the tabs, for the navigation preview. */
export function InnerPreview() {
  const insets = useSafeAreaInsets();
  const t = useText();
  return (
    <ScrollView
      contentContainerStyle={[
        styles.inner,
        {
          paddingBottom: spacing['space-20'] + insets.bottom,
          paddingLeft: spacing['space-20'] + insets.left,
          paddingRight: spacing['space-20'] + insets.right,
        },
      ]}
    >
      <Text style={styles.description}>{t('navigation.previewDescription')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingVertical: spacing['space-20'] },
  tabTitle: { ...typography.h2, color: colors.ink, textAlign: 'center' },
  inner: { flexGrow: 1, padding: spacing['space-20'] },
  description: { ...typography.body, color: colors.ink, textAlign: 'auto' },
});
