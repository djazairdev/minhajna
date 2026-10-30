// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo band (#557, choice D4 of the 0.7.0 demo, answer 571): across the top
// of every screen of a demo world, «نسخة تجريبية · بيانات مختلقة» and the
// world's date, so nobody takes a world for real records. It is the demo's own,
// in the notice's colours (docs/design/system/components/Notice), a strong
// ground under an edge, and shows on the gallery beside the notice until a
// design export gives it a page of its own. It takes the top of the safe area
// itself, so a screen puts it above its navigator, where TalkBack reads it
// first; it reads as one header, and a changed date is announced. It wraps at
// enlarged text and follows the interface's direction.

import { useLocale } from '@react-navigation/native';
import { useContext } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { fontFamilyForWeight } from '../design/fonts';
import { colors, fontFamilies, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

export type DemoBandProps = {
  /** The world's date, written out, such as «الأحد 2 جوان 2030»; null while it is not known. */
  readonly date: string | null;
  readonly testID?: string;
};

/** The band of a demo world, with its date. */
export function DemoBand({ date, testID = 'demo-band' }: DemoBandProps) {
  const t = useText();
  const { direction } = useLocale();
  const top = useContext(SafeAreaInsetsContext)?.top ?? 0;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const band = t('demo.band');
  const when = date === null ? null : t('demo.date', { date });
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="header"
      accessibilityLabel={when === null ? band : `${band}. ${when}`}
      accessibilityLiveRegion="polite"
      style={[styles.band, { direction, paddingTop: top + spacing['space-6'] }]}
    >
      <Text style={[styles.words, align]}>{band}</Text>
      {when !== null && <Text style={[styles.date, align]}>{when}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    paddingVertical: spacing['space-6'],
    paddingHorizontal: spacing['space-16'],
    backgroundColor: colors['notice-strong'],
    borderBottomWidth: 1.5,
    borderBottomColor: colors['notice-edge'],
  },
  words: {
    ...typography.fact,
    fontFamily: fontFamilyForWeight(fontFamilies.arabic, '700'),
    fontWeight: '700',
    color: colors['notice-ink'],
  },
  date: { ...typography.small, color: colors['notice-ink'] },
});
