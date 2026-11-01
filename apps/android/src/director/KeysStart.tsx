// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys on a device of a demo world that holds no school key (#571, answer
// 600): it says so and offers the two ways, starting the school's key on this
// device, as D-Issue does, or becoming a holder of the key another device
// holds, by showing it a one-time code (HolderWait.tsx). Starting here when
// another device holds the school's key would make a second key, so the note
// says which way fits which device. In a world seeded when it started (#548,
// answer 625) the school's key was made with the world: the first way becomes
// taking that seeded key on this device, and no device is offered to start a
// second; while D-Keys does not know whether the world is seeded, waiting is
// the only way offered, with reading it again when that reading failed.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';

export type KeysStartProps = {
  /** Whether the world holds a seeded key for the school, or null while that is not known. */
  readonly seeded: boolean | null;
  /** Whether reading that failed, to offer reading it again. */
  readonly failed: boolean;
  readonly onStart: () => void;
  readonly onTake: () => void;
  readonly onAgain: () => void;
  readonly onWait: () => void;
};

/** The two ways to hold the school key on a device that holds none. */
export function KeysStart({ seeded, failed, onStart, onTake, onAgain, onWait }: KeysStartProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID="keys-start" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.keys.start.title')}
      </Text>
      {seeded === null ? null : (
        <Text style={[styles.small, align]}>{t(seeded ? 'demo.keys.start.seededNote' : 'demo.keys.start.note')}</Text>
      )}
      <Button testID="keys-start-wait" label={t('demo.keys.start.wait')} onPress={onWait} />
      {seeded === true ? (
        <Button testID="keys-take-seeded" variant="line" label={t('demo.keys.start.take')} onPress={onTake} />
      ) : null}
      {seeded === null && failed ? (
        <Button testID="keys-start-again" variant="line" label={t('demo.keys.start.again')} onPress={onAgain} />
      ) : null}
      {seeded === false ? (
        <Button testID="keys-start-here" variant="line" label={t('demo.keys.start.here')} onPress={onStart} />
      ) : null}
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
