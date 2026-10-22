// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Drawing the week by hand (#28, Week-draw): a pen for each class, one for the
// teacher's own time and an eraser, then taps on the grid. Saturday and a fifth
// morning slot are options, kept on the version; one cannot be removed while
// its slots hold something. Under the grid, each class's sessions, the total
// and the clashes. Each change is saved once the taps pause, and «حفظ الأسبوع»
// saves at once; the version starts on the day shown and never changes a
// recorded session (PRD §4.6). The «تفاصيل الخانة» pen opens a slot on
// Week-slot, for its group, A/B weeks, subject, room, or kind of own time.
// Class names in the totals are isolated, so a Latin name at the start does not
// turn an Arabic line around. With a double shift, the half taught in A weeks
// is chosen, and a class drawn in one half-day goes in the other for the other
// week, as does a slot saved from Week-slot; the afternoon then gets a fifth
// slot with the morning's, and the double shift stays on while that slot holds
// something (#230, answer 385). A week of two schools tags each class with its
// school, counts each school's sessions, and outlines clashing slots. A clash
// on Setup-5-Week opens here with its slot on Week-slot.
// A class archived after a reorientation is not offered (#231).

import {
  SATURDAY,
  formatDay,
  weekGrid,
  type Half,
  type ListKind,
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
import { gridCell, gridLabels, isolate, schoolShort, schoolTally, weekMarks } from './grid-labels';
import { SlotSheet } from './SlotSheet';
import { ShiftCard } from './ShiftCard';
import { useWeekRecords } from './useWeekRecords';
import { classLoads, holds, mirrorOf, paint, versionToDraw, withMirror, type Brush, type Cell } from './week-rules';

type Option = keyof Omit<WeekOptions, 'doubleShift' | 'sharedWith'>;

const OPTION_SLOTS: Record<Option, (weekday: Weekday, slot: Slot) => boolean> = {
  saturday: (weekday) => weekday === SATURDAY,
  fifthMorning: (_, slot) => slot.index === 5,
};

/**
 * The drawing screen: `openAt` opens a slot at once, `onDone` follows the save, `onList` opens a class's list, and
 * `onLetter` and `onRules` open the calendar's week letter and the roll-call rules from «الدوامان».
 */
export function WeekDraw({
  openAt,
  onDone,
  onList,
  onLetter,
  onRules,
}: {
  openAt?: Cell;
  onDone: () => void;
  onList?: (courseId: string, kind: ListKind) => void;
  onLetter?: (schoolId: string) => void;
  onRules?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, record, today, newId, unsaved } = useAppData();
  const [start] = useState(() => versionToDraw(state, year, today(), newId));
  const draft = useDraft(start, (version) => record({ kind: 'timetable.set', version }));
  const records = useWeekRecords();
  const [open, setOpen] = useState<Cell | null>(openAt ?? null);
  const version = draft.value;
  const classes = [...state.classes.values()].filter(
    (schoolClass) => state.schools.has(schoolClass.schoolId) && schoolClass.archivedFrom === undefined,
  );
  const [pen, setPen] = useState(classes[0]?.id ?? 'own');
  const options = version.options ?? {};
  const labels = gridLabels(t, weekGrid(profile, options));
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };

  const inGrid = (cell: Cell) =>
    labels.slots.some((slot) => slot.slot.half === cell.slot.half && slot.slot.index === cell.slot.index);
  const tap = (cell: Cell) => {
    if (pen === 'details') {
      setOpen(cell);
      return;
    }
    const brush: Brush = pen === 'own' || pen === 'erase' ? { kind: pen } : { kind: 'class', classId: pen };
    const schoolClass = brush.kind === 'class' ? records.lookup.schoolClass(brush.classId) : undefined;
    const course = schoolClass && records.courseOfClass(schoolClass.id);
    const mirror = mirrorOf(cell);
    const shift = options.doubleShift;
    draft.change(
      paint(version, records.classOf, cell, brush, {
        schoolClass,
        course,
        ownLabel: t('week.ownTime'),
        newId,
        ...(shift !== undefined && { shift, ...(inGrid(mirror) && { mirror }) }),
      }),
    );
  };
  const setShift = (shift: Half | null) => {
    const next: { -readonly [Key in keyof WeekOptions]: WeekOptions[Key] } = { ...options };
    if (shift === null) {
      delete next.doubleShift;
      delete next.sharedWith;
    } else next.doubleShift = shift;
    draft.change({ ...version, options: next });
  };
  const setShared = (name: string) => {
    const next: { -readonly [Key in keyof WeekOptions]: WeekOptions[Key] } = { ...options };
    if (name.trim() === '') delete next.sharedWith;
    else next.sharedWith = name;
    draft.change({ ...version, options: next });
  };
  const toggle = (option: Option, on: boolean) => {
    const next: { -readonly [Key in keyof WeekOptions]: WeekOptions[Key] } = { ...options };
    if (on) next[option] = true;
    else delete next[option];
    draft.change({ ...version, options: next });
  };
  const slotTitle = (cell: Cell) => {
    const day = labels.days.find((candidate) => candidate.key === String(cell.weekday));
    const slot = labels.slots.find(
      (candidate) => candidate.slot.half === cell.slot.half && candidate.slot.index === cell.slot.index,
    );
    return t('week.slotTitle', { day: day?.label ?? '', slot: slot?.spoken ?? '' });
  };
  const locked = (option: Option) => options[option] === true && holds(version, OPTION_SLOTS[option]);
  const shiftLocked =
    options.doubleShift !== undefined &&
    options.fifthMorning === true &&
    holds(version, (_, slot) => slot.half === 'afternoon' && slot.index === 5);
  const marks = weekMarks(version, state, classes);
  const { loads, total } = classLoads(version, records.classOf, classes);
  const tally = [
    ...(marks.schools === undefined
      ? loads.map((load) => `${isolate(load.name)}: ${load.count}`)
      : schoolTally(t, version, records.classOf, classes, state.schools.values())),
    t('week.total', { sessions: t('week.sessions', { count: total }) }),
  ].join(' · ');
  const clashes = marks.clashes.length;
  const penName = (schoolClass: (typeof classes)[number]) => {
    const school = marks.schools?.(schoolClass.schoolId);
    return school === undefined ? schoolClass.name : `${schoolClass.name} · ${schoolShort(school)}`;
  };

  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView contentContainerStyle={[styles.content, sides]}>
        <ChipGroup
          testID="pen"
          label={t('week.brush')}
          hint={t('week.brushHint')}
          choices={[
            ...classes.map((schoolClass) => ({ value: schoolClass.id, label: penName(schoolClass) })),
            { value: 'own', label: t('week.ownTime') },
            { value: 'erase', label: t('week.erase') },
            { value: 'details', label: t('week.details') },
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
          <CheckRow
            testID="option-doubleShift"
            label={t('week.doubleShift')}
            checked={options.doubleShift !== undefined}
            disabled={shiftLocked}
            accessibilityHint={shiftLocked ? t('week.optionLocked') : undefined}
            onCheckedChange={(on) => setShift(on ? 'morning' : null)}
          />
          <ShiftCard
            version={version}
            classes={classes}
            onShift={setShift}
            onShared={setShared}
            {...(onLetter !== undefined && { onLetter })}
            {...(onRules !== undefined && { onRules })}
          />
        </View>
        <WeekGrid
          testID="draw"
          days={labels.days}
          slots={labels.slots}
          cell={(day, slot) => {
            const cell = labels.cellOf(day, slot);
            return gridCell(t, version, records.lookup, cell, {
              schools: marks.schools,
              clash: marks.clashAt(cell),
              kept: marks.keptAt(cell),
            });
          }}
          cellName={labels.cellName}
          cellHint={pen === 'details' ? t('week.detailsHint') : t('week.cellHint')}
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
      <SlotSheet
        cell={open}
        title={open === null ? '' : slotTitle(open)}
        version={version}
        records={records}
        onClose={() => setOpen(null)}
        {...(open !== null &&
          options.doubleShift !== undefined &&
          inGrid(mirrorOf(open)) && { fresh: open.slot.half === options.doubleShift ? 'A' : 'B' })}
        onSave={(next) => {
          const shift = options.doubleShift;
          const mirror = open === null ? null : mirrorOf(open);
          draft.change(
            shift !== undefined && open !== null && mirror !== null && inGrid(mirror)
              ? withMirror(version, next, open, shift, mirror, newId)
              : next,
          );
          setOpen(null);
        }}
        {...(onList !== undefined && { onList })}
      />
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
