// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// M-Totals, the directorate's totals page in a national demo world (#598,
// §7.9, R-7.9-05 to R-7.9-08, answer 629): it says no figure here is a
// school's or a teacher's, then, once the world's date has reached an
// announced day after the first term's end, the directorate, its wilaya, the
// day chosen and its term, the choice among the days reached, and what the
// system owes teachers on that day (OwedTable.tsx), with where the sessions
// lost come from and that the server never learns one school's figure; before
// such a day, that totals are added up only on announced days. A day not added
// up yet says so, and a problem is said as an alert, announced on the phone
// since a PC reads the alert.

import type { Day, DemoSchool, SchoolCalendar } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChipGroup } from '../components/Chip';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { colors, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { useSaid } from '../week/useSaid';
import { OwedTable } from './OwedTable';
import { useDirectorateTotals } from './use-totals';

export type DirectorateTotalsProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  /** The school whose directorate this is, as the world seeds it. */
  readonly school: Pick<DemoSchool, 'directorateId'>;
  /** The wilaya's name in the interface's language. */
  readonly wilaya: string;
  readonly calendar: SchoolCalendar;
  readonly send?: Send;
  readonly dayText: (day: Day) => string;
  /** A subject's name in the interface's language. */
  readonly subjectName: (code: string) => string;
};

/** The directorate's totals for the announced days the world's date reached. */
export function DirectorateTotals({
  world,
  school,
  wilaya,
  calendar,
  send,
  dayText,
  subjectName,
}: DirectorateTotalsProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const view = useDirectorateTotals(world, calendar, school.directorateId, send);
  const { say, region } = useSaid('', 'totals-said');
  const problem = view.problem === null ? null : t(view.problem);
  const announce = useEffectEvent((words: string | null) => {
    if (words !== null) say(words);
  });
  useEffect(() => {
    announce(problem !== null && !onPc() ? problem : null);
  }, [problem]);
  const term = calendar.year.terms.filter((one) => view.day !== null && one.from <= view.day).at(-1);
  return (
    <View testID="directorate-totals" style={styles.page}>
      <Text style={[styles.body, align]}>{t('demo.totals.lead')}</Text>
      {view.day === null || term === undefined ? (
        <Text testID="totals-none" style={[styles.body, align]}>
          {t('demo.totals.none')}
        </Text>
      ) : (
        <>
          <Text testID="totals-header" style={[styles.heading, align]}>
            {t('demo.totals.header', {
              wilaya,
              day: dayText(view.day),
              number: term.number,
              from: dayText(term.from),
              to: dayText(term.to),
            })}
          </Text>
          <Text style={[styles.body, align]}>{t('demo.totals.asOf', { day: dayText(view.day) })}</Text>
          {view.days.length > 1 && (
            <ChipGroup
              testID="totals-day"
              label={t('demo.totals.day')}
              choices={view.days.map(({ day }) => ({ value: day, label: dayText(day) }))}
              selected={view.day}
              onSelect={view.choose}
            />
          )}
          {problem !== null && (
            <Text accessibilityRole="alert" style={[styles.problem, align]}>
              {problem}
            </Text>
          )}
          {view.figures === null && (
            <Text testID="totals-waiting" style={[styles.body, align]}>
              {t('demo.totals.notYet')}
            </Text>
          )}
          {view.figures === undefined && problem === null && (
            <Text style={[styles.body, align]}>{t('demo.totals.reading')}</Text>
          )}
          {view.figures !== null && view.figures !== undefined && (
            <>
              <Text style={[styles.body, align]}>{t('demo.totals.owedLead')}</Text>
              <OwedTable figures={view.figures} subject={subjectName} />
              <Text style={[styles.body, align]}>{t('demo.totals.closures')}</Text>
            </>
          )}
          <Text style={[styles.body, align]}>{t('demo.totals.never')}</Text>
        </>
      )}
      {region}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  heading: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
