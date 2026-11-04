// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The insights stopped in a national world (#624, answer 695). For the school
// space's classes, as Insights-optin-school draws it: taking part is off for
// them, with no switch, since a national world runs no insights (choice D6);
// each class, in its school's space from the day its join was certified, is
// stopped, each row read as one line; while the classes are being worked out, a
// line says so; before any join, that this phone has joined no space yet; and
// that their figures are formed in the national system, as totals above the
// school from the signed weeks, in the curriculum report. Retired, as
// Insights-optin-retired draws it: the national system's totals replaced them
// from the first day they were formed, nothing is sent from this phone, and the
// curriculum report takes their place, with what it holds and what it never
// does, and the uses it is never put to.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { personName } from '../director/dashboard-text';
import { shortSchool } from '../school/SchoolJoined';
import { useDeviceText } from '../text/device-text';
import { insightsStyles as styles } from './insights-styles';
import type { StoppedClass } from './stopped-classes';

/** What the curriculum report holds, and what it never does, as Insights-optin-retired lists them. */
const HOLDS = ['median', 'changed', 'reached', 'floors'] as const;
const NEVER = ['figures', 'dates'] as const;

/** The school space's classes, each stopped. */
export function InsightsSchool({
  joined,
  stopped,
  dayText,
}: {
  /** Whether this device joined any school's space. */
  readonly joined: boolean;
  readonly stopped: readonly StoppedClass[] | null;
  readonly dayText: (day: Day) => string;
}) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <>
      <View testID="insights-school" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.insights.participation')}
        </Text>
        <Text style={[styles.small, align]}>{t('demo.insights.school.off')}</Text>
      </View>
      {!joined && (
        <Text testID="insights-no-join" style={[styles.small, align]}>
          {t('demo.insights.school.none')}
        </Text>
      )}
      {joined && stopped === null && (
        <Text testID="insights-working" accessibilityLiveRegion="polite" style={[styles.small, align]}>
          {t('demo.insights.school.working')}
        </Text>
      )}
      {joined && stopped !== null && stopped.length > 0 && (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.insights.school.perClass')}
          </Text>
          {stopped.map((one, index) => {
            const words = [
              one.name ?? t('demo.insights.school.mine'),
              t('demo.insights.school.inSpace', {
                school: one.school === null ? shortSchool(one.space) : personName(one.school),
                date: dayText(one.since),
              }),
              t('demo.insights.school.stopped'),
            ];
            return (
              <View
                key={`${one.space}:${one.assignment}:${one.name ?? ''}`}
                testID="insights-stopped"
                accessible
                accessibilityLabel={words.join('. ')}
                style={[styles.row, index > 0 && styles.ruled]}
              >
                {words.map((line, at) => (
                  <Text key={at} style={[at === 0 ? styles.label : styles.small, align]}>
                    {line}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      )}
      <View style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.insights.school.nationalHead')}
        </Text>
        <Text style={[styles.small, align]}>{t('demo.insights.school.nationalLine')}</Text>
      </View>
    </>
  );
}

/** The insights retired, and the curriculum report in their place. */
export function InsightsRetired({ since, dayText }: { readonly since: Day; readonly dayText: (day: Day) => string }) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <>
      <View testID="insights-retired" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.insights.retired.head')}
        </Text>
        <Text style={[styles.small, align]}>{t('demo.insights.retired.line')}</Text>
        <Text style={[styles.small, align]}>{t('demo.insights.retired.since', { date: dayText(since) })}</Text>
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.insights.retired.report')}
        </Text>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.insights.retired.holdsHead')}
        </Text>
        {HOLDS.map((key) => (
          <Text key={key} style={[styles.label, align]}>
            {t(`demo.insights.retired.holds.${key}`)}
          </Text>
        ))}
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.insights.retired.neverHead')}
        </Text>
        {NEVER.map((key) => (
          <Text key={key} style={[styles.label, align]}>
            {t(`demo.insights.retired.never.${key}`)}
          </Text>
        ))}
        <Text style={[styles.small, align]}>{t('demo.insights.retired.uses')}</Text>
      </View>
    </>
  );
}
