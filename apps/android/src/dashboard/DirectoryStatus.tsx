// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a page says of its calls to the directory: that the server is waking,
// for up to a minute or so, or plainly what went wrong, with a way to try again
// when the page gives one. The live region stays in place, empty when there is
// nothing to say, so a screen reader hears what comes into it.

import { useLocale } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import type { DirectoryCall } from './use-directory-call';

export type DirectoryStatusProps = {
  readonly call: Pick<DirectoryCall, 'waking' | 'problem' | 'detail'>;
  /** The way forward from a problem, as trying again or reading the latest copy. */
  readonly retry?: { readonly label: string; readonly onPress: () => void };
};

/** The line for a page's calls. */
export function DirectoryStatus({ call, retry }: DirectoryStatusProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { waking, problem, detail } = call;
  const words = problem === null ? null : [t(`dashboard.problem.${problem}`), detail].filter(Boolean).join(' ');
  return (
    <View accessibilityLiveRegion="polite" style={[styles.place, { direction }]}>
      {waking && (
        <View testID="dashboard-waking" style={[styles.line, styles.row]}>
          <ActivityIndicator color={colors.ink} />
          <Text style={[styles.words, align]}>{t('dashboard.waking')}</Text>
        </View>
      )}
      {words !== null && (
        <View testID="dashboard-problem" style={[styles.line, styles.warn]}>
          <Text accessibilityRole="alert" style={[styles.words, styles.warnWords, align]}>
            {words}
          </Text>
          {retry !== undefined && (
            <Button testID="dashboard-retry" variant="line" label={retry.label} onPress={retry.onPress} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  place: { gap: spacing['space-8'] },
  line: {
    gap: spacing['space-8'],
    padding: spacing['space-12'],
    borderRadius: radius['radius-card'],
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.sheet,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  warn: { borderColor: colors['notice-edge'], backgroundColor: colors.notice },
  words: { ...typography.body, color: colors.ink, flexShrink: 1 },
  warnWords: { color: colors['notice-ink'] },
});
