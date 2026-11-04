// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The frame of each insights page in a demo world (#624, #622): the band, a bar
// with the way back and the page's title and subtitle, and the page's content
// in a scrolling column. Its title and subtitle are said as it opens, and any
// news as it comes, on a PC in a hidden live region cleared a few seconds
// later, on the phone as an announcement. Going back, by the button or
// Android's back, calls onClose.

import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DemoBand } from '../demo/DemoBand';
import { spacing } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { insightsStyles as styles } from './insights-styles';

/** How long the hidden words stay, in milliseconds, so browsing the page does not read them twice. */
const SAID_FOR = 5000;

export type InsightsScreenProps = {
  /** The page's test IDs: `<name>-page`, its back button's `<name>-back`, its hidden words' `<name>-said`. */
  readonly name: string;
  readonly title: string;
  readonly sub: string;
  /** The world's date, written out for the band. */
  readonly date: string;
  /** News the page has to say as it comes, as its opening is said; none when absent. */
  readonly news?: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
};

/** The band, the bar and the page's content. */
export function InsightsScreen({ name, title, sub, date, news, onClose, children }: InsightsScreenProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [said, setSaid] = useState('');
  const announce = useEffectEvent((words: string) => {
    if (onPc()) setSaid(words);
    else AccessibilityInfo.announceForAccessibility(words);
  });
  const opening = useEffectEvent(() => announce(`${title}. ${sub}`));
  useEffect(() => {
    const timer = setTimeout(opening, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (news === undefined) return;
    const timer = setTimeout(() => announce(news), 0);
    return () => clearTimeout(timer);
  }, [news]);
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
    <View testID={`${name}-page`} style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      {onPc() && (
        <Text testID={`${name}-said`} accessibilityLiveRegion="polite" style={styles.hidden}>
          {said}
        </Text>
      )}
      <View
        style={[
          styles.bar,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Button testID={`${name}-back`} variant="plain" label={t('demo.entry.back')} onPress={onClose} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {title}
          </Text>
          <Text style={[styles.small, align]}>{sub}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </View>
  );
}
