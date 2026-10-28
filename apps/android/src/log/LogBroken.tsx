// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تغيّر شيء من خارج التطبيق» (#235, Log-broken, R-5.5-04, answer 427): in
// place of the app, once the lock has opened, when the history's chain
// breaks. It says why this happens, the first day that cannot be checked,
// the changes since then counted by kind, naming no class or pupil, what
// still checks, and that nothing was changed or erased; then the log as far
// as it checks, each later change by its kind and day only. Restoring from a
// copy waits for backup and transfer (#247), and reporting for problem
// reports (#249), so the screen says where they will come from.

import type { CountryProfile, DamagedKind } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import type { BrokenHistory } from '../storage/broken-history';
import { useDeviceText } from '../text/device-text';
import { currentLanguage } from '../text/i18n';
import { logDay } from './log-text';
import { LogList } from './LogList';

const KINDS: readonly DamagedKind[] = ['texts-book', 'roll-call', 'notes', 'other'];

export function LogBroken({ broken, profile }: { readonly broken: BrokenHistory; readonly profile: CountryProfile }) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { damage, state } = broken;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const fact = (testID: string, label: string, lines: readonly string[]) => (
    <View testID={testID} accessible style={styles.fact}>
      <Text style={[styles.label, align]}>{label}</Text>
      {lines.map((line) => (
        <Text key={line} style={[styles.body, align]}>
          {line}
        </Text>
      ))}
    </View>
  );
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingTop: insets.top + spacing['space-16'],
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('log.broken.title')}
      </Text>
      <Text style={[styles.body, align]}>{t('log.broken.why')}</Text>
      <View style={styles.card}>
        {fact('broken-days', t('log.broken.days'), [
          damage.uncheckedFrom === null
            ? t('log.broken.fromUnknown')
            : t('log.broken.from', { day: logDay(damage.uncheckedFrom) }),
        ])}
        {fact(
          'broken-changes',
          t('log.broken.changes'),
          KINDS.filter((kind) => damage.counts[kind] > 0).map((kind) =>
            t(`log.broken.counts.${kind}`, { count: damage.counts[kind] }),
          ),
        )}
        {fact('broken-trusted', t('log.broken.trusted'), [
          damage.trustedThrough === null
            ? t('log.broken.trustedNone')
            : t('log.broken.trustedUntil', { day: logDay(damage.trustedThrough) }),
        ])}
      </View>
      <Notice testID="broken-safe" icon={controlIcon('lock')} message={t('log.broken.safe')} />
      <Notice testID="broken-restore" icon={controlIcon('info')} message={t('log.broken.restore')} />
      <Notice testID="broken-report" icon={controlIcon('info')} message={t('log.broken.report')} />
      <LogList days={damage.log} names={{ state, profile, lang: currentLanguage() }} />
      <Text style={[styles.sub, align]}>{t('log.kept')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'] },
  title: { ...typography.h2, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
  label: { ...typography.label, color: colors.ink2 },
  card: {
    gap: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    padding: spacing['space-14'],
    backgroundColor: colors.sheet,
  },
  fact: { gap: spacing['space-4'] },
});
