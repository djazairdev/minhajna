// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A primary session's types on Week-slot (#230, Week-slot-primary,
// R-4.6-06, R-4.7-04, answer 374): the session type, «درس», «معالجة» or
// «دعم», the last two outside the main plan; for a lesson, the activity
// type from the weekly model of the subject's pinned pack, with «بلا نوع»
// first. A subject whose pack has no model says so, and the plan proposes
// the next lesson. A type the slot already has stays offered, so editing
// the slot never drops it, and it is kept while another session type is
// tried; the sheet drops it on saving outside the main plan. A «معالجة» or
// «دعم» slot of a class and subject already set up opens its list (answer
// 376). Then, for any class session, the slot's times from the school's
// bells and their minutes.

import {
  bellTimes,
  clockMinutes,
  listOfType,
  type Course,
  type ListKind,
  type PlanPack,
  type SchoolClass,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { ChipGroup } from '../components/Chip';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { levelOf, shiftOf } from '../times/times-rules';
import { span } from '../times/TimeTable';
import { withActivity, type SessionItem } from './slot-rules';
import type { Cell } from './week-rules';

/** The session types a primary slot offers. */
const PRIMARY_TYPES = ['lesson', 'remediation', 'support'] as const;
const NO_ACTIVITY = '';

export type SlotTypesProps = {
  readonly testID: string;
  readonly cell: Cell;
  readonly item: SessionItem;
  readonly schoolClass: SchoolClass;
  readonly onChange: (item: SessionItem) => void;
  /** Opens the class's list for a session outside the main plan that takes one. */
  readonly onList?: (courseId: string, kind: ListKind) => void;
};

export function SlotTypes({ testID, cell, item, schoolClass, onChange, onList }: SlotTypesProps) {
  const t = useText();
  const { direction } = useLocale();
  const { profile, state, packs, bells } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const typeName = (code: string) => {
    const type = profile.sessionTypes.find((one) => one.code === code);
    return type === undefined ? code : localized(type.name);
  };
  const primary = schoolClass.level === 'primary';
  const types = [
    ...PRIMARY_TYPES,
    ...(PRIMARY_TYPES.some((code) => code === item.sessionType) ? [] : [item.sessionType]),
  ];
  const main = profile.sessionTypes.find((one) => one.code === item.sessionType)?.queue === 'main';
  const course = courseOf(state.courses.values(), item);
  const pack = packOf(course, packs);
  const list = listOfType(item.sessionType);
  const model = pack?.activities ?? [];
  const kept = item.activity !== undefined && !model.some((one) => one.code === item.activity) ? [item.activity] : [];
  const activities = [
    { value: NO_ACTIVITY, label: t('week.noActivity') },
    ...model.map((one) => ({ value: one.code, label: localized(one.name) })),
    ...kept.map((code) => ({ value: code, label: code })),
  ];
  const school = state.schools.get(schoolClass.schoolId);
  const level = school === undefined ? undefined : levelOf(school);
  const time =
    school === undefined || level === undefined
      ? null
      : (bellTimes(bells, school, level, shiftOf(state), 'usual', [cell.slot])[0] ?? null);
  const setType = (sessionType: string) => onChange({ ...item, sessionType });
  const setActivity = (code: string) => onChange(withActivity(item, code === NO_ACTIVITY ? undefined : code));
  return (
    <View style={styles.group}>
      {primary && (
        <ChipGroup
          testID={`${testID}-type`}
          label={t('week.sessionType')}
          choices={types.map((code) => ({ value: code, label: typeName(code) }))}
          selected={item.sessionType}
          onSelect={setType}
        />
      )}
      {primary && main && (model.length > 0 || kept.length > 0) && (
        <ChipGroup
          testID={`${testID}-activity`}
          label={t('week.activity')}
          hint={t('week.activityHint')}
          choices={activities}
          selected={item.activity ?? NO_ACTIVITY}
          onSelect={setActivity}
        />
      )}
      {primary && main && pack !== undefined && model.length === 0 && kept.length === 0 && (
        <Text style={[styles.note, align]}>{t('week.noModel')}</Text>
      )}
      {primary && !main && <Text style={[styles.note, align]}>{t('week.outsidePlan')}</Text>}
      {primary && list !== null && course !== undefined && onList !== undefined && (
        <RowLink
          testID={`${testID}-list`}
          icon={controlIcon('tune')}
          title={t(list === 'support' ? 'supportQueue.open' : 'supportQueue.openRemediation')}
          description={t('week.listLink')}
          onPress={() => onList(course.id, list)}
        />
      )}
      {time !== null && (
        <Text testID={`${testID}-time`} style={[styles.note, align]}>
          {t('week.bellLine', {
            time: span(time.from, time.to, direction),
            minutes: t('settings.minutes', { count: clockMinutes(time.to) - clockMinutes(time.from) }),
          })}
        </Text>
      )}
    </View>
  );
}

/** The class and subject's course, once set up. */
function courseOf(courses: Iterable<Course>, item: SessionItem): Course | undefined {
  return [...courses].find((one) => one.classId === item.classId && one.subject === item.subject);
}

/** The course's pinned pack, if it has one. */
function packOf(course: Course | undefined, packs: readonly PlanPack[]): PlanPack | undefined {
  const pin = course?.pack ?? null;
  return pin === null ? undefined : packs.find((one) => one.id === pin.id && one.release === pin.release);
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-12'] },
  note: { ...typography.caption, color: colors.ink2 },
});
