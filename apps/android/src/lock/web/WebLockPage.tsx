// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's lock pages (#250, Web-unlock design): the board with the chalk mim,
// the name and the tagline beside a paper side that holds the form, under a
// warning when there is one, such as the browser not keeping the data
// (Web-unlock-risk), then a line for a wrong passphrase or a wait, then what
// the lock does, each with a tick. In a narrow window the board sits above the
// form, below the status bar, and the form ends above the gesture bar. The
// board's line says it works offline unless the page says otherwise, as the
// demo worlds' entry does. The message's live region stays in place, empty when
// there is nothing to say, so screen readers announce what comes into it. A
// countdown is not read out each second: its first words go to a hidden live
// region for a few seconds, so a wait is heard once as it starts. The page
// scrolls, so text at 200% stays readable. No record shows on it.

import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { controlIcon } from '../../design/Icon';
import { colors, sizes, spacing, typography } from '../../design/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useText } from '../../text/i18n';

/** From this width, in pixels, the board and the form sit side by side. */
const WIDE = 900;
const FORM_WIDTH = 440;
/** How long a wait's first words stay in the hidden live region, in milliseconds. */
const SAID_FOR = 5000;
const tick = controlIcon('check');

export type WebLockPageProps = {
  readonly title: string;
  /** A wrong passphrase, a wait or a mismatch. */
  readonly message?: string;
  /** Reads the message out when it changes; off for a countdown. */
  readonly live?: boolean;
  /** A second line under the message, such as why waits grow. */
  readonly detail?: string;
  /** What the lock does, one fact a line. */
  readonly facts: readonly string[];
  /** Shown under the title, before the form. */
  readonly warning?: ReactNode;
  /** The board's line under the tagline, which otherwise says the app works offline. */
  readonly boardLine?: string;
  readonly children: ReactNode;
};

/** The board and the paper side of a lock page. */
export function WebLockPage({
  title,
  message,
  live = true,
  detail,
  facts,
  warning,
  boardLine,
  children,
}: WebLockPageProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const side = { paddingLeft: insets.left + spacing['space-24'], paddingRight: insets.right + spacing['space-24'] };
  const { direction } = useLocale();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const counting = useRef(false);
  const [said, setSaid] = useState('');
  useEffect(() => {
    if (live || message === undefined) {
      counting.current = false;
      return;
    }
    if (counting.current) return;
    counting.current = true;
    setSaid(message);
  }, [live, message]);
  useEffect(() => {
    if (said === '') return;
    const timer = setTimeout(() => setSaid(''), SAID_FOR);
    return () => clearTimeout(timer);
  }, [said]);
  return (
    <ScrollView
      testID="web-lock"
      style={styles.page}
      contentContainerStyle={[styles.content, wide && styles.wide, { direction }]}
    >
      <View style={[styles.board, wide && styles.boardWide, side, { paddingTop: insets.top + spacing['space-24'] }]}>
        <Image
          source={{ uri: 'chalk_dust' }}
          resizeMode="repeat"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={styles.dust}
        />
        <Image source={{ uri: 'minhajna_mim' }} accessible={false} style={styles.mark} />
        <Text style={styles.name}>{t('name')}</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>
        <Text style={styles.offline}>{boardLine ?? t('lock.web.offline')}</Text>
      </View>
      <View
        style={[
          styles.paper,
          wide && styles.paperWide,
          side,
          { paddingBottom: insets.bottom + spacing['space-24'] },
          wide && { paddingTop: insets.top + spacing['space-24'] },
        ]}
      >
        <View style={styles.form}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {title}
          </Text>
          {warning}
          {children}
          <View style={styles.messages}>
            <Text accessibilityLiveRegion={live ? 'polite' : 'none'} style={[styles.message, align]}>
              {message ?? ''}
            </Text>
            <Text accessibilityLiveRegion="polite" style={styles.hidden}>
              {said}
            </Text>
            {detail !== undefined && <Text style={[styles.detail, align]}>{detail}</Text>}
          </View>
          <View style={styles.facts}>
            {facts.map((fact) => (
              <View key={fact} style={styles.fact}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {tick({ size: sizes['icon-small'], color: colors.ink2 })}
                </View>
                <Text style={[styles.factText, align]}>{fact}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1 },
  wide: { flexDirection: 'row' },
  board: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['space-8'],
    padding: spacing['space-24'],
    backgroundColor: colors.board,
    overflow: 'hidden',
  },
  boardWide: { flex: 1 },
  dust: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', tintColor: colors['chalk-dust'] },
  mark: { width: 36, height: 48, tintColor: colors.chalk },
  name: { ...typography.brand, lineHeight: undefined, color: colors.chalk, textAlign: 'center' },
  tagline: { ...typography.tagline, color: colors.chalk, textAlign: 'center' },
  offline: { ...typography.small, color: colors['chalk-80'], textAlign: 'center' },
  paper: { alignItems: 'center', padding: spacing['space-24'] },
  paperWide: { flex: 1, justifyContent: 'center' },
  form: { width: '100%', maxWidth: FORM_WIDTH, gap: spacing['space-16'] },
  title: { ...typography['web-heading'], color: colors.ink },
  messages: { minHeight: typography.body.lineHeight, gap: spacing['space-4'] },
  message: { ...typography.label, color: colors.ink },
  detail: { ...typography.small, color: colors.ink2 },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  facts: { gap: spacing['space-8'] },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space-8'] },
  factText: { ...typography.small, color: colors.ink2, flexShrink: 1 },
});
