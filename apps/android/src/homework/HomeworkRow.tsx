// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One piece of homework on the record's page (#214, P67): the day it was
// set over the day it comes back, as the page writes dates, the activity,
// then its two counts, each with its share of the class list, or the count
// alone where the list no longer holds it. Counts not entered yet are blank, as
// they print. Homework that has come back opens its counts, to enter or
// correct them; homework still out is shown only.

import { homeworkPercent, type HomeworkItem } from '@minhajna/core';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';
import { bookDate } from '../documents/texts-book-rows';
import { useText } from '../text/i18n';

export interface HomeworkRowProps {
  readonly item: HomeworkItem;
  /** The page's direction: the subject's. */
  readonly dir: 'rtl' | 'ltr';
  readonly dueToday: boolean;
  readonly chosen: boolean;
  /** Set when the homework has come back, so its counts can be entered. */
  readonly onChoose?: () => void;
  readonly names: { readonly notDone: string; readonly reliedOn: string };
  /** The counting panel, under the row when it is chosen. */
  readonly children?: ReactNode;
}

export function HomeworkRow({ item, dir, dueToday, chosen, onChoose, names, children }: HomeworkRowProps) {
  const t = useText();
  const key = item.session.key;
  const cell = (count: number | undefined) => {
    if (count === undefined) return '';
    const percent = homeworkPercent(count, item.listed);
    return percent === null ? String(count) : `${count} · ${percent}%`;
  };
  const counts = item.count === null ? null : item.count;
  const spoken = [
    bookDate(item.set, dir),
    t('homework.backOn', { day: bookDate(item.due, dir) }),
    item.text,
    counts === null
      ? t('homework.notCounted')
      : `${names.notDone}: ${cell(counts.notDone)}. ${names.reliedOn}: ${cell(counts.reliedOn)}`,
  ].join('. ');
  const body = (
    <>
      <View style={[styles.top, { direction: dir }]}>
        <View style={styles.when}>
          <Text style={[styles.cell, styles.ruled, styles.date]}>{bookDate(item.set, dir)}</Text>
          <Text style={[styles.cell, styles.date]}>{bookDate(item.due, dir)}</Text>
        </View>
        <View style={styles.what}>
          <Text style={styles.cell}>{item.text}</Text>
          {dueToday && counts === null && <Text style={[styles.cell, styles.tag]}>{t('homework.today')}</Text>}
        </View>
      </View>
      <View style={[styles.counts, { direction: dir }]}>
        <Text testID={`homework-${key}-notDone`} style={[styles.cell, styles.count, styles.split]}>
          {cell(counts?.notDone)}
        </Text>
        <Text testID={`homework-${key}-reliedOn`} style={[styles.cell, styles.count]}>
          {cell(counts?.reliedOn)}
        </Text>
      </View>
    </>
  );
  return (
    <View style={[styles.entry, chosen && styles.chosen]}>
      {onChoose === undefined ? (
        <View testID={`homework-row-${key}`} accessible accessibilityLabel={spoken}>
          {body}
        </View>
      ) : (
        <Pressable
          testID={`homework-row-${key}`}
          accessibilityRole="button"
          accessibilityLabel={spoken}
          accessibilityHint={t('homework.countHint')}
          accessibilityState={{ expanded: chosen }}
          onPress={onChoose}
          style={({ pressed }) => [styles.target, pressed && styles.pressed]}
        >
          {body}
        </Pressable>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  entry: { borderBottomWidth: 1.5, borderColor: colors['book-edge'], backgroundColor: colors.sheet },
  chosen: { backgroundColor: colors['alt-day'] },
  pressed: { backgroundColor: colors['link-row'] },
  target: { minHeight: 96, minWidth: 48 },
  top: { flexDirection: 'row', minHeight: 48 },
  when: { width: '34%', borderEndWidth: 1, borderColor: colors.line },
  what: { flex: 1 },
  counts: { flexDirection: 'row', minHeight: 48, borderTopWidth: 1, borderColor: colors.line },
  cell: {
    ...typography.body,
    color: colors.ink,
    paddingHorizontal: spacing['space-8'],
    paddingVertical: spacing['space-4'],
  },
  date: { textAlign: 'center' },
  tag: { color: colors.pencil },
  ruled: { borderBottomWidth: 1, borderStyle: 'dotted', borderColor: colors.line },
  count: { flex: 1, textAlign: 'center', textAlignVertical: 'center' },
  split: { borderEndWidth: 1, borderColor: colors.line },
});
