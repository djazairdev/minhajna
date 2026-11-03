// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The frame of a teacher's threshold page (#601, answer 633), under the band:
// on a PC the page's hidden live region (useSaid.tsx); the bar with the way
// back, the title and the joined school's ID shortened; then the page's column,
// which says while the rooms are read, and a problem reading or signing with a
// way to read again.

import { readJoinCode, type SchoolJoined } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DemoBand } from '../demo/DemoBand';
import { colors, radius, spacing, typography } from '../design/tokens';
import type { problemOf } from '../school/school-join-session';
import { shortSchool } from '../school/SchoolJoined';
import { useDeviceText } from '../text/device-text';

export type ThresholdFrameProps = {
  /** The page's test ID, which prefixes its own controls'. */
  readonly testID: string;
  readonly date: string;
  readonly join: SchoolJoined;
  readonly title: string;
  /** The page's hidden live region on a PC (useSaid.tsx), or null. */
  readonly region: ReactNode;
  readonly reading: boolean;
  readonly problem: ReturnType<typeof problemOf> | null;
  readonly onAgain: () => void;
  readonly onClose: () => void;
  readonly children: ReactNode;
};

/** A threshold page's band, bar and column. */
export function ThresholdFrame(props: ThresholdFrameProps) {
  const { testID, date, join, title, region, reading, problem, onAgain, onClose, children } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID={testID} style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      {region}
      <View
        style={[
          styles.bar,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Button testID={`${testID}-back`} variant="plain" label={t('demo.entry.back')} onPress={onClose} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {title}
          </Text>
          <Text style={[styles.small, align]}>
            {t('demo.devices.school', { school: shortSchool(readJoinCode(join.code)?.school ?? '') })}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.column}>
          <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
            {reading ? t('demo.threshold.reading') : ''}
          </Text>
          {problem !== null && (
            <View style={styles.card}>
              <Text accessibilityRole="alert" style={[styles.problem, align]}>
                {t(problem)}
              </Text>
              <Button testID={`${testID}-again`} variant="line" label={t('demo.weekSign.again')} onPress={onAgain} />
            </View>
          )}
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

/** The styles a threshold page's cards and words share. */
export const thresholdStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});

const styles = StyleSheet.create({
  ...thresholdStyles,
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
  problem: { ...typography.body, color: colors['error-ink'] },
});
