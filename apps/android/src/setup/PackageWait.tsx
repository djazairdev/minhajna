// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The week step's wait for the school's timetable (#580, Setup-5a, answer 608):
// it has not arrived; the school sends it signed, as a file, or through its
// space once the school is in the national system, where its code is scanned on
// joining; it holds no pupil data. The teacher opens a file, the signature is
// checked before anything is saved, and a file unsigned or changed after
// signing is refused. Until it arrives, the week drawn by hand stays as it is,
// and the differences show before the school's timetable is accepted; Ramadan's
// times come from the calendar, not the timetable. Reading, a file that could
// not be read, and a package accepted are said, the last once the card is back.

import { useLocale } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

export type PackageWaitProps = {
  readonly busy: boolean;
  readonly unreadable: boolean;
  /** Said once a package was accepted, or null. */
  readonly accepted: string | null;
  readonly onOpen: () => void;
};

/** The school's timetable not arrived yet, and the way to open it from a file. */
export function PackageWait({ busy, unreadable, accepted, onOpen }: PackageWaitProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [said, setSaid] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSaid(accepted ?? ''), 0);
    return () => clearTimeout(timer);
  }, [accepted]);
  return (
    <View testID="package-wait" style={styles.card}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('week.package.waitTitle')}
        </Text>
        <Text style={styles.badge}>{t('week.package.waiting')}</Text>
      </View>
      <Text style={[styles.body, align]}>{t('week.package.waitLine')}</Text>
      <Button testID="package-open" variant="line" label={t('week.package.open')} disabled={busy} onPress={onOpen} />
      <Text style={[styles.sub, align]}>{t('week.package.checkLine')}</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.sub, align]}>
        {busy ? t('week.package.reading') : unreadable ? t('week.package.unreadable') : said}
      </Text>
      <Text style={[styles.label, align]}>{t('week.package.until')}</Text>
      <Text style={[styles.sub, align]}>{t('week.package.untilLine')}</Text>
      <Text style={[styles.sub, align]}>{t('week.package.ramadan')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing['space-8'] },
  title: { ...typography.label, color: colors.ink, flexShrink: 1 },
  badge: { ...typography.caption, color: colors.ink2 },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
});
