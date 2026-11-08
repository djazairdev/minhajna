// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's way back to the dashboard's home (answer 856), over the
// passphrase pages and the reader's home, with a line when the last changes
// did not save and reader mode stays, and the page that shows while the
// history opens or locks, or that says it was refused, with no record on it.

import { useLocale } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Notice } from '../../android/src/components/Notice';
import { controlIcon, Icon } from '../../android/src/design/Icon';
import { colors, sizes, spacing, typography } from '../../android/src/design/tokens';
import type { Refusals } from '../../android/src/shell/ShellParts';
import { useDashboardText } from './text';

/** Back to the dashboard's home, which locks the history first. */
export function ReaderStrip({ onLeave, failed = false }: { readonly onLeave: () => void; readonly failed?: boolean }) {
  const t = useDashboardText();
  const { direction } = useLocale();
  return (
    <View style={[styles.strip, { direction }]}>
      <Pressable testID="reader-leave" accessibilityRole="button" onPress={onLeave} style={styles.leave}>
        <View style={styles.backward}>
          <Icon name="chevron" size={sizes['icon-small']} color={colors.ink} />
        </View>
        <Text style={[styles.words, { writingDirection: direction, textAlign: 'start' }]}>
          {t('dashboard.reader.leave')}
        </Text>
      </Pressable>
      {failed && <Notice testID="reader-leave-failed" icon={controlIcon('info')} message={t('settings.failed')} />}
    </View>
  );
}

/** A blank page while the lock is checked or the history opens, or what was refused. */
export function ReaderWaiting({ referenceRefused, historyRefused }: Refusals) {
  const t = useDashboardText();
  const { direction } = useLocale();
  const lines = [referenceRefused && t('referenceRefused'), historyRefused && t('historyRefused')].filter(
    (line): line is string => typeof line === 'string',
  );
  return (
    <View testID="reader-waiting" style={styles.waiting}>
      {lines.map((line) => (
        <Text
          key={line}
          accessibilityRole="alert"
          style={[styles.refused, { writingDirection: direction, textAlign: 'start' }]}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    alignItems: 'flex-start',
    gap: spacing['space-4'],
    paddingHorizontal: spacing['space-12'],
    paddingVertical: spacing['space-4'],
    backgroundColor: colors.sheet,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  leave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-8'],
    minHeight: sizes.target,
    paddingHorizontal: spacing['space-8'],
  },
  backward: { transform: [{ scaleX: -1 }] },
  words: { ...typography.label, color: colors.ink },
  waiting: { flex: 1, gap: spacing['space-12'], padding: spacing['space-20'], backgroundColor: colors.paper },
  refused: { ...typography.body, color: colors.ink },
});
