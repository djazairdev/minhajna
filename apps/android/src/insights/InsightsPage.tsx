// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The insights page in a demo world (#624, answer 695), under the band, opened
// from the row on the teacher's world home: Insights-optin in the state the
// world gives. In a teachers' world, what the insights are for, the switch to
// take part, off until the teacher turns it on, with exactly what each class
// sends (InsightsOptin.tsx, #622), what is never sent, and the floors and the
// uses the figures are kept to, then the log of what was sent and what the app
// connects to (InsightsLog.tsx, InsightsHelp.tsx); in a national world, the
// classes stopped in their school's space (InsightsStopped.tsx), or the
// insights retired. Its title and state are said as it opens
// (InsightsScreen.tsx), and going back returns to the world's home.

import type { Day, InsightsState } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { useDeviceText } from '../text/device-text';
import { InsightsScreen } from './InsightsScreen';
import { InsightsRetired, InsightsSchool } from './InsightsStopped';
import { insightsStyles as styles } from './insights-styles';
import type { StoppedClass } from './stopped-classes';
import { useReturnFocus } from './use-return-focus';

/** What is never sent, as Insights-optin lists it. */
const NEVER = ['dates', 'reasons', 'pupils', 'me', 'school'] as const;

export type InsightsPageProps = {
  readonly state: InsightsState;
  /** The classes a national world stops, or null while they are worked out. */
  readonly stopped: readonly StoppedClass[] | null;
  /** The world's date, written out for the band. */
  readonly date: string;
  readonly dayText: (day: Day) => string;
  /** The opt-in with each class's exact sending, in a teachers' world (#622); the plain off card when absent. */
  readonly optin?: ReactNode;
  /** Opens the log of what was sent (InsightsLog.tsx), in a teachers' world. */
  readonly onLog?: () => void;
  /** Opens what the app connects to (InsightsHelp.tsx), in a teachers' world. */
  readonly onHelp?: () => void;
  /** Which link's page is open over this one, hidden under it, to give that link focus back. */
  readonly opened?: 'log' | 'help' | null;
  /** Back to the world's home. */
  readonly onClose: () => void;
};

/** The insights in the state the world gives. */
export function InsightsPage(props: InsightsPageProps) {
  const { state, stopped, date, dayText, optin, onLog, onHelp, opened = null, onClose } = props;
  const rowRef = useReturnFocus(opened);
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <InsightsScreen
      name="insights"
      title={t('demo.insights.title')}
      sub={t(`demo.insights.sub.${state.kind}`)}
      date={date}
      onClose={onClose}
    >
      {state.kind !== 'retired' && <Text style={[styles.note, align]}>{t('demo.insights.purpose')}</Text>}
      {state.kind === 'teacher' && (
        <>
          {optin ?? (
            <View testID="insights-off" style={styles.card}>
              <Text accessibilityRole="header" style={[styles.head, align]}>
                {t('demo.insights.participation')}
              </Text>
              <Text style={[styles.small, align]}>{t('demo.insights.off')}</Text>
            </View>
          )}
          <View testID="insights-never" style={styles.card}>
            <Text accessibilityRole="header" style={[styles.head, align]}>
              {t('demo.insights.never.head')}
            </Text>
            {NEVER.map((key) => (
              <Text key={key} style={[styles.label, align]}>
                {t(`demo.insights.never.${key}`)}
              </Text>
            ))}
          </View>
          <Text style={[styles.small, align]}>{t('demo.insights.floors')}</Text>
          {onLog !== undefined && (
            <RowLink
              ref={rowRef('log')}
              testID="insights-log-open"
              icon={controlIcon('check')}
              title={t('demo.insights.links.log.title')}
              description={t('demo.insights.links.log.line')}
              onPress={onLog}
            />
          )}
          {onHelp !== undefined && (
            <RowLink
              ref={rowRef('help')}
              testID="insights-help-open"
              icon={controlIcon('globe')}
              title={t('demo.help.connectionsHead')}
              description={t('demo.insights.links.help')}
              onPress={onHelp}
            />
          )}
        </>
      )}
      {state.kind === 'school' && (
        <InsightsSchool joined={state.joins.length > 0} stopped={stopped} dayText={dayText} />
      )}
      {state.kind === 'retired' && <InsightsRetired since={state.since} dayText={dayText} />}
    </InsightsScreen>
  );
}
