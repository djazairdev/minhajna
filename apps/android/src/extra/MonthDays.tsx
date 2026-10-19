// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التاريخ» for a session outside the timetable (#219, Session-extra): a
// month's days on a grid, Sunday first, with the month before and after.
// Only days from `first` to `last` can be chosen, so never a day after
// today; each day is a button that says its full date, and the chosen one
// is marked by its fill and its selected state, not by colour alone. With
// `allows`, only the days it allows can be chosen, such as a class's
// session days for a test (#221).

import type { CountryProfile, Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconButton } from '../components/IconButton';
import { controlIcon } from '../design/Icon';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { addMonths, monthWeeks, type Month } from './extra-rules';

export type MonthDaysProps = {
  readonly month: Month;
  readonly selected: Day | null;
  readonly first: Day;
  readonly last: Day;
  readonly profile: Pick<CountryProfile, 'months'>;
  readonly onMonth: (month: Month) => void;
  readonly onSelect: (day: Day) => void;
  readonly allows?: (day: Day) => boolean;
};

export function MonthDays({ month, selected, first, last, profile, onMonth, onSelect, allows }: MonthDaysProps) {
  const t = useText();
  const { direction } = useLocale();
  const language = currentLanguage();
  const name = profile.months?.[Number(month.slice(5, 7)) - 1]?.[language] ?? month.slice(5, 7);
  const letters = t('extra.letters').split(' ');
  return (
    <View testID="extra-month" style={[styles.box, { direction }]}>
      <View style={styles.head}>
        <View style={styles.flip}>
          <IconButton
            testID="extra-month-before"
            icon={controlIcon('chevron')}
            accessibilityLabel={t('extra.monthBefore')}
            disabled={month <= first.slice(0, 7)}
            onPress={() => onMonth(addMonths(month, -1))}
          />
        </View>
        <Text accessibilityRole="header" style={styles.month}>{`${name} ${month.slice(0, 4)}`}</Text>
        <IconButton
          testID="extra-month-after"
          icon={controlIcon('chevron')}
          accessibilityLabel={t('extra.monthAfter')}
          disabled={month >= last.slice(0, 7)}
          onPress={() => onMonth(addMonths(month, 1))}
        />
      </View>
      <View style={styles.week} importantForAccessibility="no-hide-descendants">
        {letters.map((letter, index) => (
          <Text key={index} style={styles.letter}>
            {letter}
          </Text>
        ))}
      </View>
      {monthWeeks(month).map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((day, column) => {
            if (day === null) return <View key={column} style={styles.cell} />;
            const open = day >= first && day <= last && (allows?.(day) ?? true);
            const chosen = day === selected;
            return (
              <Pressable
                key={column}
                testID={`extra-day-${day}`}
                accessibilityRole="button"
                accessibilityLabel={dayName(t, day, language, profile)}
                accessibilityState={{ disabled: !open, selected: chosen }}
                disabled={!open}
                onPress={() => onSelect(day)}
                style={[styles.cell, chosen && styles.chosen]}
              >
                <Text style={[styles.day, !open && styles.closed, chosen && styles.chosenText]}>
                  {Number(day.slice(8))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing['space-2'],
    marginHorizontal: -spacing['space-8'],
    paddingVertical: spacing['space-8'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flip: { transform: [{ scaleX: -1 }] },
  month: { ...typography.label, color: colors.ink, flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row' },
  letter: { ...typography.small, color: colors.ink2, flex: 1, textAlign: 'center' },
  cell: {
    flex: 1,
    minHeight: sizes.target,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius['radius-button'],
  },
  chosen: { backgroundColor: colors.board },
  day: { ...typography.body, color: colors.ink },
  closed: { color: colors.ink2, textDecorationLine: 'line-through' },
  chosenText: { color: colors.chalk, fontWeight: '700' },
});
