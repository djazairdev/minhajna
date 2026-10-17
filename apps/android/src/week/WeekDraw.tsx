// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Drawing the week by hand (#28, Week-draw): a pen for each class, one for
// the teacher's own time and an eraser, then taps on the grid. Saturday and a
// fifth morning slot are options, kept on the version; one cannot be removed
// while its slots hold something. Under the grid, each class's sessions, the
// total and the clashes. Each change is saved once the taps pause, and «حفظ
// الأسبوع» saves at once; the version starts on the day shown and never
// changes a recorded session (PRD §4.6). A slot's group, weeks and subject
// come with Week-slot. Class names in the totals are isolated, so a Latin
// name at the start does not turn an Arabic line around.

import {
  SATURDAY,
  formatDay,
  weekClashes,
  weekGrid,
  type Course,
  type SchoolClass,
  type Slot,
  type WeekOptions,
  type Weekday,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { ChipGroup } from '../components/Chip';
import { WeekGrid } from '../components/WeekGrid';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDraft } from '../setup/useDraft';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { gridCell, gridLabels } from './grid-labels';
import { classLoads, courseFor, holds, paint, versionToDraw, type Brush } from './week-rules';

type Option = keyof Omit<WeekOptions, 'doubleShift'>;

/** Keeps a class name, such as 4AM3, from setting the direction of the line around it. */
const isolate = (name: string) => `\u2068${name}\u2069`;

const OPTION_SLOTS: Record<Option, (weekday: Weekday, slot: Slot) => boolean> = {
  saturday: (weekday) => weekday === SATURDAY,
  fifthMorning: (_, slot) => slot.half === 'morning' && slot.index === 5,
};

/** The drawing screen; `onDone` returns once the week is saved. */
export function WeekDraw({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, record, today, newId, unsaved } = useAppData();
  const [start] = useState(() => versionToDraw(state, year, today(), newId));
  const draft = useDraft(start, (version) => record({ kind: 'timetable.set', version }));
  const [made, setMade] = useState<ReadonlyMap<string, Course>>(new Map());
  const version = draft.value;
  const classes = [...state.classes.values()].filter((schoolClass) => state.schools.has(schoolClass.schoolId));
  const [pen, setPen] = useState(classes[0]?.id ?? 'own');
  const options = version.options ?? {};
  const labels = gridLabels(t, weekGrid(profile, options));
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };

  const classOf = (courseId: string): SchoolClass | undefined => {
    const course = state.courses.get(courseId) ?? [...made.values()].find((item) => item.id === courseId);
    return course && state.classes.get(course.classId);
  };
  const courseOfClass = (schoolClass: SchoolClass) => {
    const kept = made.get(schoolClass.id);
    if (kept !== undefined) return kept;
    const { course, isNew } = courseFor(state, schoolClass, year, newId);
    if (isNew) record({ kind: 'course.set', course });
    setMade(new Map(made).set(schoolClass.id, course));
    return course;
  };
  const tap = (cell: ReturnType<typeof labels.cellOf>) => {
    const brush: Brush = pen === 'own' || pen === 'erase' ? { kind: pen } : { kind: 'class', classId: pen };
    const schoolClass = brush.kind === 'class' ? state.classes.get(brush.classId) : undefined;
    const course = schoolClass && courseOfClass(schoolClass);
    draft.change(paint(version, classOf, cell, brush, { schoolClass, course, ownLabel: t('week.ownTime'), newId }));
  };
  const toggle = (option: Option, on: boolean) => {
    const next: { -readonly [Key in keyof WeekOptions]: WeekOptions[Key] } = { ...options };
    if (on) next[option] = true;
    else delete next[option];
    draft.change({ ...version, options: next });
  };
  const locked = (option: Option) => options[option] === true && holds(version, OPTION_SLOTS[option]);
  const { loads, total } = classLoads(version, classOf, classes);
  const clashes = weekClashes(version, state).length;
  const tally = [
    ...loads.map((load) => `${isolate(load.name)}: ${load.count}`),
    t('week.total', { sessions: t('week.sessions', { count: total }) }),
  ].join(' · ');

  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView contentContainerStyle={[styles.content, sides]}>
        <ChipGroup
          testID="pen"
          label={t('week.brush')}
          hint={t('week.brushHint')}
          choices={[
            ...classes.map((schoolClass) => ({ value: schoolClass.id, label: schoolClass.name })),
            { value: 'own', label: t('week.ownTime') },
            { value: 'erase', label: t('week.erase') },
          ]}
          selected={pen}
          onSelect={setPen}
        />
        <View style={styles.card}>
          <Text style={[styles.label, align]}>{t('week.daysAndSlots')}</Text>
          {(['saturday', 'fifthMorning'] as const).map((option) => (
            <CheckRow
              key={option}
              testID={`option-${option}`}
              label={t(`week.${option}`)}
              checked={options[option] === true}
              disabled={locked(option)}
              accessibilityHint={locked(option) ? t('week.optionLocked') : undefined}
              onCheckedChange={(on) => toggle(option, on)}
            />
          ))}
        </View>
        <WeekGrid
          testID="draw"
          days={labels.days}
          slots={labels.slots}
          cell={(day, slot) => gridCell(version, classOf, labels.cellOf(day, slot))}
          cellName={labels.cellName}
          cellHint={t('week.cellHint')}
          onPressCell={(day, slot) => tap(labels.cellOf(day, slot))}
        />
        <Text testID="week-tally" style={[styles.tally, align]}>
          {tally}
        </Text>
        <Text testID="week-clashes" accessibilityLiveRegion="polite" style={[styles.sub, align]}>
          {clashes === 0 ? t('week.noClash') : t('week.clashes', { count: clashes })}
        </Text>
        {unsaved && (
          <Text testID="not-saved" accessibilityLiveRegion="polite" style={[styles.unsaved, align]}>
            {t('setup.notSaved')}
          </Text>
        )}
      </ScrollView>
      <View style={[styles.foot, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button
          testID="week-save"
          label={t('week.save')}
          onPress={() => {
            draft.flush();
            onDone();
          }}
        />
        <Text style={[styles.note, { writingDirection: direction }]}>
          {t('week.saveNote', { date: formatDay(version.from) })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    flexGrow: 1,
    gap: spacing['space-16'],
    paddingTop: spacing['space-8'],
    paddingBottom: spacing['space-16'],
  },
  card: {
    gap: spacing['space-4'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  label: { ...typography.label, color: colors.ink2 },
  tally: { ...typography.body, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
  unsaved: { ...typography.label, color: colors.ink },
  foot: { gap: spacing['space-8'], paddingTop: spacing['space-12'], backgroundColor: colors.paper },
  note: { ...typography.caption, color: colors.ink2, textAlign: 'center' },
});
