// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Getting started, step 4 of 5: the week (#28, Setup-5-Week). The week drawn
// so far, with the day it starts and its sessions a week, or a line saying it
// is not drawn yet, and the way to draw it. Receiving the school's timetable
// by code or file comes later (PRD §2.5), and the screen says so instead of
// offering it. «المواقيت» opens each slot's time at the school (#29). A
// week of two schools counts each school's sessions, and a warning lists its
// clashes, with a button that opens the first on Week-slot.

import { formatDay, weekGrid, type SchoolClass } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { SetupSteps } from '../components/SetupSteps';
import { WeekGrid } from '../components/WeekGrid';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { gridCell, gridLabels, schoolTally, slotName, weekMarks } from '../week/grid-labels';
import { classLoads, type Cell } from '../week/week-rules';
import { SETUP_STEPS } from './Teaching';

/**
 * The fourth step of setup; `onDraw` opens the drawing, `onResolve` opens a clashing slot, `onTimes` the bell times,
 * and `onNext` leads on.
 */
export function Week({
  onDraw,
  onResolve,
  onTimes,
  onNext,
}: {
  onDraw: () => void;
  onResolve: (cell: Cell) => void;
  onTimes: () => void;
  onNext: () => void;
}) {
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
  const drawn = version !== undefined && (version.entries.length > 0 || version.blocks.length > 0);
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
      <SetupSteps testID="setup-steps" count={SETUP_STEPS} reached={4} />
      <ScrollView contentContainerStyle={[styles.content, sides]}>
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.heading, align]}>
            {t('week.heading')}
          </Text>
          <Text style={[styles.sub, align]}>{t('week.intro')}</Text>
        </View>
        {drawn && timetable !== undefined ? (
          <View testID="week-card" style={styles.card}>
            <Text style={[styles.title, align]}>{t('week.drawn')}</Text>
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
                });
              }}
              cellName={labels.cellName}
            />
          </View>
        ) : (
          <Text testID="no-week" style={[styles.body, align]}>
            {t('week.noWeek')}
          </Text>
        )}
        {clashes.length > 0 && (
          <View style={styles.clash}>
            <Notice
              testID="week-clash"
              variant="notice"
              badge={t('week.clash')}
              message={clashes.map(clashLine).join('\n')}
            />
            <Button
              testID="week-resolve"
              variant="line"
              label={t('week.resolve')}
              onPress={() => onResolve(clashes[0])}
            />
          </View>
        )}
        <Button testID="week-draw" variant="line" label={drawn ? t('week.edit') : t('week.draw')} onPress={onDraw} />
        <Button testID="week-times" variant="line" label={t('week.times')} onPress={onTimes} />
        <Notice testID="package-later" icon={controlIcon('info')} message={t('week.packageLater')} />
      </ScrollView>
      <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button testID="week-next" label={t('setup.next')} onPress={onNext} />
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
  intro: { gap: spacing['space-6'] },
  clash: { gap: spacing['space-8'] },
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
