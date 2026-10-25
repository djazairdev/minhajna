// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One grade of R-Picture (#246, answers 489 and 490): the sections as rows
// and the subjects as columns, under a heading per school when the rows are
// grouped. A cell gives its latest statement's delay in words and its day as
// dd/mm, and opens that statement; an empty cell says no statement came. The
// grid scrolls sideways when its subjects do not fit, and nothing in it is
// ranked or coloured for a person.

import type { PictureGrade, ProgressStatement, Received } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import type { Translate } from '../documents/document-data';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

/** The delay in words, «لا تأخر» or the sessions behind, and the day as dd/mm. */
export function cellWords(t: Translate, statement: ProgressStatement): { delay: string; day: string } {
  const { sessions } = statement.delay;
  const [, month, day] = statement.day.split('-');
  return {
    delay:
      sessions === 0
        ? t('statement.noDelay')
        : t('reader.picture.behind', { sessions: t('count.sessions', { count: sessions }) }),
    day: `${day}/${month}`,
  };
}

export function PictureGrid({
  part,
  subjects,
  onOpen,
}: {
  readonly part: PictureGrade;
  /** The part's subject codes with their names, in the profile's order. */
  readonly subjects: readonly { readonly code: string; readonly name: string }[];
  readonly onOpen: (id: string) => void;
}) {
  const t = useText();
  const { direction } = useLocale();
  const cell = (section: string, subject: { code: string; name: string }, one: Received | undefined) => {
    const where = `${section} · ${subject.name}`;
    if (one === undefined) {
      return (
        <View
          key={subject.code}
          accessible
          accessibilityLabel={t('reader.picture.emptyCell', { where })}
          style={[styles.cell, styles.empty]}
        >
          <Text style={styles.dash}>—</Text>
        </View>
      );
    }
    const words = cellWords(t, one.statement);
    return (
      <Pressable
        key={subject.code}
        testID={`reader-cell-${section}-${subject.code}`}
        accessibilityRole="button"
        accessibilityLabel={t('reader.picture.cell', { where, ...words })}
        onPress={() => onOpen(one.id)}
        style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
      >
        <Text style={styles.delay}>{words.delay}</Text>
        <Text style={styles.day}>{words.day}</Text>
      </Pressable>
    );
  };
  return (
    <ScrollView horizontal contentContainerStyle={{ direction }}>
      <View style={styles.grid}>
        <View style={styles.row} importantForAccessibility="no-hide-descendants">
          <Text style={[styles.head, styles.side]}>{t('reader.picture.section')}</Text>
          {subjects.map((subject) => (
            <Text key={subject.code} style={[styles.head, styles.column]}>
              {subject.name}
            </Text>
          ))}
        </View>
        {part.groups.map((group) => (
          <View key={group.school ?? ''} style={styles.group}>
            {part.groups.length > 1 && (
              <Text accessibilityRole="header" style={styles.school}>
                {group.school === null ? t('reader.picture.noSchool') : isolate(group.school)}
              </Text>
            )}
            {group.rows.map((row) => (
              <View key={row.section} style={styles.row}>
                <Text style={[styles.section, styles.side]}>{isolate(row.section)}</Text>
                {subjects.map((subject) => cell(row.section, subject, row.cells.get(subject.code)))}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing['space-8'] },
  group: { gap: spacing['space-6'] },
  row: { flexDirection: 'row', gap: spacing['space-6'], alignItems: 'stretch' },
  side: { width: 72 },
  column: { width: 112 },
  head: { ...typography.caption, color: colors.ink2, textAlign: 'center' },
  school: { ...typography.label, color: colors.ink, paddingTop: spacing['space-8'] },
  section: { ...typography.label, color: colors.ink, alignSelf: 'center', textAlign: 'center' },
  cell: {
    width: 112,
    minHeight: sizes.target,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
    padding: spacing['space-6'],
  },
  empty: { backgroundColor: colors.paper, borderStyle: 'dashed' },
  pressed: { backgroundColor: colors.soft },
  delay: { ...typography.caption, color: colors.ink, textAlign: 'center' },
  day: { ...typography.caption, color: colors.ink2 },
  dash: { ...typography.caption, color: colors.ink2 },
});
