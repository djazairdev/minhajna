// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// M-Grant's request form (#593, answer 621), as the board draws it but naming
// no teacher (R-7.9-09): the school, from the directorate's own; the inspector
// as the request names them, by subject and district, never a person's name;
// the fingerprint of their key, from the inspectorate's official message; the
// subject, from those the school's teachers teach; the classes, each a chip,
// counted under them, with the board's reminder to name only what the visit
// needs, cleared when the school or the subject changes; and the signed weeks,
// the last four, eight or twelve whole weeks before the world's week, the grant
// ending two weeks after the world's date. The label is cleaned as the request
// keeps it and no longer than it allows. What the inspector sees and does not
// see is listed under it, then the button that requests the grant from the
// school, which says it is sending only while it is, waits while busy and until
// a school is chosen, the inspector named, a fingerprint typed and a class
// chosen.

import { addDays, cleanRecordText, GRANT_LABEL_MOST, type Day, type DemoSchool, type Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { personName } from '../director/dashboard-text';
import { useDeviceText } from '../text/device-text';
import { weekStart } from '../week/week-sign-session';
import type { GrantForm as Form } from './request-session';

const WEEKS = ['4', '8', '12'] as const;
/** How long the grant runs after the world's date, in days. */
const AFTER = 14;
const SEES = ['sees1', 'sees2', 'sees3'] as const;
const NOTS = ['nots1', 'nots2', 'nots3', 'nots4', 'nots5'] as const;

export type GrantFormProps = {
  readonly schools: readonly DemoSchool[];
  readonly date: Day;
  readonly workingDays: readonly Weekday[];
  readonly dayText: (day: Day) => string;
  readonly subjectName: (code: string) => string;
  readonly busy: boolean;
  /** A request is being sent, which the button says. */
  readonly sending: boolean;
  readonly onRequest: (form: Form) => void;
};

/** The request for an inspector's grant, filled in on the directorate's PC. */
export function GrantForm(props: GrantFormProps) {
  const { schools, date, workingDays, dayText, subjectName, busy, sending, onRequest } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [seed, setSeed] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [fingerprint, setFingerprint] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [classes, setClasses] = useState<readonly string[]>([]);
  const [weeks, setWeeks] = useState<(typeof WEEKS)[number]>('8');
  const school = schools.find((one) => one.id === seed) ?? null;
  const subjects = [...new Set(school?.teachers.map((one) => one.subject) ?? [])];
  const taught = subjects.includes(subject ?? '') ? subject : (subjects[0] ?? null);
  const ids = new Set(school?.teachers.filter((one) => one.subject === taught).flatMap((one) => one.classIds) ?? []);
  const names = (school?.classes ?? []).filter((one) => ids.has(one.id)).map((one) => one.name);
  const chosen = classes.filter((one) => names.includes(one));
  const start = weekStart(date, workingDays);
  const from = addDays(start, -7 * Number(weeks));
  const to = addDays(start, -1);
  const until = addDays(date, AFTER);
  const named = cleanRecordText(label);
  const ready = school !== null && taught !== null && named !== '' && fingerprint.trim() !== '' && chosen.length > 0;
  const request = () =>
    school !== null &&
    taught !== null &&
    onRequest({
      school: school.id,
      fingerprint,
      label: named,
      subject: taught,
      classes: chosen,
      weeks: { from, to },
      until,
    });
  const list = (keys: readonly ((typeof SEES)[number] | (typeof NOTS)[number])[]) =>
    keys.map((key) => (
      <Text key={key} style={[styles.small, styles.item, align]}>
        {t(`demo.grant.${key}`)}
      </Text>
    ));
  return (
    <View testID="grant-form" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.grant.title')}
      </Text>
      <ChipGroup
        testID="grant-school"
        label={t('demo.grant.school')}
        choices={schools.map((one) => ({ value: one.id, label: personName(one) }))}
        selected={school?.id ?? null}
        onSelect={(one) => {
          setSeed(one);
          setClasses([]);
        }}
      />
      <TextField
        testID="grant-label"
        label={t('demo.grant.label')}
        placeholder={t('demo.grant.labelPlaceholder')}
        value={label}
        onChangeText={setLabel}
        maxLength={GRANT_LABEL_MOST}
      />
      <Text style={[styles.small, align]}>{t('demo.grant.labelHint')}</Text>
      <TextField
        testID="grant-fingerprint"
        label={t('demo.grant.fingerprint')}
        placeholder="0000-0000-0000-0000"
        value={fingerprint}
        onChangeText={setFingerprint}
        textDirection="ltr"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={[styles.small, align]}>{t('demo.grant.fingerprintHint')}</Text>
      <ChipGroup
        testID="grant-subject"
        label={t('demo.grant.subject')}
        choices={subjects.map((one) => ({ value: one, label: subjectName(one) }))}
        selected={taught}
        onSelect={(one) => {
          setSubject(one);
          setClasses([]);
        }}
      />
      <ChipGroup
        multiple
        testID="grant-class"
        label={t('demo.grant.classes')}
        hint={chosen.length === 0 ? t('demo.grant.none') : t('demo.grant.count', { count: chosen.length })}
        choices={names.map((one) => ({ value: one, label: one }))}
        selected={chosen}
        onSelect={setClasses}
      />
      <Text style={[styles.small, align]}>{t('demo.grant.classesHint')}</Text>
      <ChipGroup
        testID="grant-weeks"
        label={t('demo.grant.weeks')}
        choices={WEEKS.map((one) => ({ value: one, label: t('demo.grant.weeksChoice', { count: Number(one) }) }))}
        selected={weeks}
        onSelect={setWeeks}
      />
      <Text style={[styles.small, align]}>
        {t('demo.grant.range', { from: dayText(from), to: dayText(to), until: dayText(until) })}
      </Text>
      <Text style={[styles.label, align]}>{t('demo.grant.sees')}</Text>
      {list(SEES)}
      <Text style={[styles.label, align]}>{t('demo.grant.nots')}</Text>
      {list(NOTS)}
      <Button
        testID="grant-send"
        label={t(sending ? 'demo.grant.sending' : 'demo.grant.send')}
        disabled={busy || !ready}
        onPress={request}
      />
      <Text style={[styles.small, align]}>{t('demo.grant.keyNote')}</Text>
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
  label: { ...typography.label, color: colors.ink2 },
  small: { ...typography.small, color: colors.ink2 },
  item: { paddingStart: spacing['space-12'] },
});
