// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The session's row as the texts book will take it (#34, Entry): the date
// and the time on one side, the lines on the other, ruled like the paper
// book. It is read out as one item, the date first.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamilyForWeight } from '../design/fonts';
import { colors, fontFamilies, radius, spacing, typography } from '../design/tokens';
import type { BookLine } from './book-lines';

export interface BookRowProps {
  /** As the book writes it, yyyy/mm/dd. */
  readonly date: string;
  readonly time: string | null;
  readonly lines: readonly BookLine[];
  readonly testID?: string;
}

export function BookRow({ date, time, lines, testID }: BookRowProps) {
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const spoken = (line: BookLine) => (line.label === undefined ? line.text : `${line.label}: ${line.text}`);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={[date, time, ...lines.map(spoken)].filter(Boolean).join('. ')}
      style={[styles.row, { direction }]}
    >
      <View style={styles.when}>
        <Text style={[styles.cell, styles.ruled]}>{date}</Text>
        {time !== null && <Text style={[styles.cell, styles.ruled]}>{time}</Text>}
      </View>
      <View style={styles.what}>
        {lines.map((line, index) => (
          <Text key={index} style={[styles.cell, align, index < lines.length - 1 && styles.ruled]}>
            {line.label !== undefined && <Text style={styles.label}>{`${line.label}: `}</Text>}
            {line.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors['book-edge'],
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
    overflow: 'hidden',
  },
  when: { width: '36%', borderEndWidth: 1, borderColor: colors.line },
  what: { flex: 1 },
  cell: {
    ...typography.body,
    color: colors.ink,
    paddingHorizontal: spacing['space-8'],
    paddingVertical: spacing['space-4'],
  },
  ruled: { borderBottomWidth: 1, borderStyle: 'dotted', borderColor: colors.line },
  label: { fontFamily: fontFamilyForWeight(fontFamilies.arabic, '700'), fontWeight: '700' },
});
