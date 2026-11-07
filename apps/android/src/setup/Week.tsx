// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's week, to read (Setup-5-Week as Settings shows it, answer
// 808): the timetable as the school sent it, with the day it starts and its
// sessions a week, or a line saying none has arrived. The school's timetable
// arrives through its joining code; the teacher no longer draws it or opens a
// timetable file. A week of two schools counts each school's sessions, and a
// warning lists its clashes, for the schools to settle. The bell-times button
// opens each slot's time at the school (#29), which stays the teacher's.

import { formatDay, weekGrid, type SchoolClass } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { WeekGrid } from '../components/WeekGrid';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { gridCell, gridLabels, schoolTally, slotName, weekMarks } from '../week/grid-labels';
import { classLoads, type Cell } from '../week/week-rules';

/** The week to read; `onTimes` opens the bell times and `onDone` leaves. */
export function Week({ onTimes, onDone }: { onTimes: () => void; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const timetable = state.timetables.at(-1);
  const version = timetable?.version;
  const lookup = { course: (id: string) => state.courses.get(id), schoolClass: (id: string) => state.classes.get(id) };
  const classOf = (courseId: string): SchoolClass | undefined => {
    const course = state.courses.get(courseId);
    return course && state.classes.get(course.classId);
  };
  const held = version !== undefined && (version.entries.length > 0 || version.blocks.length > 0);
  const labels = gridLabels(t, weekGrid(profile, version?.options));
  const classes = [...state.classes.values()];
  const marks = version && weekMarks(version, state, classes);
  const clashes = marks?.clashes ?? [];
  const clashLine = (cell: Cell) =>
    t('week.clashAt', {
      slot: slotName(t, cell),
      items: (version && gridCell(t, version, lookup, cell, { schools: marks?.schools, shown: true })?.spoken) ?? '',
    });
  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView contentContainerStyle={[styles.content, sides]}>
        <Text accessibilityRole="header" style={[styles.heading, align]}>
          {t('week.heading')}
        </Text>
        {held && timetable !== undefined ? (
          <View testID="week-card" style={styles.card}>
            <Text style={[styles.title, align]}>
              {t(timetable.version.source === 'hand' ? 'week.drawn' : 'week.fromSchool')}
            </Text>
            <Text style={[styles.sub, align]}>
              {[
                t('week.from', { date: formatDay(timetable.from) }),
                ...(marks?.schools ? schoolTally(t, timetable.version, classOf, classes, state.schools.values()) : []),
                t('week.perWeek', {
                  sessions: t('week.sessions', { count: classLoads(timetable.version, classOf, classes).total }),
                }),
              ].join(' · ')}
            </Text>
            <WeekGrid
              testID="week-preview"
              days={labels.days}
              slots={labels.slots}
              cell={(day, slot) => {
                const cell = labels.cellOf(day, slot);
                return gridCell(t, timetable.version, lookup, cell, {
                  schools: marks?.schools,
                  clash: marks?.clashAt(cell),
                  kept: marks?.keptAt(cell),
                });
              }}
              cellName={labels.cellName}
            />
          </View>
        ) : (
          <Text testID="no-week" style={[styles.body, align]}>
            {t('week.notArrived')}
          </Text>
        )}
        {clashes.length > 0 && (
          <Notice
            testID="week-clash"
            variant="notice"
            badge={t('week.clash')}
            message={clashes.map(clashLine).join('\n')}
          />
        )}
        <Button testID="week-times" variant="line" label={t('week.times')} onPress={onTimes} />
      </ScrollView>
      <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button testID="week-next" label={t('settings.done')} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    flexGrow: 1,
    gap: spacing['space-16'],
    paddingTop: spacing['space-4'],
    paddingBottom: spacing['space-16'],
  },
  heading: { ...typography.h2, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  title: { ...typography.label, color: colors.ink },
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  foot: { paddingTop: spacing['space-12'], backgroundColor: colors.paper },
});
