// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The insights page in a demo world (#624, answer 695), under the band, opened
// from the row on the teacher's world home: Insights-optin in the state the
// world gives. In a teachers' world, what the insights are for, that taking
// part is off until the teacher turns it on, what is never sent, and the floors
// and the uses the figures are kept to; in a national world, the classes
// stopped in their school's space (InsightsStopped.tsx), or the insights
// retired. Its title and state are said as it opens, on a PC in a hidden live
// region cleared a few seconds later, on the phone as an announcement. Going
// back, by the button or Android's back, returns to the world's home.

import type { Day, InsightsState } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useState } from 'react';
import { AccessibilityInfo, BackHandler, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DemoBand } from '../demo/DemoBand';
import { spacing } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { InsightsRetired, InsightsSchool } from './InsightsStopped';
import { insightsStyles as styles } from './insights-styles';
import type { StoppedClass } from './stopped-classes';

/** How long the hidden words stay, in milliseconds, so browsing the page does not read them twice. */
const SAID_FOR = 5000;

/** What is never sent, as Insights-optin lists it. */
const NEVER = ['dates', 'reasons', 'pupils', 'me', 'school'] as const;

export type InsightsPageProps = {
  readonly state: InsightsState;
  /** The classes a national world stops, or null while they are worked out. */
  readonly stopped: readonly StoppedClass[] | null;
  /** The world's date, written out for the band. */
  readonly date: string;
  readonly dayText: (day: Day) => string;
  /** Back to the world's home. */
  readonly onClose: () => void;
};

/** The insights in the state the world gives. */
export function InsightsPage({ state, stopped, date, dayText, onClose }: InsightsPageProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const title = t('demo.insights.title');
  const sub = t(`demo.insights.sub.${state.kind}`);
  const [said, setSaid] = useState('');
  const announce = useEffectEvent(() => {
    const words = `${title}. ${sub}`;
    if (onPc()) setSaid(words);
    else AccessibilityInfo.announceForAccessibility(words);
  });
  useEffect(() => {
    const timer = setTimeout(announce, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (said === '') return;
    const timer = setTimeout(() => setSaid(''), SAID_FOR);
    return () => clearTimeout(timer);
  }, [said]);
  const back = useEffectEvent(() => {
    onClose();
    return true;
  });
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', back);
    return () => handler.remove();
  }, []);
  return (
    <View testID="insights-page" style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      {onPc() && (
        <Text testID="insights-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {said}
        </Text>
      )}
      <View
        style={[
          styles.bar,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Button testID="insights-back" variant="plain" label={t('demo.entry.back')} onPress={onClose} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {title}
          </Text>
          <Text style={[styles.small, align]}>{sub}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.column}>
          {state.kind !== 'retired' && <Text style={[styles.note, align]}>{t('demo.insights.purpose')}</Text>}
          {state.kind === 'teacher' && (
            <>
              <View testID="insights-off" style={styles.card}>
                <Text accessibilityRole="header" style={[styles.head, align]}>
                  {t('demo.insights.participation')}
                </Text>
                <Text style={[styles.small, align]}>{t('demo.insights.off')}</Text>
              </View>
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
            </>
          )}
          {state.kind === 'school' && (
            <InsightsSchool joined={state.joins.length > 0} stopped={stopped} dayText={dayText} />
          )}
          {state.kind === 'retired' && <InsightsRetired since={state.since} dayText={dayText} />}
        </View>
      </ScrollView>
    </View>
  );
}
