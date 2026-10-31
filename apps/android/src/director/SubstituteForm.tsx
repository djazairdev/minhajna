// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The form that records a substitute's appointment on the director's
// assignments and access page (#587, D-Substitute, answer 615): the holder
// among the teachers who hold classes, the substitute among the joined teachers
// other than the holder once one is chosen, appointing refusing the same
// teacher as both, or that none has joined, the directorate's decision
// reference, kept to 40 characters, the holder's classes, all chosen at first,
// the first day among those offered, the first at first, and that it lasts
// until the holder returns; what the substitute receives for each class, the
// plan position and next resource with a plan pack, the signed weeks, the class
// list from the sector's system, none of which a world has, and the timetable's
// new version; what never passes, the holder's unsigned week, the reason for
// the absence and the holder's private notes; and the button that records it,
// pressable once all is chosen.

import { DECISION_MOST, timetableNameKey, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import type { Appointing, SubstituteDesk } from './substitute-session';

export type SubstituteFormProps = {
  readonly desk: SubstituteDesk;
  readonly dayText: (day: Day) => string;
  readonly busy: boolean;
  readonly onAppoint: (choice: Appointing) => void;
};

const PASSES = ['position', 'weeks', 'pupils', 'next', 'timetable'] as const;
const STAYS = ['unsigned', 'reason', 'notes'] as const;

/** The appointment's form: the holder, the substitute, the decision, the classes and the first day. */
export function SubstituteForm({ desk, dayText, busy, onAppoint }: SubstituteFormProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [holderId, setHolder] = useState<string | null>(null);
  const [substituteId, setSubstitute] = useState<string | null>(null);
  const [decision, setDecision] = useState('');
  const [left, setLeft] = useState<readonly string[]>([]);
  const [from, setFrom] = useState<Day | null>(null);
  const holder = desk.holders.find((one) => one.id === holderId) ?? null;
  const classes = (holder?.classes ?? []).filter((one) => !left.includes(timetableNameKey(one)));
  const day = from ?? desk.days[0] ?? null;
  const others = desk.substitutes.filter((one) => one.id !== holderId);
  const substitute = others.find((one) => one.id === substituteId) ?? null;
  const ready = holder !== null && substitute !== null && decision.trim() !== '' && classes.length > 0 && day !== null;
  return (
    <View testID="substitute-form" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.substitute.appoint')}
      </Text>
      <Text style={[styles.small, align]}>{t('demo.substitute.appointLead')}</Text>
      {desk.holders.length === 0 && <Text style={[styles.body, align]}>{t('demo.substitute.noHolders')}</Text>}
      {desk.holders.length > 0 && (
        <ChipGroup
          testID="substitute-holder"
          label={t('demo.substitute.holder')}
          choices={desk.holders.map((one) => ({ value: one.id, label: one.name }))}
          selected={holderId}
          onSelect={(id) => {
            setHolder(id);
            setLeft([]);
          }}
        />
      )}
      {others.length === 0 ? (
        <Text style={[styles.small, align]}>{t('demo.substitute.noSubstitutes')}</Text>
      ) : (
        <ChipGroup
          testID="substitute-who"
          label={t('demo.substitute.substitute')}
          choices={others.map((one) => ({ value: one.id, label: one.name }))}
          selected={substitute?.id ?? null}
          onSelect={setSubstitute}
        />
      )}
      <TextField
        testID="substitute-decision"
        label={t('demo.substitute.decision')}
        placeholder={t('demo.substitute.decisionHint')}
        value={decision}
        onChangeText={(value) => setDecision(value.slice(0, DECISION_MOST))}
      />
      {holder !== null && (
        <ChipGroup
          multiple
          testID="substitute-classes"
          label={t('demo.substitute.classes')}
          choices={holder.classes.map((one) => ({ value: timetableNameKey(one), label: one }))}
          selected={classes.map(timetableNameKey)}
          onSelect={(chosen) => setLeft(holder.classes.map(timetableNameKey).filter((one) => !chosen.includes(one)))}
        />
      )}
      {desk.days.length > 0 && (
        <ChipGroup
          testID="substitute-from"
          label={t('demo.substitute.from')}
          choices={desk.days.map((one) => ({ value: one, label: dayText(one) }))}
          selected={day}
          onSelect={setFrom}
        />
      )}
      <Text style={[styles.small, align]}>{t('demo.substitute.until')}</Text>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.substitute.passes')}
      </Text>
      {PASSES.map((key) => (
        <Text key={key} style={[styles.small, align]}>
          {t(`demo.substitute.pass.${key}`)}
        </Text>
      ))}
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.substitute.stays')}
      </Text>
      {STAYS.map((key) => (
        <Text key={key} style={[styles.small, align]}>
          {t(`demo.substitute.stay.${key}`)}
        </Text>
      ))}
      <Button
        testID="substitute-record"
        label={t('demo.substitute.record')}
        disabled={!ready || busy}
        onPress={() => {
          if (ready) onAppoint({ holder: holder.id, substitute: substitute.id, decision, classes, from: day });
        }}
      />
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
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
