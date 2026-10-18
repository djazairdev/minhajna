// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Lock design's board (#210): the chalk mim and the name, one line that
// says what to type, the keypad, then a line for a wrong PIN or a wait, and
// at the foot what the lock does. The line comes under the keypad, so the
// keys never move under a finger when it shows or goes. It scrolls, so that
// text at 200% stays readable on a 360×800 screen.

import { useLocale } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

export type LockBoardProps = {
  /** What to type: the PIN, or the PIN or the fingerprint. */
  readonly prompt: string;
  /** A wrong PIN, a wait or a mismatch. */
  readonly message?: string;
  /** Reads the message out when it changes; off for a countdown, which is announced once. */
  readonly live?: boolean;
  /** A second line under the message, such as why waits grow. */
  readonly detail?: string;
  readonly footer: string;
  readonly children: ReactNode;
};

/** The board behind the keypad, with no record contents on it. */
export function LockBoard({ prompt, message, live = true, detail, footer, children }: LockBoardProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const side = { paddingLeft: insets.left + spacing['space-24'], paddingRight: insets.right + spacing['space-24'] };
  return (
    <View style={styles.board} testID="lock-board">
      <Image
        source={{ uri: 'chalk_dust' }}
        resizeMode="repeat"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={styles.dust}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          side,
          {
            direction,
            paddingTop: insets.top + spacing['space-24'],
            paddingBottom: insets.bottom + spacing['space-24'],
          },
        ]}
      >
        <Image source={{ uri: 'minhajna_mim' }} accessible={false} style={styles.mark} />
        <Text accessibilityRole="header" style={styles.name}>
          {t('name')}
        </Text>
        <Text style={styles.prompt}>{prompt}</Text>
        {children}
        <View style={styles.messages}>
          {message !== undefined && (
            <Text accessibilityLiveRegion={live ? 'polite' : 'none'} style={styles.message}>
              {message}
            </Text>
          )}
          {detail !== undefined && <Text style={styles.detail}>{detail}</Text>}
        </View>
        <Text style={styles.footer}>{footer}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, backgroundColor: colors.board },
  dust: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', tintColor: colors['chalk-dust'] },
  content: { flexGrow: 1, alignItems: 'center', gap: spacing['space-16'] },
  mark: { width: 33, height: 44, tintColor: colors.chalk, marginBottom: -spacing['space-8'] },
  name: { ...typography.brand, fontSize: 44, lineHeight: undefined, color: colors.chalk, textAlign: 'center' },
  prompt: { ...typography.body, color: colors['chalk-82'], textAlign: 'center' },
  messages: { minHeight: typography.body.lineHeight, alignSelf: 'stretch', gap: spacing['space-4'] },
  message: { ...typography.label, fontSize: 15, lineHeight: 24, color: colors.chalk, textAlign: 'center' },
  detail: { ...typography.small, color: colors['chalk-75'], textAlign: 'center' },
  footer: {
    ...typography.small,
    marginTop: 'auto',
    paddingTop: spacing['space-16'],
    color: colors['chalk-75'],
    textAlign: 'center',
  },
});
