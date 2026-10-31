// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A timetable file not accepted in setup (#580, Setup-5c, answer 608): refused,
// with the reason in plain words for the check that failed, its size, its
// format, its signature, the world it was signed in, or no key the phone
// trusts; then what was checked, each check passed up to the one that failed,
// with the school the file claims once its format read, as information only,
// never as a check passed, isolated so a name in other letters keeps its place;
// that nothing from the file was saved and the week drawn stays as it is; and
// what to do, ask the school to send it again, or, for a demo world's, open it
// inside that world. The teacher opens another file, with reading and a file
// that could not be read said, or goes back to the week, by the button or
// Android's back. The reason is said as the view opens: on a PC in its hidden
// live region, elsewhere announced.

import type { PackageCheck } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useState } from 'react';
import { AccessibilityInfo, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Icon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { onPc } from '../text/device-text';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

export type PackageRefusedProps = {
  readonly failed: PackageCheck;
  /** The school the file claims, once its format read, or null. */
  readonly school: string | null;
  readonly busy: boolean;
  /** Whether the last file picked could not be read. */
  readonly unreadable: boolean;
  readonly onAnother: () => void;
  readonly onBack: () => void;
};

const ROWS = ['format', 'school', 'signature', 'world', 'certified'] as const;

/** Why a timetable file was refused, what was checked, and what to do. */
export function PackageRefused({ failed, school, busy, unreadable, onAnother, onBack }: PackageRefusedProps) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const reached = failed === 'size' ? [] : ROWS.slice(0, ROWS.indexOf(failed) + 1);
  const rows = reached.filter((row) => row !== 'school' || school !== null);
  const words = `${t(`week.package.reason.${failed}.title`)} ${t(`week.package.reason.${failed}.line`)}`;
  const [said, setSaid] = useState('');
  const announce = useEffectEvent(() => (onPc() ? setSaid(words) : AccessibilityInfo.announceForAccessibility(words)));
  const backKey = useEffectEvent(onBack);
  useEffect(() => {
    const timer = setTimeout(announce, 0);
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      backKey();
      return true;
    });
    return () => {
      clearTimeout(timer);
      handler.remove();
    };
  }, []);
  const label = (row: (typeof ROWS)[number]) =>
    row === 'school'
      ? t('week.package.check.school', { school: isolate(school ?? '') })
      : t(`week.package.check.${row}`);
  return (
    <ScrollView
      testID="package-refused"
      style={[styles.screen, { direction }]}
      contentContainerStyle={[styles.content, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}
    >
      {onPc() && (
        <Text testID="package-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {said}
        </Text>
      )}
      <View style={styles.card}>
        <View style={styles.head}>
          <Text accessibilityRole="header" style={[styles.heading, align]}>
            {t('week.package.refusedTitle')}
          </Text>
          <Text style={styles.badge}>{t('week.package.refused')}</Text>
        </View>
        <Text style={[styles.title, align]}>{t(`week.package.reason.${failed}.title`)}</Text>
        <Text style={[styles.body, align]}>{t(`week.package.reason.${failed}.line`)}</Text>
      </View>
      {rows.length > 0 && (
        <View style={styles.card}>
          <Text style={[styles.title, align]}>{t('week.package.checked')}</Text>
          {rows.map((row) => {
            const passed = row !== failed;
            const state = row === 'school' ? '' : `: ${t(passed ? 'week.package.passed' : 'week.package.notPassed')}`;
            const icon = row === 'school' ? 'info' : passed ? 'check' : 'cross';
            return (
              <View
                key={row}
                testID={`package-check-${row}`}
                accessible
                accessibilityLabel={`${label(row)}${state}`}
                style={styles.row}
              >
                <Icon name={icon} size={16} color={passed ? colors.ink2 : colors['error-ink']} />
                <Text style={[styles.body, align, styles.grow]}>{label(row)}</Text>
              </View>
            );
          })}
        </View>
      )}
      <Text style={[styles.body, align]}>{t('week.package.saved')}</Text>
      <View style={styles.card}>
        <Text style={[styles.title, align]}>{t('week.package.whatTo')}</Text>
        <Text style={[styles.body, align]}>
          {t(failed === 'world' ? 'week.package.todoWorld' : 'week.package.todoSend')}
        </Text>
      </View>
      <Text accessibilityLiveRegion="polite" style={[styles.body, align]}>
        {busy ? t('week.package.reading') : unreadable ? t('week.package.unreadable') : ''}
      </Text>
      <Button
        testID="package-another"
        variant="line"
        label={t('week.package.another')}
        disabled={busy}
        onPress={onAnother}
      />
      <Button testID="package-back" variant="plain" label={t('week.package.back')} onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-12'] },
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing['space-8'] },
  heading: { ...typography.h2, color: colors.ink, flexShrink: 1 },
  badge: { ...typography.caption, color: colors['error-ink'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  grow: { flex: 1 },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
