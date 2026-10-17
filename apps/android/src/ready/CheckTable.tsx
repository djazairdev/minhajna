// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The September check's table on Setup-7-Ready (#31): for each class, the
// plan's sessions the year gives and those the plan needs, then the TD
// sessions and items, counted apart. TalkBack reads each class as one line.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import type { CheckRow } from './ready-rules';

/** The table of one grade and subject. */
export function CheckTable({ rows, testID }: { rows: readonly CheckRow[]; testID?: string }) {
  const { direction } = useLocale();
  const t = useText();
  const head = (label: string) => <Text style={styles.headText}>{label}</Text>;
  return (
    <View testID={testID} style={[styles.table, { direction }]}>
      <View style={styles.row} importantForAccessibility="no-hide-descendants">
        <View style={[styles.cell, styles.key, styles.head]}>{head(t('ready.classColumn'))}</View>
        {[t('ready.planColumn'), t('ready.tdColumn')].map((label, index) => (
          <View key={label} style={[styles.pair, styles.side]}>
            <View style={[styles.cell, styles.head]}>{head(label)}</View>
            <View style={[styles.row, styles.top]}>
              {[t('ready.gives'), index === 0 ? t('ready.needs') : t('ready.items')].map((sub, at) => (
                <View key={sub} style={[styles.cell, styles.head, styles.half, at === 1 && styles.side]}>
                  {head(sub)}
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
      {rows.map(({ schoolClass, check }) => (
        <View
          key={schoolClass.id}
          testID={`ready-row-${schoolClass.id}`}
          accessible
          accessibilityLabel={t('ready.row', {
            name: schoolClass.name,
            gives: check.gives,
            needs: check.needs,
            tdGives: check.td.gives,
            tdItems: check.td.items,
          })}
          style={[styles.row, styles.top]}
        >
          <View style={[styles.cell, styles.key]}>
            <Text style={styles.name}>{isolate(schoolClass.name)}</Text>
          </View>
          {[check.gives, check.needs, check.td.gives, check.td.items].map((value, at) => (
            <View key={at} style={[styles.cell, styles.value, styles.side]}>
              <Text style={styles.number}>{value}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    overflow: 'hidden',
    backgroundColor: colors.sheet,
  },
  row: { flexDirection: 'row' },
  top: { borderTopWidth: 1, borderTopColor: colors.line },
  side: { borderStartWidth: 1, borderStartColor: colors.line },
  pair: { width: '38%' },
  cell: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['space-2'],
    paddingVertical: spacing['space-4'],
  },
  key: { width: '24%' },
  value: { width: '19%' },
  half: { width: '50%' },
  head: { minHeight: 30, backgroundColor: colors.due },
  headText: { ...typography.small, color: colors.ink2, textAlign: 'center' },
  name: { ...typography.label, color: colors.ink, textAlign: 'center' },
  number: { ...typography.label, color: colors.ink, fontVariant: ['tabular-nums'] },
});
