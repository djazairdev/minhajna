// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's dashboard (#569, PRD §7.6, answer 591), the first page of the
// director's workspace in a national demo world, as D-Dashboard draws it: the
// world's date and that the view follows each sync batch; the thresholds first,
// which say no day is announced until exam thresholds come (#529); then three
// views, the classes' progress, the sessions awaiting confirmation, and each
// teacher's sessions and the cover they gave. The first two list each class and
// subject in the school's order (school-dashboard.ts), with a level to choose
// and, for progress, the classes behind their plan alone, which counts no class
// whose figures are not in the school's space, a table on the PC and a line for
// each row on the phone; the third lists the staff in the school's order, never
// against a statutory load. Its last line says the order, and that nothing is
// ranked by delay, coloured by person or timed. The row's panel, with the last
// signed week, the threshold day's forecast and the visa, follows #549 and
// #529; the teacher's own view, its classes alone, comes with the teacher's
// world mode. Who has joined is given (DashboardPage.tsx), with a line while it
// is not known and an alert, with reading again, when the reading failed. Until
// #549 signs a term of weeks the space holds no figures, so each class shows
// where its teacher stands.

import {
  dashboardCourses,
  schoolGrades,
  shownCourses,
  teacherLoads,
  type CountryProfile,
  type CourseStanding,
  type Day,
  type DemoSchool,
  type TrialTerm,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { SegmentedControl } from '../components/SegmentedControl';
import { Switch } from '../components/Switch';
import { colors, radius, spacing, typography } from '../design/tokens';
import { subjectName } from '../extra/extra-rules';
import { gradeName } from '../setup/names';
import { onPc, useDeviceText } from '../text/device-text';
import { personName } from './dashboard-text';
import { DashboardRow } from './DashboardRow';
import { DashboardTable } from './DashboardTable';
import type { JoinedNote, JoinedProblem } from './use-joined-teachers';

type DashboardView = 'progress' | 'awaiting' | 'sessions';

export type DirectorDashboardProps = {
  readonly school: DemoSchool;
  readonly profile: CountryProfile;
  readonly when: { readonly trial: TrialTerm | null; readonly date: Day };
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
  /** Whether a teacher has joined the school's space; none when not given. */
  readonly joined?: (teacherId: string) => boolean;
  /** A joined teacher's figures for a class and subject, as the school's space holds them. */
  readonly standing?: (classId: string, subject: string) => CourseStanding | null;
  /** The cover a teacher gave, from the cover log. */
  readonly cover?: (teacherId: string) => number;
  /** What is said while who joined is not known, or null. */
  readonly note?: JoinedNote | null;
  /** Why reading who joined failed, or null. */
  readonly problem?: JoinedProblem | null;
  /** Reads who joined again, after a problem. */
  readonly onAgain?: () => void;
};

/** The school's operational view for its director. */
export function DirectorDashboard(props: DirectorDashboardProps) {
  const { school, profile, when, dayText, joined = () => false, standing = () => null, cover = () => 0 } = props;
  const { note = null, problem = null, onAgain } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [view, setView] = useState<DashboardView>('progress');
  const [grade, setGrade] = useState('all');
  const [behindOnly, setBehindOnly] = useState(false);
  const courses = dashboardCourses(school, when, joined, standing);
  const shown = shownCourses(courses, {
    grade: grade === 'all' ? null : grade,
    teacherId: null,
    behindOnly: view === 'progress' && behindOnly,
  });
  return (
    <View testID="director-dashboard" style={styles.page}>
      <Text style={[styles.small, align]}>{t('demo.dashboard.lead', { date: dayText(when.date) })}</Text>
      {note === null ? null : (
        <Text testID="dashboard-note" accessibilityLiveRegion="polite" style={[styles.small, align]}>
          {t(note)}
        </Text>
      )}
      {problem === null ? null : (
        <View style={styles.card}>
          <Text testID="dashboard-problem" accessibilityRole="alert" style={[styles.problem, align]}>
            {t(problem)}
          </Text>
          {onAgain === undefined ? null : (
            <Button testID="dashboard-again" variant="line" label={t('demo.dashboard.again')} onPress={onAgain} />
          )}
        </View>
      )}
      <View testID="dashboard-threshold" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.dashboard.threshold')}
        </Text>
        <Text style={[styles.small, align]}>{t('demo.dashboard.noThreshold')}</Text>
      </View>
      <SegmentedControl
        testID="dashboard-view"
        label={t('demo.dashboard.views')}
        choices={[
          { value: 'progress', label: t('demo.dashboard.progress') },
          { value: 'awaiting', label: t('demo.dashboard.awaitingView') },
          { value: 'sessions', label: t('demo.dashboard.sessions') },
        ]}
        selected={view}
        onSelect={setView}
      />
      {view === 'sessions' ? (
        <View style={styles.card}>
          {teacherLoads(school, cover).map((load) => (
            <View key={load.teacher.id} testID={`dashboard-load-${load.teacher.id}`} accessible style={styles.load}>
              <Text style={[styles.head, align]}>
                {`${personName(load.teacher)} · ${subjectName(profile, load.teacher.subject)}`}
              </Text>
              <Text style={[styles.small, align]}>
                {t('demo.dashboard.load', { sessions: load.sessions, cover: load.cover })}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <>
          <ChipGroup
            testID="dashboard-grade"
            label={t('demo.dashboard.level')}
            choices={[
              { value: 'all', label: t('demo.dashboard.all') },
              ...schoolGrades(school).map((one) => ({ value: one, label: gradeName(profile, one) })),
            ]}
            selected={grade}
            onSelect={setGrade}
          />
          {view === 'progress' && (
            <Switch
              testID="dashboard-behind"
              label={t('demo.dashboard.behindOnly')}
              description={t('demo.dashboard.behindNote')}
              value={behindOnly}
              onValueChange={setBehindOnly}
            />
          )}
          {shown.length > 0 && view === 'progress' && onPc() ? (
            <DashboardTable school={school} courses={shown} subject={(code) => subjectName(profile, code)} />
          ) : (
            <View style={styles.card}>
              {shown.length === 0 ? (
                <Text style={[styles.small, align]}>{t('demo.dashboard.none')}</Text>
              ) : (
                shown.map((course) => (
                  <DashboardRow
                    key={`${course.classId}-${course.subject}-${course.teacher?.id ?? ''}`}
                    school={school}
                    course={course}
                    subject={subjectName(profile, course.subject)}
                    view={view}
                  />
                ))
              )}
            </View>
          )}
        </>
      )}
      <Text style={[styles.small, align]}>
        {t(view === 'sessions' ? 'demo.dashboard.orderStaff' : 'demo.dashboard.order')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-4'],
  },
  load: { paddingVertical: spacing['space-4'], gap: spacing['space-2'] },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.small, color: colors['error-ink'] },
});
