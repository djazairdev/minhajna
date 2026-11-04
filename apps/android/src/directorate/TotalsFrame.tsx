// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What M-Totals and N-Totals share (#598, #599, answers 629 and 630): the
// lead that says no figure is a school's or a teacher's, then, once the
// world's date has reached an announced day after the first term's end, the
// page's header for the day chosen and its term, that the figures are as added
// up that day, the choice among the days reached, and the day's figures in two
// tabs, what the system owes teachers and the curriculum report, the tab kept
// as the day changes; before such a day, that totals are added up only on
// announced days. A day not added up yet says so, and a problem is said as an
// alert, announced on the phone since a PC reads the alert, with a button that
// reads the day again. The page's last words say what the totals never do.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { useSaid } from '../week/useSaid';
import type { TotalsDay, TotalsView } from './use-totals';

export type TotalsFrameProps<T> = {
  readonly testID: string;
  readonly view: TotalsView<T>;
  readonly lead: string;
  /** The header for the day chosen. */
  readonly header: (day: TotalsDay) => string;
  /** What the totals never do. */
  readonly never: string;
  readonly dayText: (day: Day) => string;
  /** What the system owes teachers. */
  readonly owed: (figures: T) => ReactNode;
  /** The curriculum report; without it there are no tabs. */
  readonly report?: (figures: T) => ReactNode;
};

/** A totals page around its figures, for the announced days the world's date reached. */
export function TotalsFrame<T>({ testID, view, lead, header, never, dayText, owed, report }: TotalsFrameProps<T>) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [tab, setTab] = useState<'owed' | 'report'>('owed');
  const { say, region } = useSaid('', 'totals-said');
  const problem = view.problem === null ? null : t(view.problem);
  const announce = useEffectEvent((words: string | null) => {
    if (words !== null) say(words);
  });
  useEffect(() => {
    announce(problem !== null && !onPc() ? problem : null);
  }, [problem]);
  const figures = view.figures;
  const shown = report === undefined || tab === 'owed' ? 'owed' : 'report';
  return (
    <View testID={testID} style={styles.page}>
      <Text style={[styles.body, align]}>{lead}</Text>
      {view.day === null ? (
        <Text testID="totals-none" style={[styles.body, align]}>
          {t('demo.totals.none')}
        </Text>
      ) : (
        <>
          <Text testID="totals-header" accessibilityRole="header" style={[styles.heading, align]}>
            {header(view.day)}
          </Text>
          <Text style={[styles.body, align]}>{t('demo.totals.asOf', { day: dayText(view.day.day) })}</Text>
          {view.days.length > 1 && (
            <ChipGroup
              testID="totals-day"
              label={t('demo.totals.day')}
              choices={view.days.map(({ day }) => ({ value: day, label: dayText(day) }))}
              selected={view.day.day}
              onSelect={view.choose}
            />
          )}
          {problem !== null && (
            <>
              <Text accessibilityRole="alert" style={[styles.problem, align]}>
                {problem}
              </Text>
              <Button testID="totals-again" variant="line" label={t('demo.totals.again')} onPress={view.again} />
            </>
          )}
          {figures === null && (
            <Text testID="totals-waiting" style={[styles.body, align]}>
              {t('demo.totals.notYet')}
            </Text>
          )}
          {figures === undefined && problem === null && (
            <Text style={[styles.body, align]}>{t('demo.totals.reading')}</Text>
          )}
          {figures !== null && figures !== undefined && (
            <>
              {report !== undefined && (
                <SegmentedControl
                  testID="totals-tab"
                  label={t('demo.totals.tabs')}
                  choices={[
                    { value: 'owed', label: t('demo.totals.owed') },
                    { value: 'report', label: t('demo.totals.report') },
                  ]}
                  selected={tab}
                  onSelect={setTab}
                />
              )}
              {report === undefined ? (
                <View style={styles.page}>{owed(figures)}</View>
              ) : (
                <View
                  role="tabpanel"
                  accessibilityLabel={t(shown === 'owed' ? 'demo.totals.owed' : 'demo.totals.report')}
                  style={styles.page}
                >
                  {shown === 'owed' ? owed(figures) : report(figures)}
                </View>
              )}
            </>
          )}
          <Text style={[styles.body, align]}>{never}</Text>
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
