// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's access log on School-mine (#593, #594, §5.10, §7.8, R-5.10-14,
// R-7.8-05, answers 621 and 622): each inspector's grant over the teacher's
// signed weeks, as its notice on their channel gives it (grant-notice.ts),
// newest first by the day it was made: that day and the inspector, then the
// inspector as the request labels them, how many signed weeks it opens, counted
// in the language's plural forms, of which classes, as the teacher's own weeks
// on this channel name their courses, left out when none does, as on a new code
// or key, and until when, ended after that day, then each access reported on
// its weeks, newest first, by its day and the week read (access-uses.ts), or
// that none is reported yet; or that no grant was made. A problem reading the
// accesses is said as an alert, the grants still showing. Dates come without a
// clock time, the foot saying the log holds the grants and each access, a
// notice showing as it was given in the school's space, which the demo cannot
// prove, and each access as the inspector's phone reported it, which only the
// school's devices can check.

import {
  compareDays,
  type ChannelWeek,
  type Day,
  type GrantNotice,
  type SchoolJoined,
  type SignedTimetable,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import type { Send, WorldKit } from '../demo/world-session';
import { useAccessUses } from './access-uses';
import { isolate } from './grid-labels';

export type AccessLogProps = {
  readonly notices: readonly SignedTimetable<GrantNotice>[];
  /** The teacher's signed weeks, which name each course's class. */
  readonly weeks: readonly ChannelWeek[];
  readonly date: Day;
  readonly dayText: (day: Day) => string;
  readonly join: SchoolJoined;
  readonly kit: WorldKit;
  readonly send?: Send;
};

/** The inspectors' grants over the teacher's signed weeks, newest first. */
export function AccessLog({ notices, weeks, date, dayText, join, kit, send }: AccessLogProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const classOf = new Map(weeks.map((one) => [one.week.course, one.week.class]));
  const rows = [...notices].sort((a, b) => compareDays(b.value.from, a.value.from));
  const { uses, problem } = useAccessUses(join, notices, date, kit, send);
  return (
    <View testID="mine-access" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.accessLog.title')}
      </Text>
      {rows.length === 0 && <Text style={[styles.body, align]}>{t('demo.accessLog.none')}</Text>}
      {rows.map(({ value }) => {
        const classes = [...new Set(value.weeks.flatMap((one) => classOf.get(one.course) ?? []))];
        return (
          <View key={value.grant} testID={`mine-grant-${value.grant}`} style={styles.row}>
            <Text style={[styles.small, align]}>{t('demo.accessLog.when', { day: dayText(value.from) })}</Text>
            <Text style={[styles.body, align]}>
              {t(classes.length > 0 ? 'demo.accessLog.grant' : 'demo.accessLog.grantNoClasses', {
                label: isolate(value.inspector),
                weeks: t('demo.accessLog.weeks', { count: value.weeks.length }),
                classes: classes.map(isolate).join(' · '),
                until: dayText(value.until),
              })}
            </Text>
            {compareDays(date, value.until) > 0 && (
              <Text style={[styles.small, align]}>{t('demo.accessLog.ended', { until: dayText(value.until) })}</Text>
            )}
            {uses !== null && (uses.get(value.grant) ?? []).length === 0 && (
              <Text style={[styles.small, align]}>{t('demo.accessLog.noUse')}</Text>
            )}
            {(uses?.get(value.grant) ?? []).map((one) => (
              <Text key={`${one.week}/${one.day}/${one.proof}`} style={[styles.body, align]}>
                {t('demo.accessLog.use', { day: dayText(one.day), week: dayText(one.week) })}
              </Text>
            ))}
          </View>
        );
      })}
      {problem !== null && (
        <Text accessibilityRole="alert" style={[styles.problem, align]}>
          {t(problem)}
        </Text>
      )}
      <Text style={[styles.small, align]}>{t('demo.accessLog.foot')}</Text>
      <Text style={[styles.small, align]}>{t('demo.accessLog.given')}</Text>
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
  row: { gap: spacing['space-4'] },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
