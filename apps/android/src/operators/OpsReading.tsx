// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the operators' pages say while they read (#618, #619): that they are
// reading, in a polite live region, and a problem as an alert, in the world's
// words, with a way to read again.

import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { problemOf } from '../school/school-join-session';
import { useDeviceText } from '../text/device-text';
import { opsStyles as styles } from './ops-styles';

export type OpsReadingProps = {
  readonly reading: boolean;
  readonly problem: ReturnType<typeof problemOf> | null;
  readonly onAgain: () => void;
  /** The page's own prefix for the button's test ID. */
  readonly testID: string;
};

/** Reading said, and a problem with a way to read again. */
export function OpsReading({ reading, problem, onAgain, testID }: OpsReadingProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <>
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {reading ? t('demo.ops.reading') : ''}
      </Text>
      {problem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[styles.problem, align]}>
            {t(problem)}
          </Text>
          <Button testID={`${testID}-again`} variant="line" label={t('demo.ops.again')} onPress={onAgain} />
        </View>
      )}
    </>
  );
}
