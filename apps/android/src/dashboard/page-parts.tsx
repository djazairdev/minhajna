// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The small pieces every dashboard page uses: its title, in the board's
// lettering, a quiet line, a figure with its label, amber when it needs seeing
// to, a table's link, and a row of chips that filter or choose.

import { useLocale } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamilies, radius, spacing, typography } from '../design/tokens';

/** The page's title. */
export function PageTitle({ children }: { children: ReactNode }) {
  const { direction } = useLocale();
  return (
    <Text accessibilityRole="header" style={[styles.title, { writingDirection: direction, textAlign: 'start' }]}>
      {children}
    </Text>
  );
}

/** A quiet line. */
export function Quiet({ children, testID }: { children: ReactNode; testID?: string }) {
  const { direction } = useLocale();
  return (
    <Text testID={testID} style={[styles.quiet, { writingDirection: direction, textAlign: 'start' }]}>
      {children}
    </Text>
  );
}

/** A figure and what it counts. */
export function Figure({
  value,
  label,
  warn = false,
  testID,
}: {
  value: number;
  label: string;
  warn?: boolean;
  testID?: string;
}) {
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={[styles.figure, warn && styles.warn]}
    >
      <Text style={[styles.value, warn && styles.warnWords, align]}>{String(value)}</Text>
      <Text style={[styles.label, warn && styles.warnWords, align]}>{label}</Text>
    </View>
  );
}

/** A row of figures. */
export function Figures({ children }: { children: ReactNode }) {
  return <View style={styles.figures}>{children}</View>;
}

/** A word in a table's row that acts on it. */
export function RowLink({
  label,
  name,
  onPress,
  testID,
}: {
  label: string;
  name?: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={name ?? label}
      onPress={onPress}
      style={styles.link}
    >
      <Text style={styles.linkWords}>{label}</Text>
    </Pressable>
  );
}

export type ChipChoice = { readonly value: string; readonly label: string };

/** A short row of chips, one chosen. */
export function Chips({
  label,
  choices,
  value,
  onChange,
  testID,
}: {
  label: string;
  choices: readonly ChipChoice[];
  value: string;
  onChange: (value: string) => void;
  testID: string;
}) {
  return (
    <View role="group" accessibilityLabel={label} style={styles.chips}>
      {choices.map((choice) => (
        <Pressable
          key={choice.value}
          testID={`${testID}-${choice.value}`}
          accessibilityRole="button"
          accessibilityState={{ selected: choice.value === value }}
          onPress={() => onChange(choice.value)}
          style={[styles.chip, choice.value === value && styles.chipOn]}
        >
          <Text style={[styles.chipWords, choice.value === value && styles.chipWordsOn]}>{choice.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' },
  linkWords: { ...typography.label, color: colors.ink, textDecorationLine: 'underline' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-6'] },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius['radius-chip'],
    backgroundColor: colors.sheet,
  },
  chipOn: { backgroundColor: colors.board, borderColor: colors.board },
  chipWords: { ...typography.label, color: colors.ink },
  chipWordsOn: { color: colors.chalk },
  title: { fontFamily: fontFamilies.display, fontSize: 26, lineHeight: 34, color: colors.ink },
  quiet: { ...typography.small, color: colors.ink2 },
  figures: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  figure: {
    flexGrow: 1,
    flexBasis: 140,
    gap: spacing['space-2'],
    paddingVertical: spacing['space-10'],
    paddingHorizontal: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
  },
  warn: { backgroundColor: colors.notice, borderColor: colors['notice-edge'] },
  value: { ...typography.h2, color: colors.ink },
  label: { ...typography.small, color: colors.ink2 },
  warnWords: { color: colors['notice-ink'] },
});
