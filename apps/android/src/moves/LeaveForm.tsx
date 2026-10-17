// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مغادرة» (#40, Pupil-move): a pupil who leaves the class. The pupil, from
// the class list in a sheet, the day and the reason. The pupil stays on the
// list, with the reason, until the director's confirmation is recorded,
// which the pupils awaiting it offer below (PRD §3.2).

import {
  MOVEMENT_REASONS,
  confirmDeparture,
  isEnrolled,
  leavePupil,
  pendingDeparture,
  type Context,
  type Day,
  type MovementReason,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { OptionRow } from '../components/OptionRow';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayAndMonth } from '../today/DayMark';
import { DayChoice } from './DayChoice';

export function LeaveForm(props: { context: Context; classId: string; onDone: () => void }) {
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, today, record } = useAppData();
  const [pupilId, setPupilId] = useState<string | null>(null);
  const [day, setDay] = useState<Day | null>(null);
  const [reason, setReason] = useState<MovementReason | null>(null);
  const [choosing, setChoosing] = useState(false);
  const opener = useRef<ViewInstance>(null);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const pupils = [...state.pupils.values()].filter((pupil) => pupil.classId === props.classId);
  const leaving = pupils.filter((pupil) => isEnrolled(pupil, today()) && pendingDeparture(pupil) === null);
  const pending = pupils.filter((pupil) => pendingDeparture(pupil) !== null);
  const chosen = pupilId === null ? undefined : state.pupils.get(pupilId);
  const ready = chosen !== undefined && day !== null && reason !== null && isEnrolled(chosen, day);
  const reasonWords = (code: string) =>
    (MOVEMENT_REASONS as readonly string[]).includes(code) ? t(`move.leaveReasons.${code as MovementReason}`) : code;

  return (
    <View style={styles.form}>
      <View ref={opener} collapsable={false} style={styles.group}>
        <Text style={[styles.label, align]}>{t('move.pupil')}</Text>
        <OptionRow
          testID="move-pupil"
          label={chosen?.name ?? t('move.choose')}
          directional
          onPress={() => setChoosing(true)}
        />
      </View>
      <DayChoice testID="move-day" day={day} onDay={setDay} />
      <ChipGroup
        testID="move-reason"
        label={t('move.reason')}
        choices={MOVEMENT_REASONS.map((value) => ({ value, label: t(`move.leaveReasons.${value}`) }))}
        selected={reason}
        onSelect={setReason}
      />
      <Text style={[styles.note, align]}>{t('move.leaveNote')}</Text>
      <Button
        testID="move-save"
        label={t('move.save')}
        icon={controlIcon('check')}
        disabled={!ready}
        onPress={() => {
          if (pupilId === null || day === null || reason === null) return;
          record(leavePupil(props.context, pupilId, day, reason));
          props.onDone();
        }}
      />
      {pending.length > 0 && (
        <View testID="move-pending" style={styles.pending}>
          <Text accessibilityRole="header" style={[styles.label, align]}>
            {t('move.pending')}
          </Text>
          {pending.map((pupil) => {
            const left = pendingDeparture(pupil);
            return (
              <View key={pupil.id} style={styles.row}>
                <View style={styles.grow}>
                  <Text style={[styles.body, align]}>{pupil.name}</Text>
                  {left !== null && (
                    <Text style={[styles.note, align]}>
                      {t('move.left', {
                        day: dayAndMonth(left.day, currentLanguage(), profile),
                        reason: reasonWords(left.reason),
                      })}
                    </Text>
                  )}
                </View>
                <Button
                  testID={`move-confirm-${pupil.id}`}
                  variant="soft"
                  label={t('move.confirm')}
                  accessibilityHint={t('move.confirmSpoken', { name: pupil.name })}
                  onPress={() => record(confirmDeparture(props.context, pupil.id))}
                />
              </View>
            );
          })}
        </View>
      )}
      <BottomSheet
        testID="move-pupils"
        visible={choosing}
        title={t('move.choose')}
        context={t('move.chooseContext')}
        reassurance={t('move.reassurance')}
        returnFocusRef={opener}
        onClose={() => setChoosing(false)}
      >
        {leaving.map((pupil) => (
          <OptionRow
            key={pupil.id}
            testID={`move-pupil-${pupil.id}`}
            label={pupil.name}
            selected={pupil.id === pupilId}
            onPress={() => {
              setPupilId(pupil.id);
              setChoosing(false);
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing['space-16'] },
  group: { gap: spacing['space-4'] },
  pending: {
    gap: spacing['space-8'],
    padding: spacing['space-12'],
    borderRadius: radius['radius-card'],
    backgroundColor: colors.soft,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  grow: { flex: 1, minWidth: 0 },
  body: { ...typography.body, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
