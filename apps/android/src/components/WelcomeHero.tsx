// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../design/tokens';

export type WelcomeHeroProps = {
  readonly title: string;
  readonly tagline: string;
  /** One short sentence under the tagline. */
  readonly line?: string;
  /** The chalk mim above the title, as on the welcome. */
  readonly mark?: boolean;
  /** A title in the smaller size, such as «كل شيء جاهز» at the end of setup. */
  readonly small?: boolean;
};

/**
 * The name in chalk on the board, under the status bar, with the chalk
 * underline and the tagline (docs/design/system/components/WelcomeHero). The
 * title keeps the bundled Ruqaa face's own line box, as the canvas's 1.15
 * clips its lower dots on Android at 200%. It spans the hero, as Android
 * measures a Ruqaa phrase narrower than it draws it and clipped the last word.
 */
export function WelcomeHero({ title, tagline, line, mark = false, small = false }: WelcomeHeroProps) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  return (
    <View
      style={[
        styles.hero,
        {
          direction,
          paddingTop: insets.top + spacing['space-24'],
          paddingLeft: insets.left + spacing['space-24'],
          paddingRight: insets.right + spacing['space-24'],
        },
      ]}
    >
      <Image
        source={{ uri: 'chalk_dust' }}
        resizeMode="repeat"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={styles.dust}
      />
      {mark && <Image source={{ uri: 'minhajna_mim' }} accessible={false} style={styles.mark} />}
      <Text accessibilityRole="header" style={[styles.title, small && styles.small]}>
        {title}
      </Text>
      <Image source={{ uri: 'chalk_line' }} accessible={false} style={styles.underline} />
      <Text style={styles.tagline}>{tagline}</Text>
      {line !== undefined && <Text style={styles.line}>{line}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing['space-4'],
    paddingBottom: spacing['space-24'] + spacing['space-16'],
    borderBottomLeftRadius: radius['radius-hero'],
    borderBottomRightRadius: radius['radius-hero'],
    backgroundColor: colors.board,
    overflow: 'hidden',
  },
  dust: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', tintColor: colors['chalk-dust'] },
  mark: { width: 36, height: 48, tintColor: colors.chalk },
  title: { ...typography.brand, lineHeight: undefined, color: colors.chalk, textAlign: 'center', alignSelf: 'stretch' },
  small: { fontSize: 40 },
  underline: { width: 170, height: 14, tintColor: colors.chalk, opacity: 0.75 },
  tagline: { ...typography.tagline, color: colors.chalk, textAlign: 'center', marginTop: spacing['space-10'] },
  line: { ...typography.fact, color: colors['chalk-80'], textAlign: 'center' },
});
