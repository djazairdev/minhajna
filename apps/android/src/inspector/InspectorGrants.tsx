// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// I-Grant on the inspector's home in a national world (#594, §5.10, §7.8,
// R-1.11-05, R-5.10-05, R-5.10-13, R-5.10-14, R-7.8-05, answer 622): the grants
// relayed to this phone (grant-state.ts), newest first, each with its school as
// the world seeds it, in Arabic letters for an Arabic interface and in Latin
// letters otherwise, or that the directorate does not list it, its end, the day
// it was made, the span of its weeks to the last one's last working day, how
// many classes it opens, counted in the language's plural forms, and that each
// class's teacher sees it; then its classes, each by its number until opened
// (GrantClass.tsx), in the order the grant first names them. A grant past its
// end says it has ended and that nothing it opened is kept, and its classes
// show no button. While reading it says so, and with none relayed it says so; a
// problem reading is an alert and keeps the grants already read. The foot says
// what never shows and that each class opened shows in its teacher's access
// log, by date without a clock time.

import { compareDays, type Day, type DeliveryReading, type DemoSchool, type Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { personName } from '../director/dashboard-text';
import { isolate } from '../week/grid-labels';
import { weekEnd } from '../week/week-sign-session';
import { GrantClass } from './GrantClass';
import { useInspectorGrants } from './grant-state';

export type InspectorGrantsProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  /** The directorate's seeded ID, whose space the grants are relayed through. */
  readonly directorate: string;
  /** The world's seeded schools, which name a grant's school. */
  readonly schools: readonly Pick<DemoSchool, 'id' | 'name' | 'latinName'>[];
  /** How a class's delivery reads the calendar. */
  readonly reading: DeliveryReading;
  /** The country's working days, on which a week's span ends. */
  readonly workingDays: readonly Weekday[];
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
};

/** The grants relayed to the inspector's phone, and their classes. */
export function InspectorGrants(props: InspectorGrantsProps) {
  const { world, directorate, schools, reading, workingDays, kit, send, dayText } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const state = useInspectorGrants(world, directorate, reading, kit, send);
  const nameOf = (school: string | null) => {
    const found = schools.find((one) => one.id === school);
    return found === undefined ? t('demo.inspectorGrant.unlisted') : personName(found);
  };
  return (
    <View testID="inspector-grants" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.inspectorGrant.title')}
      </Text>
      {state.grants === null && state.reading && (
        <Text testID="inspector-grants-reading" style={[styles.small, align]}>
          {t('demo.inspectorGrant.reading')}
        </Text>
      )}
      {state.problem !== null && (
        <Text accessibilityRole="alert" style={[styles.problem, align]}>
          {t(state.problem)}
        </Text>
      )}
      {state.grants?.length === 0 && <Text style={[styles.body, align]}>{t('demo.inspectorGrant.none')}</Text>}
      {state.grants?.map(({ grant, school, ended }) => {
        const courses = [...new Set(grant.weeks.map((one) => one.course))];
        const days = grant.weeks.map((one) => one.week).sort(compareDays);
        return (
          <View key={grant.id} testID={`inspector-grant-${grant.id}`} style={styles.grant}>
            <Text style={[styles.title, align]}>{isolate(nameOf(school))}</Text>
            <Text style={[styles.body, align]}>{t('demo.inspectorGrant.until', { until: dayText(grant.until) })}</Text>
            <Text style={[styles.small, align]}>
              {t('demo.inspectorGrant.made', {
                day: dayText(grant.from),
                from: dayText(days[0]),
                to: dayText(weekEnd(days.at(-1)!, workingDays)),
                classes: t('demo.inspectorGrant.classes', { count: courses.length }),
              })}
            </Text>
            {ended && (
              <Text testID={`inspector-grant-${grant.id}-ended`} style={[styles.body, align]}>
                {t('demo.inspectorGrant.ended', { until: dayText(grant.until) })}
              </Text>
            )}
            <Text accessibilityRole="header" style={[styles.label, align]}>
              {t('demo.inspectorGrant.classesHead')}
            </Text>
            {courses.map((course, at) => (
              <GrantClass
                key={course}
                testID={`inspector-grant-${grant.id}-class-${at + 1}`}
                number={at + 1}
                weeks={grant.weeks.filter((one) => one.course === course).map((one) => one.week)}
                workingDays={workingDays}
                opened={state.classOf(grant.id, course)}
                ended={ended}
                dayText={dayText}
                onOpen={() => state.open(grant, course)}
              />
            ))}
          </View>
        );
      })}
      <Text style={[styles.small, align]}>{t('demo.inspectorGrant.foot')}</Text>
      <Text style={[styles.small, align]}>{t('demo.inspectorGrant.footLog')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  grant: { gap: spacing['space-8'] },
  head: { ...typography.label, color: colors.ink },
  title: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
