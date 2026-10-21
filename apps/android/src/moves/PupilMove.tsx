// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إضافة أو نقل» (#40, Pupil-move): a pupil who joins or leaves the class,
// with the day and a coded reason (PRD §3.2). It opens from the class's roll
// call. Joining and leaving are two chips until the segmented control comes
// (#136). Each move is recorded in one step, and nothing is sent anywhere.

import { isEnrolled } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { colors, spacing, typography } from '../design/tokens';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { JoinForm } from './JoinForm';
import { LeaveForm } from './LeaveForm';

export function PupilMove({ classId, onDone }: { classId: string; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, calendar, calendarRelease, packs, today } = useAppData();
  const [mode, setMode] = useState<'join' | 'leave'>('join');
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const schoolClass = state.classes.get(classId);
  const pupils = [...state.pupils.values()].filter((pupil) => pupil.classId === classId);
  const listed = pupils.filter((pupil) => isEnrolled(pupil, today())).length;

  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
            paddingBottom: insets.bottom + spacing['space-16'],
          },
        ]}
      >
        <Text style={[styles.note, { writingDirection: direction, textAlign: 'start' }]}>
          {t('move.scope', { class: schoolClass?.name ?? '', pupils: t('setup.pupils', { count: listed }) })}
        </Text>
        <ChipGroup
          testID="move-mode"
          label={t('move.mode')}
          choices={[
            { value: 'join', label: t('move.join') },
            { value: 'leave', label: t('move.leave') },
          ]}
          selected={mode}
          onSelect={setMode}
        />
        {mode === 'join' ? (
          <JoinForm context={context} classId={classId} number={pupils.length + 1} onDone={onDone} />
        ) : (
          <LeaveForm context={context} classId={classId} onDone={onDone} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], padding: spacing['space-16'] },
  note: { ...typography.caption, color: colors.ink2 },
});
