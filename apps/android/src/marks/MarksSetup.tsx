// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «عناصر التقويم المستمر» for one class and subject (#238, Marks-setup,
// Marks-setup-sum, answers 430 to 434): the preset's card, with its circular,
// release and rules year, and the curators' points said as theirs; then each
// component with how its marks are gathered and a stepper that stops at its
// range, the teacher's columns with a remove button, «إضافة عمود», and the
// roll-call check row when attendance is among the components. Edits are a
// draft: «حفظ» stays off until something changed and the total reaches the
// scale, the caption saying what is left or over, and the screen tells its
// route when there is a draft to lose. Saved points outside today's ranges
// start at the nearest limit, said, and count as a change to save. A save
// applies from the chosen term on.

import { COLUMN_POINTS, setupOf, setupProblem, setupTotal, type SetupLine } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { ColumnSheet } from './ColumnSheet';
import { courseLabel, termName } from '../exams/course-label';
import { isolate } from '../week/grid-labels';
import { assessmentData, courseMarks, inRange, lineName, presetTitle, totalHint } from './marks-rules';
import { SetupRow } from './SetupRow';

export type MarksSetupProps = {
  readonly courseId: string;
  readonly term: number;
  /** Whether there is a draft to lose. */
  readonly onDirty: (dirty: boolean) => void;
  readonly onSaved: () => void;
};

const shape = (lines: readonly SetupLine[], rollCall: boolean) =>
  JSON.stringify([lines.map((line) => [line.kind, line.id, line.name, line.points]), rollCall]);

export function MarksSetup({ courseId, term, onDirty, onSaved }: MarksSetupProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, record, newId } = useAppData();
  const data = assessmentData(profile);
  const marks = useMemo(
    () => (data === null ? null : courseMarks(state, data, courseId, term)),
    [state, data, courseId, term],
  );
  const start = marks?.assessment ?? null;
  const [lines, setLines] = useState<SetupLine[]>(() => (start === null ? [] : inRange(start.lines)));
  const [rollCall, setRollCall] = useState(start?.rollCall ?? false);
  const [adding, setAdding] = useState(false);
  const opener = useRef<ViewInstance | null>(null);
  const initial = useMemo(() => (start === null ? '' : shape(start.lines, start.rollCall)), [start]);
  const moved = start !== null && shape(inRange(start.lines), start.rollCall) !== initial;
  const dirty = start !== null && shape(lines, rollCall) !== initial;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  if (data === null || marks === null || start === null) return null;
  const preset = start.preset;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const total = setupTotal(lines);
  const hint = totalHint(t, preset.scale, total);
  const attendance = lines.find((line) => line.kind === 'preset' && line.capture === 'roll-call');
  const className = isolate(courseLabel(t, state, profile, courseId, true));
  const change = (id: string, points: number) =>
    setLines(lines.map((line) => (line.id === id ? { ...line, points } : line)));
  const save = () => {
    record({ kind: 'assessment.set', setup: setupOf(courseId, term, data.release, lines, rollCall) });
    onSaved();
  };
  return (
    <View style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            direction,
            paddingBottom: insets.bottom + spacing['space-24'],
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
          },
        ]}
      >
        <Text testID="setup-class" style={[styles.heading, align]}>
          {t('marks.setupHeading', { class: className, scale: preset.scale, n: termName(t, term) })}
        </Text>
        <View testID="setup-preset" accessible style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={[styles.title, styles.grow, align]}>{presetTitle(t, profile, preset)}</Text>
            <Badge label={t('marks.bundled')} />
          </View>
          <Text style={[styles.body, align]}>
            {t('marks.reference', { circular: preset.circular, release: marks.release })}
          </Text>
          <Text style={[styles.note, align]}>{t('marks.rules', { year: preset.rulesYear })}</Text>
          <Text style={[styles.note, align]}>{t('marks.curators')}</Text>
        </View>
        {moved && (
          <Text testID="setup-moved" style={[styles.body, align]}>
            {t('marks.moved')}
          </Text>
        )}
        {lines.map((line) => (
          <SetupRow
            key={line.id}
            line={line}
            rollCall={rollCall}
            onPoints={(points) => change(line.id, points)}
            {...(line.kind === 'column' && {
              onRemove: () => setLines(lines.filter((one) => one.id !== line.id)),
            })}
          />
        ))}
        {attendance !== undefined && (
          <CheckRow
            testID="setup-roll-call"
            label={t('marks.fromRollCall', { name: lineName(attendance) })}
            checked={rollCall}
            onCheckedChange={setRollCall}
          />
        )}
        <Button
          ref={opener}
          testID="setup-add-column"
          variant="line"
          label={t('marks.addColumn')}
          onPress={() => setAdding(true)}
        />
        <View testID="setup-total" accessible style={styles.total}>
          <Badge
            label={t('marks.total', { total, scale: preset.scale })}
            variant={hint === null ? 'done' : 'warning'}
          />
          {hint !== null && <Text style={[styles.body, align]}>{hint}</Text>}
        </View>
        <Button
          testID="setup-save"
          label={t('marks.save')}
          disabled={!dirty || setupProblem(preset, lines) !== null}
          onPress={save}
        />
      </ScrollView>
      <ColumnSheet
        visible={adding}
        className={className}
        returnFocusRef={opener}
        onClose={() => setAdding(false)}
        onAdd={(name, points) => {
          setLines([...lines, { kind: 'column', id: newId(), name, points, ...COLUMN_POINTS }]);
          setAdding(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  heading: { ...typography.label, color: colors.ink2 },
  card: {
    gap: spacing['space-4'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  grow: { flex: 1 },
  total: { gap: spacing['space-6'], alignItems: 'flex-start' },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
