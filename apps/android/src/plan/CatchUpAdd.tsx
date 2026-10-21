// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إضافة حصة» (#228, Catchup-add, R-4.7-28, R-7.7-02, answers 353 to 357):
// one catch-up session for the class, agreed with the administration. The
// next free times of the two weeks from tomorrow, each with its day and
// bell time, or «موعد آخر»: any day from today to the year's end and that
// day's slots with a time, refused where the teacher already teaches at that
// time in any school, naming the class (answer 358).
// When the class has make-ups due, it makes up the oldest by default. It
// takes the plan's next item, goes on the subject's pages with its date and
// shows on Today. Sessions that do not move the plan open their own form,
// and a school without bell times opens its times.
// The form saves once and goes back when the save has settled.

import { addCatchUp, addDays, clashOf, freeSlots, makeUpsDue, slotKey, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { RadioCard } from '../components/RadioCard';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { courseLabel } from '../exams/course-label';
import { monthOf } from '../extra/extra-rules';
import { MonthDays } from '../extra/MonthDays';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { courseSchool, meetsByBells, timedSlots, whenLine } from './catch-up-add-rules';

export type CatchUpAddProps = {
  readonly courseId: string;
  readonly onDone: () => void;
  readonly onExtra?: () => void;
  readonly onTimes?: (schoolId: string) => void;
};

const OTHER = -1;

export function CatchUpAdd({ courseId, onDone, onExtra, onTimes }: CatchUpAddProps) {
  const t = useText();
  const data = useAppData();
  const { state, profile, year, today, record, newId, settled } = data;
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const day0 = today();
  const first = day0 > year.from ? day0 : year.from;
  const context = useMemo(() => coreContext(data), [data]);
  const school = courseSchool(state, courseId);
  const meets = useMemo(() => meetsByBells(data), [data]);
  const free = useMemo(() => {
    if (school === undefined) return [];
    const start = first === day0 ? addDays(day0, 1) : first;
    return freeSlots(context, courseId, start, addDays(start, 13), (on) => timedSlots(data, school, on), meets);
  }, [context, courseId, first, day0, data, school, meets]);
  const dues = useMemo(() => makeUpsDue(context, courseId), [context, courseId]);
  const [pick, setPick] = useState(free.length > 0 ? 0 : OTHER);
  const [day, setDay] = useState<Day>(first);
  const [month, setMonth] = useState(monthOf(first));
  const [slotId, setSlotId] = useState<string | null>(null);
  const [linked, setLinked] = useState(true);
  const [dueKey, setDueKey] = useState<string | null>(dues[0]?.key ?? null);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  const className = courseLabel(t, state, profile, courseId);
  const daySlots = school === undefined ? [] : timedSlots(data, school, day);
  const other = daySlots.find((slot) => slotKey(slot) === slotId);
  const chosen = pick === OTHER ? (other === undefined ? null : { day, slot: other }) : (free[pick] ?? null);
  const clash = pick === OTHER && chosen !== null ? clashOf(context, courseId, chosen.day, chosen.slot, meets) : null;
  const due = linked ? (dues.find((one) => one.key === dueKey) ?? dues[0]) : undefined;
  const shown = due ?? dues[0];
  const when = (on: Day, slot: Parameters<typeof whenLine>[4]) => whenLine(t, data, school, on, slot, direction);
  const noTimes = school === undefined || timedSlots(data, school, first).length === 0;

  const save = () => {
    if (busy.current || chosen === null || clash !== null) return;
    try {
      const event = addCatchUp(context, { id: newId(), courseId, ...chosen }, day0, due?.key, meets);
      busy.current = true;
      record(event);
      void settled().finally(onDone);
    } catch (error: unknown) {
      if (__DEV__) console.warn('A catch-up session was refused', error);
      setFailed(true);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('catchUpAdd.heading', { class: isolate(className) })}
      </Text>
      <Text style={[styles.sub, align]}>{t('catchUpAdd.step')}</Text>
      <Text style={[styles.body, align]}>{t('catchUpAdd.agreed')}</Text>
      {noTimes ? (
        <>
          <Notice testID="catchup-add-no-times" icon={controlIcon('info')} message={t('catchUpAdd.noTimes')} />
          {onTimes !== undefined && school !== undefined && (
            <Button
              testID="catchup-add-times"
              variant="line"
              label={t('settings.rows.times')}
              onPress={() => onTimes(school.id)}
            />
          )}
        </>
      ) : (
        <>
          <Text style={[styles.label, align]}>{t('catchUpAdd.free')}</Text>
          {free.length === 0 && (
            <Text testID="catchup-add-no-free" style={[styles.sub, align]}>
              {t('catchUpAdd.noFree')}
            </Text>
          )}
          {free.map((one, index) => (
            <RadioCard
              key={`${one.day}/${slotKey(one.slot)}`}
              testID={`catchup-add-free-${index}`}
              label={when(one.day, one.slot)}
              description={t('catchUpAdd.freeLine')}
              selected={pick === index}
              onPress={() => setPick(index)}
            />
          ))}
          <RadioCard
            testID="catchup-add-other"
            label={t('catchUpAdd.other')}
            description={t('catchUpAdd.otherLine')}
            selected={pick === OTHER}
            onPress={() => setPick(OTHER)}
          />
          {pick === OTHER && (
            <>
              <MonthDays
                month={month}
                selected={day}
                first={first}
                last={year.to}
                profile={profile}
                onMonth={setMonth}
                onSelect={(one) => {
                  setDay(one);
                  setFailed(false);
                }}
              />
              <ChipGroup
                testID="catchup-add-slot"
                label={t('catchUpAdd.slot')}
                selected={slotId}
                onSelect={(value) => {
                  setSlotId(value);
                  setFailed(false);
                }}
                choices={daySlots.map((slot) => ({ value: slotKey(slot), label: when(day, slot) }))}
              />
              {clash !== null && (
                <Notice
                  testID="catchup-add-clash"
                  icon={controlIcon('info')}
                  message={t('catchUpAdd.clash', { class: isolate(courseLabel(t, state, profile, clash.courseId)) })}
                />
              )}
            </>
          )}
        </>
      )}
      {shown !== undefined && (
        <>
          <CheckRow
            testID="catchup-add-link"
            label={t('catchUpAdd.makesUp', { session: when(shown.day, shown.slot) })}
            checked={linked}
            onCheckedChange={setLinked}
          />
          {linked && dues.length > 1 && (
            <ChipGroup
              testID="catchup-add-due"
              label={t('catchUpAdd.which')}
              selected={due?.key ?? null}
              onSelect={setDueKey}
              choices={dues.map((one) => ({ value: one.key, label: when(one.day, one.slot) }))}
            />
          )}
          <Text style={[styles.sub, align]}>{linked ? t('catchUpAdd.linked') : t('catchUpAdd.unlinked')}</Text>
        </>
      )}
      <View testID="catchup-add-effect" accessible style={styles.effect}>
        <Text style={[styles.body, align]}>{t('catchUpAdd.effect', { class: isolate(className) })}</Text>
        <Text style={[styles.body, align]}>{t('catchUpAdd.page')}</Text>
      </View>
      {onExtra !== undefined && (
        <>
          <Text style={[styles.sub, align]}>{t('catchUpAdd.extra')}</Text>
          <Button testID="catchup-add-extra" variant="line" label={t('catchUpAdd.extraOpen')} onPress={onExtra} />
        </>
      )}
      {failed && <Notice testID="catchup-add-failed" icon={controlIcon('info')} message={t('catchUpAdd.failed')} />}
      <Button
        testID="catchup-add-save"
        label={t('catchUpAdd.save')}
        disabled={chosen === null || clash !== null}
        onPress={save}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingTop: spacing['space-16'] },
  effect: { gap: spacing['space-6'] },
  title: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
});
