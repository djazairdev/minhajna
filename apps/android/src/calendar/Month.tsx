// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { formatDay, formatDayWithMonth, isWeekReset, monthRange, weekday, type CalendarView } from '@minhajna/core';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { IconButton } from '../components/IconButton';
import { controlIcon } from '../design/Icon';
import { localized } from '../setup/names';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { calendarStyles as styles } from './styles';
import { adjacentMonth, calendarWeeks, type CalendarRow } from './view';

/** Dates and week letters are read-only; only the two month-navigation buttons change the view. */
export function Month({
  month,
  rows,
  view,
  schoolId,
  onMonth,
}: {
  month: string;
  rows: readonly CalendarRow[];
  view: CalendarView;
  schoolId: string;
  onMonth: (month: string) => void;
}) {
  const t = useText();
  const { profile, year, state, today } = useAppData();
  const { fontScale } = useWindowDimensions();
  const school = state.schools.get(schoolId)!;
  const language = currentLanguage();
  const weeks = view.teachingWeeks(school);
  const letters = t('extra.letters').split(' ');
  const currentDay = today();
  const name = formatDayWithMonth(monthRange(month).from, language, profile).replace(/^1 /, '');
  return (
    <View>
      <View style={styles.head}>
        <View style={styles.flip}>
          <IconButton
            testID="calendar-before"
            icon={controlIcon('chevron')}
            accessibilityLabel={t('extra.monthBefore')}
            disabled={month <= year.from.slice(0, 7)}
            onPress={() => onMonth(adjacentMonth(month, -1))}
          />
        </View>
        <Text accessibilityRole="header" style={styles.heading}>
          {name}
        </Text>
        <IconButton
          testID="calendar-after"
          icon={controlIcon('chevron')}
          accessibilityLabel={t('extra.monthAfter')}
          disabled={month >= year.to.slice(0, 7)}
          onPress={() => onMonth(adjacentMonth(month, 1))}
        />
      </View>
      <ScrollView horizontal contentContainerStyle={styles.grid}>
        <View style={{ flexGrow: 1, minWidth: 256 * Math.max(1, fontScale) }}>
          <View style={styles.row} importantForAccessibility="no-hide-descendants">
            {[
              t('calendarView.ab'),
              ...Array.from({ length: 7 }, (_, index) => letters[(profile.weekStartsOn + index) % 7]),
            ].map((word, index) => (
              <View key={index} style={styles.cell}>
                <Text style={styles.day}>{word}</Text>
              </View>
            ))}
          </View>
          {calendarWeeks(month, profile.weekStartsOn).map((week) => {
            const letter = weeks.find((one) => one.start === week[0])?.parity;
            return (
              <View key={week[0]} style={styles.row}>
                <View
                  style={styles.cell}
                  accessible
                  accessibilityLabel={t('calendarView.weekLetter', {
                    from: formatDay(week[0]),
                    letter: letter === undefined ? t('calendarView.noLetter') : t(`calendarView.parity.${letter}`),
                  })}
                >
                  <Text style={styles.day}>{letter === undefined ? '—' : t(`calendarView.parity.${letter}`)}</Text>
                </View>
                {week.map((day) => {
                  const ownMonth = day.slice(0, 7) === month;
                  const events = rows.filter(
                    ({ entry, inactive }) => !inactive && entry.from <= day && entry.to >= day,
                  );
                  const label = [
                    t(`week.days.${weekday(day)}`),
                    formatDay(day),
                    day === currentDay ? t('navigation.today') : '',
                    ...events.map(({ entry }) =>
                      isWeekReset(entry)
                        ? localized(entry.name)
                        : `${localized(entry.name)} · ${t(`calendarView.periods.${entry.half ?? 'all'}`)}`,
                    ),
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <View
                      key={day}
                      testID={`calendar-day-${day}`}
                      accessible={ownMonth}
                      accessibilityLabel={label}
                      importantForAccessibility={ownMonth ? 'yes' : 'no-hide-descendants'}
                      style={[
                        styles.cell,
                        !profile.workingDays.includes(weekday(day)) && styles.rest,
                        day === currentDay && styles.today,
                      ]}
                    >
                      <Text style={[styles.day, !ownMonth && styles.outside]}>{Number(day.slice(8))}</Text>
                      {events.length > 0 && <Text style={styles.events}>•</Text>}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
