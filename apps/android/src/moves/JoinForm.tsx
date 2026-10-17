// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التحاق» (#40, Pupil-move): a pupil who joins the class. The name, the
// sex, the registration number if the official file gives it, the day and
// the reason. The pupil is added at the end of the list, as on the paper
// roll-call book, and called from that day (PRD §3.2).

import { MOVEMENT_REASONS, joinPupil, type Context, type Day, type MovementReason } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { DayChoice } from './DayChoice';

export function JoinForm(props: { context: Context; classId: string; number: number; onDone: () => void }) {
  const { direction } = useLocale();
  const t = useText();
  const { record, newId } = useAppData();
  const [name, setName] = useState('');
  const [sex, setSex] = useState<'m' | 'f' | null>(null);
  const [registration, setRegistration] = useState('');
  const [day, setDay] = useState<Day | null>(null);
  const [reason, setReason] = useState<MovementReason | null>(null);
  const reg = registration.trim();
  const school = props.context.state.classes.get(props.classId)?.schoolId;
  const wrong = reg !== '' && !/^\d+$/.test(reg);
  const taken =
    reg !== '' &&
    [...props.context.state.pupils.values()].some(
      (pupil) => pupil.registration === reg && props.context.state.classes.get(pupil.classId)?.schoolId === school,
    );
  const ready = name.trim() !== '' && sex !== null && day !== null && reason !== null && !wrong && !taken;

  return (
    <View style={styles.form}>
      <TextField
        testID="move-name"
        label={t('move.name')}
        placeholder={t('move.namePlaceholder')}
        value={name}
        onChangeText={setName}
      />
      <ChipGroup
        testID="move-sex"
        label={t('move.sex')}
        choices={[
          { value: 'm', label: t('move.male') },
          { value: 'f', label: t('move.female') },
        ]}
        selected={sex}
        onSelect={setSex}
      />
      <TextField
        testID="move-registration"
        label={t('move.registration')}
        placeholder={t('move.registrationPlaceholder')}
        optionalLabel={t('move.optional')}
        value={registration}
        onChangeText={setRegistration}
        keyboardType="number-pad"
        textDirection="ltr"
        {...(wrong && { error: t('move.registrationError') })}
        {...(taken && { error: t('move.registrationTaken') })}
      />
      <DayChoice testID="move-day" day={day} onDay={setDay} />
      <ChipGroup
        testID="move-reason"
        label={t('move.reason')}
        choices={MOVEMENT_REASONS.map((value) => ({ value, label: t(`move.joinReasons.${value}`) }))}
        selected={reason}
        onSelect={setReason}
      />
      <Text style={[styles.note, { writingDirection: direction, textAlign: 'start' }]}>
        {t('move.joinNote', { number: `\u2066${props.number}\u2069` })}
      </Text>
      <Button
        testID="move-save"
        label={t('move.save')}
        icon={controlIcon('check')}
        disabled={!ready}
        onPress={() => {
          if (sex === null || day === null || reason === null) return;
          const id = `pupil-${newId()}`;
          record(
            joinPupil(props.context, {
              id,
              classId: props.classId,
              name,
              sex,
              day,
              reason,
              ...(reg !== '' && { registration: reg }),
            }),
          );
          props.onDone();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing['space-16'] },
  note: { ...typography.caption, color: colors.ink2 },
});
