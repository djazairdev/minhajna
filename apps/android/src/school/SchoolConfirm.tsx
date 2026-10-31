// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's yes before a code joins the school's space (#564, answer 582),
// on School-join: the school's ID shortened, as the code reads it, and the
// button that makes the key and sends; while it sends, the button says so and
// no other can be pressed, and the school's line is left out.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';

export type SchoolConfirmProps = {
  /** The school's ID, shortened, or null while joining. */
  readonly school: string | null;
  readonly onAgree: () => void;
  readonly onCancel: () => void;
};

/** Asks for the teacher's yes to join with a code that reads. */
export function SchoolConfirm({ school, onAgree, onCancel }: SchoolConfirmProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const joining = school === null;
  return (
    <View testID="school-confirm" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.school.confirmTitle')}
      </Text>
      {!joining && <Text style={[styles.small, align]}>{t('demo.school.confirmLine', { school })}</Text>}
      <Button
        testID="school-agree"
        label={t(joining ? 'demo.school.joining' : 'demo.school.agree')}
        disabled={joining}
        onPress={onAgree}
      />
      {!joining && <Button testID="school-cancel" variant="plain" label={t('demo.school.cancel')} onPress={onCancel} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
