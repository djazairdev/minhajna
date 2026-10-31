// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The timetable entered by hand (#576, D-TT-import, R-7.4-08, answer 594),
// under the page's third source: a form for one weekly session, its class,
// group, subject, teacher and room typed, its day chosen among the working
// days, its start and end typed as times, and its week, every week, A or B. The
// check under the form follows each keystroke: what is still to fill in, a time
// it cannot read, an end before the start, or each clash with the sessions
// entered, naming the class and subject it meets and its entry. Only what
// matters is said aloud, through TalkBack on the phone and the page's hidden
// live region on the PC: a clash as it comes, and, once a field is left, the
// session ready or why it does not read. The button adds the session only when
// it reads and clashes with none, says it was added the same way, and empties
// the form but for the class, the day and the week, ready for the class's next
// session, its focus back on the subject. The sessions entered are listed by
// number, each with a button to remove it, named for its entry; editing one is
// removing it and entering it again (hand-entry.ts). Numbers go on from the
// last given, even after every entry is removed, until another source is chosen
// or the world is left.

import type { ImportedSession, Weekday } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { SegmentedControl } from '../components/SegmentedControl';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { draftText, entryText, handDraft, NO_FIELDS, spokenText, type HandFields } from './hand-entry';

export type TimetableHandProps = {
  /** The sessions entered so far. */
  readonly sessions: readonly ImportedSession[];
  /** The number the next session takes. */
  readonly next: number;
  readonly workingDays: readonly Weekday[];
  readonly onChange: (sessions: readonly ImportedSession[], next: number) => void;
};

type Typed = 'class' | 'group' | 'subject' | 'teacher' | 'room' | 'start' | 'end';

/** The form for one session, its live check, and the sessions entered. */
export function TimetableHand({ sessions, next, workingDays, onChange }: TimetableHandProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [fields, setFields] = useState<HandFields>(NO_FIELDS);
  const [left, setLeft] = useState(false);
  const [added, setAdded] = useState({ words: '', count: 0 });
  const subject = useRef<TextInputInstance>(null);
  const draft = handDraft(fields, sessions, next);
  const spoken = spokenText(t, draft, sessions, left);
  useEffect(() => {
    if (!onPc() && spoken !== '') AccessibilityInfo.announceForAccessibility(spoken);
  }, [spoken]);
  const field = (one: Typed, optional = false) => (
    <TextField
      testID={`tt-hand-${one}`}
      ref={one === 'subject' ? subject : undefined}
      label={t(`ttImport.column.${one}`)}
      placeholder={t(`ttImport.hint.${one}`)}
      optionalLabel={optional ? t('setup.optional') : undefined}
      textDirection={one === 'start' || one === 'end' ? 'ltr' : undefined}
      value={fields[one]}
      onChangeText={(value) => {
        setFields((before) => ({ ...before, [one]: value }));
        setLeft(false);
      }}
      onBlur={() => setLeft(true)}
    />
  );
  const add = () => {
    if (draft.kind !== 'ready') return;
    onChange([...sessions, draft.session], next + 1);
    setFields({ ...NO_FIELDS, class: fields.class, day: fields.day, week: fields.week });
    setLeft(false);
    const words = t('ttImport.handAdded', { number: draft.session.row });
    if (onPc()) setAdded((before) => ({ words, count: before.count + 1 }));
    else AccessibilityInfo.announceForAccessibility(words);
    subject.current?.focus();
  };
  return (
    <View testID="tt-hand" style={styles.form}>
      {field('class')}
      {field('group', true)}
      {field('subject')}
      {field('teacher')}
      {field('room', true)}
      <ChipGroup
        testID="tt-hand-day"
        label={t('ttImport.column.day')}
        choices={workingDays.map((day) => ({ value: String(day), label: t(`week.days.${day}`) }))}
        selected={fields.day === null ? null : String(fields.day)}
        onSelect={(value) => setFields((before) => ({ ...before, day: Number(value) as Weekday }))}
      />
      {field('start')}
      {field('end')}
      <SegmentedControl
        testID="tt-hand-week"
        label={t('ttImport.column.week')}
        choices={[
          { value: 'both', label: t('ttImport.everyWeek') },
          { value: 'A', label: t('ttImport.weekA') },
          { value: 'B', label: t('ttImport.weekB') },
        ]}
        selected={fields.week}
        onSelect={(week) => setFields((before) => ({ ...before, week }))}
      />
      {draftText(t, draft, sessions).map((line, index) => (
        <Text
          key={`check-${index}`}
          testID="tt-hand-check"
          style={[draft.kind === 'problems' ? styles.problem : styles.small, align]}
        >
          {line}
        </Text>
      ))}
      {onPc() && (
        <View accessibilityLiveRegion="polite" style={styles.hidden}>
          <Text testID="tt-hand-said">{spoken}</Text>
          <Text key={added.count} testID="tt-hand-added">
            {added.words}
          </Text>
        </View>
      )}
      <Button testID="tt-hand-add" label={t('ttImport.handAdd')} disabled={draft.kind !== 'ready'} onPress={add} />
      {sessions.length > 0 && (
        <Text accessibilityRole="header" style={[styles.label, align]}>
          {t('ttImport.entered')}
        </Text>
      )}
      {sessions.map((session) => (
        <View key={session.row} testID={`tt-hand-entry-${session.row}`} style={styles.entry}>
          <Text style={[styles.small, styles.grow, align]}>{entryText(t, session)}</Text>
          <Button
            testID={`tt-hand-remove-${session.row}`}
            variant="plain"
            label={t('ttImport.handRemove')}
            name={t('ttImport.handRemoveEntry', { number: session.row })}
            onPress={() =>
              onChange(
                sessions.filter((one) => one.row !== session.row),
                next,
              )
            }
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing['space-8'] },
  entry: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  grow: { flex: 1 },
  label: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
