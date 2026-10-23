// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The head of an entry (#239, Marks-test, Marks-exam, answers 440 and 451):
// what is entered with the class, its day or period and maximum, how many of
// its pupils are done, and a bar.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

export type EntryHeadProps = {
  readonly heading: string;
  readonly line: string;
  readonly done: number;
  readonly total: number;
};

export function EntryHead({ heading, line, done, total }: EntryHeadProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <>
      <View accessible style={styles.head}>
        <Text testID="entry-heading" style={[styles.title, align]}>
          {heading}
        </Text>
        <View style={styles.line}>
          <Text style={[styles.note, styles.grow, align]}>{line}</Text>
          <Text testID="entry-progress" style={styles.progress}>
            {t('marks.entry.progress', { done, total })}
          </Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.bar, { width: `${total === 0 ? 0 : (done * 100) / total}%` }]} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing['space-2'] },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: spacing['space-8'] },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
  bar: { height: 4, backgroundColor: colors.board },
  grow: { flex: 1 },
  title: { ...typography.label, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  progress: { ...typography.label, color: colors.ink },
});
