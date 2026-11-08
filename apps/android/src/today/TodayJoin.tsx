// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today's empty state while no class has arrived (answer 808): the classes,
// their pupils and the timetable come from the school, so it offers to join
// it with the joining code the school gave.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useDeviceText } from '../text/device-text';

/** The card offering to join the school, shown only while the phone has no class. */
export function TodayJoin({ onJoin }: { onJoin: () => void }) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const { state } = useAppData();
  if (state.classes.size > 0) return null;
  return (
    <View testID="today-join" style={styles.card}>
      <Text style={[styles.body, { writingDirection: direction, textAlign: 'start' }]}>
        {t('ready.classesNotArrived')}
      </Text>
      <Button testID="today-join-open" icon={controlIcon('qr')} label={t('join.title')} onPress={onJoin} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-12'],
    padding: spacing['space-14'],
    marginHorizontal: spacing['space-16'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  body: { ...typography.body, color: colors.ink },
});
