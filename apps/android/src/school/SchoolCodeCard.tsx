// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The card that takes the school's joining code (#564, #565, answers 582 and
// 587): the phone scans it with its camera, and a PC, which scans none, takes
// its text pasted. During the trial term end, as School-join-trial draws it,
// the card says that taking part is voluntary, from when to when, what joining
// signs, and that paper stays the official record until the national launch; it
// offers joining and «Not now», which goes back to the world's home with no
// question why, and a dashed note under it says the choice goes at the launch.
// For a new phone after a loss (#566), the button scans the school's new code,
// and before any join a link opens that way (Rejoin.tsx).

import { useLocale } from '@react-navigation/native';
import type { Day, TrialTerm } from '@minhajna/core';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { SchoolCodeHead } from './SchoolNotice';

export type SchoolCodeCardProps = {
  /** The trial term end when joining is voluntary on the world's date; otherwise null. */
  readonly trial: TrialTerm | null;
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
  /** Reads a code's pasted text, on a PC. */
  readonly onRead: (text: string) => void;
  /** Scans a code with the camera, on the phone. */
  readonly onScan: () => void;
  /** «Not now», during the trial: back to the world's home. */
  readonly onNotNow: () => void;
  /** Whether the code is the school's new one for a new phone. */
  readonly rejoin?: boolean;
  /** Opens the way for a new phone, offered before any join. */
  readonly onRejoin?: () => void;
};

/** The school's joining code, scanned or pasted, and during the trial the teacher's free choice. */
export function SchoolCodeCard({
  trial,
  dayText,
  onRead,
  onScan,
  onNotNow,
  rejoin = false,
  onRejoin,
}: SchoolCodeCardProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [pasted, setPasted] = useState('');
  const text = pasted.trim();
  const pc = onPc();
  const code = (
    <>
      <SchoolCodeHead />
      {pc && (
        <TextField
          testID="school-paste"
          label={t('demo.school.paste')}
          placeholder={t('demo.school.pastePlaceholder')}
          value={pasted}
          onChangeText={setPasted}
          textDirection="ltr"
          returnKeyType="done"
          onSubmitEditing={() => text !== '' && onRead(text)}
        />
      )}
      <Button
        testID="school-scan"
        label={t(rejoin ? 'demo.school.rejoin.scan' : trial === null ? 'demo.school.scan' : 'demo.school.trial.join')}
        disabled={pc && text === ''}
        onPress={() => (pc ? onRead(text) : onScan())}
      />
    </>
  );
  const link = onRejoin !== undefined && (
    <Button testID="school-rejoin-open" variant="plain" label={t('demo.school.rejoin.open')} onPress={onRejoin} />
  );
  if (trial === null)
    return (
      <View testID="school-code" style={styles.card}>
        {code}
        {link}
      </View>
    );
  return (
    <>
      <View testID="school-trial" style={styles.card}>
        <Text accessibilityRole="header" style={[styles.head, align]}>
          {t('demo.school.trial.title')}
        </Text>
        <Text style={[styles.small, align]}>
          {t('demo.school.trial.window', { from: dayText(trial.from), to: dayText(trial.to), term: trial.term })}
        </Text>
        <Text style={[styles.small, align]}>{t('demo.school.trial.paper')}</Text>
        {code}
        <Button testID="school-not-now" variant="line" label={t('demo.school.trial.notNow')} onPress={onNotNow} />
        {link}
      </View>
      <View style={styles.note}>
        <Text style={[styles.small, align]}>{t('demo.school.trial.note')}</Text>
      </View>
    </>
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
  note: {
    padding: spacing['space-12'],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.rule,
    borderRadius: radius['radius-control'],
  },
});
