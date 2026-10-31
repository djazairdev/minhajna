// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The frame of Week-sign and Week-fix (#582, #583): the demo band, the page's
// hidden live region on a PC, a bar with the way back, the page's title and
// what it is about, and the page's column, scrolled, within the safe area.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DemoBand } from '../demo/DemoBand';
import { colors, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';

export type WeekPageProps = {
  /** The page's own, and with `-back` its way back's. */
  readonly testID: string;
  /** The world's date, for the band. */
  readonly date: Day;
  /** The hidden live region, or null. */
  readonly region: ReactNode;
  readonly title: string;
  readonly subtitle: string;
  readonly onBack: () => void;
  readonly children: ReactNode;
};

/** A week page under the band, with its bar and its scrolled column. */
export function WeekPage({ testID, date, region, title, subtitle, onBack, children }: WeekPageProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  return (
    <View testID={testID} style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      {region}
      <View style={[styles.bar, sides]}>
        <Button testID={`${testID}-back`} variant="plain" label={t('demo.entry.back')} onPress={onBack} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={[styles.small, { writingDirection: direction, textAlign: 'start' }]}>{subtitle}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'], paddingVertical: spacing['space-8'] },
  titles: { flexShrink: 1 },
  title: { ...typography['bar-title'], color: colors.ink },
  content: {
    flexGrow: 1,
    paddingTop: spacing['space-12'],
    paddingHorizontal: spacing['space-16'],
    alignItems: 'center',
  },
  column: { width: '100%', maxWidth: 640, gap: spacing['space-12'] },
  small: { ...typography.small, color: colors.ink2 },
});
