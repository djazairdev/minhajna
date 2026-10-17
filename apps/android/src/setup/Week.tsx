// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Getting started, step 4 of 5: the week (#28, Setup-5-Week). The week drawn
// so far, with the day it starts and its sessions a week, or a line saying it
// is not drawn yet, and the way to draw it. Receiving the school's timetable
// by code or file comes later (PRD §2.5), and the screen says so instead of
// offering it; bell times come with #29.

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
import { gridCell, gridLabels } from '../week/grid-labels';
import { classLoads } from '../week/week-rules';
import { SETUP_STEPS } from './Teaching';

/** The fourth step of setup; `onDraw` opens the drawing and `onNext` leads on. */
export function Week({ onDraw, onNext }: { onDraw: () => void; onNext: () => void }) {
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
                t('week.perWeek', {
                  sessions: t('week.sessions', {
                    count: classLoads(timetable.version, classOf, [...state.classes.values()]).total,
                  }),
                }),
              ].join(' · ')}
            </Text>
            <WeekGrid
              testID="week-preview"
              days={labels.days}
              slots={labels.slots}
              cell={(day, slot) => gridCell(t, timetable.version, lookup, labels.cellOf(day, slot))}
              cellName={labels.cellName}
            />
          </View>
        ) : (
          <Text testID="no-week" style={[styles.body, align]}>
            {t('week.noWeek')}
          </Text>
        )}
        <Button testID="week-draw" variant="line" label={drawn ? t('week.edit') : t('week.draw')} onPress={onDraw} />
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
