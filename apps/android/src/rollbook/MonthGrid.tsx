// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's month as a table (#217, Month): the names stay at the
// start, the days scroll sideways between them and the totals, «غ», «ح-ف» and
// «تأخر», at the end, opening on the latest days. For Arabic the days are laid
// out in reverse in a left-to-right scroll, since Android starts a right-to-
// left one at its first day and moves it only after layout. Each day's head is
// a button that opens its roll call. A screen reader hears each pupil's row
// once, from the name: the counts, then each day missed in words; the marks and
// totals are not read again cell by cell. Rows grow with the text size.

import { weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
} from 'react-native';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { markKey, type BookDay, type BookRow } from './month-rules';

const NAME = 116;
const DAY = 48;
const TOTAL = 36;

export function MonthGrid(props: {
  readonly days: readonly BookDay[];
  readonly rows: readonly BookRow[];
  readonly onDay: (day: BookDay) => void;
}) {
  const t = useText();
  const { direction } = useLocale();
  const { profile } = useAppData();
  const { fontScale } = useWindowDimensions();
  const language = currentLanguage();
  const scroller = useRef<ScrollViewInstance>(null);
  const scale = Math.max(1, fontScale);
  const row = { height: Math.max(sizes.target, typography.body.lineHeight * scale + spacing['space-8']) };
  const head = { height: Math.max(sizes.target, 2 * typography['grid-head'].lineHeight * scale + spacing['space-8']) };
  const align = { writingDirection: direction, textAlign: 'auto' } as const;
  const hidden = { importantForAccessibility: 'no-hide-descendants' } as const;
  const spoken = (one: BookRow) => {
    const counts = [
      t('classPage.absences', { count: one.count?.absent ?? 0 }),
      t('classPage.lates', { count: one.count?.late.length ?? 0 }),
    ].join('، ');
    const marks = [...one.marks].map(
      ([day, mark]) => `${dayName(t, day, language, profile)} ${t(`rollBook.spoken.${markKey(mark)}`)}`,
    );
    return marks.length === 0
      ? t('rollBook.row', { number: one.number, name: one.name, counts })
      : t('rollBook.rowMarks', { number: one.number, name: one.name, counts, marks: marks.join('، ') });
  };
  const totals = (one: BookRow) => [
    one.count === null || one.count.absent === 0 ? '' : String(one.count.absent),
    one.count === null ? '' : String(one.count.present),
    one.count === null || one.count.late.length === 0 ? '' : String(one.count.late.length),
  ];
  return (
    <View testID="month-grid" style={[styles.table, { direction }]}>
      <View style={[styles.names, { width: NAME * scale }]}>
        <View style={[styles.cell, styles.head, head]}>
          <Text style={[styles.headText, align]}>{t('rollBook.name')}</Text>
        </View>
        {props.rows.map((one) => (
          <View
            key={one.id}
            testID={`month-pupil-${one.id}`}
            accessible
            accessibilityLabel={spoken(one)}
            style={[styles.cell, styles.name, row]}
          >
            <Text style={styles.number}>{one.number}</Text>
            <Text numberOfLines={1} style={[styles.nameText, align]}>
              {one.name}
            </Text>
          </View>
        ))}
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        onContentSizeChange={() => {
          if (direction === 'ltr') scroller.current?.scrollToEnd({ animated: false });
        }}
        style={[styles.days, { direction: 'ltr' }]}
        contentContainerStyle={{ flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }}
      >
        {props.days.map((day) => (
          <View key={day.day} style={{ width: DAY * scale }}>
            <Pressable
              testID={`month-day-${day.day}`}
              accessibilityRole="button"
              accessibilityLabel={t('rollBook.dayButton', { day: dayName(t, day.day, language, profile) })}
              onPress={() => props.onDay(day)}
              style={[styles.cell, styles.head, styles.dayHead, head, { width: DAY * scale }]}
            >
              <Text style={styles.headText}>{Number(day.day.slice(8))}</Text>
              <Text style={styles.letter}>{t(`rollBook.letters.${weekday(day.day)}`)}</Text>
            </Pressable>
            {props.rows.map((one) => (
              <View key={one.id} {...hidden} style={[styles.cell, styles.mark, row]}>
                <Text style={styles.markText}>{one.marks.get(day.day) ?? ''}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      <View {...hidden} style={styles.totals}>
        {(['absent', 'present', 'late'] as const).map((key, index) => (
          <View key={key} style={{ width: TOTAL * scale }}>
            <View style={[styles.cell, styles.head, styles.dayHead, head]}>
              <Text numberOfLines={1} style={styles.headText}>
                {t(`rollBook.${key}`)}
              </Text>
            </View>
            {props.rows.map((one) => (
              <View key={one.id} style={[styles.cell, styles.mark, styles.total, row]}>
                <Text style={styles.figure}>{totals(one)[index]}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.pencil,
    borderRadius: radius['radius-control'],
    overflow: 'hidden',
    backgroundColor: colors.sheet,
  },
  names: { borderEndWidth: 1, borderEndColor: colors.grid },
  days: { flex: 1 },
  totals: { flexDirection: 'row', borderStartWidth: 1, borderStartColor: colors.grid },
  cell: { borderBottomWidth: 1, borderBottomColor: colors.line, justifyContent: 'center' },
  head: { borderBottomColor: colors.grid, paddingHorizontal: spacing['space-6'] },
  dayHead: { alignItems: 'center', borderEndWidth: 1, borderEndColor: colors.line },
  headText: { ...typography['grid-head'], color: colors.ink },
  letter: { ...typography['grid-head'], color: colors.pencil },
  name: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-6'], paddingHorizontal: spacing['space-6'] },
  number: { ...typography['roll-number'], color: colors.pencil, minWidth: 20, textAlign: 'center' },
  nameText: { ...typography.body, color: colors.ink, flex: 1 },
  mark: { alignItems: 'center', borderEndWidth: 1, borderEndColor: colors.line },
  markText: { ...typography['grid-head'], color: colors.ink },
  total: { backgroundColor: colors.paper },
  figure: { ...typography['grid-head'], color: colors.ink },
});
