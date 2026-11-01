// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The requests a directorate made, on M-Grant (#593, answer 621), newest
// first: each names the inspector as the request does, the school, how many
// classes, never which teachers, and the signed weeks, then how it stands. A
// grant the school says it made runs until its end and then reads as ended; a
// request the school has but did not answer waits for its director, and lapses
// at its end, since none is declined; one not delivered yet can be sent again
// while it has not lapsed.

import type { Day, DemoSchool } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { personName } from '../director/dashboard-text';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import type { RequestMade } from './request-session';

export type GrantRequestsProps = {
  readonly rows: readonly RequestMade[];
  readonly schools: readonly DemoSchool[];
  readonly dayText: (day: Day) => string;
  readonly busy: boolean;
  readonly onAgain: (row: RequestMade) => void;
};

/** How a request stands, in M-Grant's words. */
function standing(row: RequestMade): 'granted' | 'ended' | 'waiting' | 'undelivered' | 'lapsed' {
  if (row.granted) return row.lapsed ? 'ended' : 'granted';
  if (row.lapsed) return 'lapsed';
  return row.delivered ? 'waiting' : 'undelivered';
}

/** The directorate's requests and how each stands. */
export function GrantRequests({ rows, schools, dayText, busy, onAgain }: GrantRequestsProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const named = (seed: string | null) => {
    const school = schools.find((one) => one.id === seed);
    return school === undefined ? t('demo.grant.unknownSchool') : personName(school);
  };
  return (
    <View testID="grant-requests" style={styles.list}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.grant.requests')}
      </Text>
      {rows.length === 0 && <Text style={[styles.small, align]}>{t('demo.grant.noRequests')}</Text>}
      {[...rows].reverse().map((row) => {
        const { request } = row;
        const state = standing(row);
        return (
          <View key={request.id} testID={`grant-row-${request.id}`} style={styles.row}>
            <Text style={[styles.title, align]}>{request.label}</Text>
            <Text style={[styles.small, align]}>
              {t('demo.grant.row', {
                school: named(row.seed),
                classes: t('demo.grant.count', { count: request.classes.length }),
                from: dayText(request.weeks.from),
                to: dayText(request.weeks.to),
              })}
            </Text>
            <Text testID={`grant-state-${request.id}`} style={[styles.small, align]}>
              {t(`demo.grant.${state}`, { until: dayText(request.until) })}
            </Text>
            {state === 'undelivered' && (
              <Button
                testID={`grant-again-${request.id}`}
                variant="line"
                label={t('demo.grant.again')}
                name={t('demo.grant.againName', { label: request.label, school: named(row.seed) })}
                disabled={busy}
                onPress={() => onAgain(row)}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing['space-8'] },
  head: { ...typography.label, color: colors.ink },
  row: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-12'],
    gap: spacing['space-4'],
  },
  title: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
