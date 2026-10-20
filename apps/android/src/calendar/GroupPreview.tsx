// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { formatDay, makeContext, rotationCredits, sessionsBetween, type CalendarEntry } from '@minhajna/core';
import { Text, View } from 'react-native';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { localized } from '../setup/names';

/** One row per physical slot and separate effective capacity for lessons and TD. */
export function GroupPreview({ entry }: { entry: CalendarEntry }) {
  const data = useAppData();
  const t = useText();
  const original = coreContext(data);
  const context = makeContext(original.ref, {
    ...data.state,
    calendar: [...data.state.calendar.filter((one) => one.id !== entry.id), entry],
  });
  const schoolClass = data.state.classes.get(entry.rotation!.classId)!;
  const courses = [...data.state.courses.values()].filter((one) => one.classId === schoolClass.id);
  const sessions = sessionsBetween(context, entry.from, entry.to, new Set(courses.map((one) => one.id)));
  return (
    <View testID="rotation-preview" style={styles.card}>
      <Text style={styles.title}>{schoolClass.name}</Text>
      {[
        ...new Set(
          sessions.map((one) => context.calendar.weekOf(one.day, data.state.schools.get(schoolClass.schoolId)!)?.start),
        ),
      ]
        .filter((day) => day !== undefined)
        .map((day) => (
          <Text key={day} style={styles.body}>
            {t('calendarView.weekLetter', {
              from: formatDay(day),
              letter: t(
                `calendarView.parity.${context.calendar.parityOn(day, data.state.schools.get(schoolClass.schoolId)!)!}`,
              ),
            })}
          </Text>
        ))}
      {courses.flatMap((course) =>
        (['main', 'td'] as const).map((queue) => {
          const open = sessions.filter(
            (one) =>
              one.courseId === course.id &&
              one.calendar === null &&
              data.profile.sessionTypes.find((type) => type.code === one.sessionType)?.queue === queue,
          );
          return (
            <Text key={`${course.id}-${queue}`} style={styles.body}>
              {t('calendarView.groups.capacity', {
                subject: localized(
                  data.profile.subjects.find((one) => one.code === course.subject)?.name ?? { ar: course.subject },
                ),
                queue: t(`calendarView.groups.${queue}`),
                physical: open.length,
                effective: rotationCredits(open),
                repeated: open.length - rotationCredits(open),
              })}
            </Text>
          );
        }),
      )}
      {sessions.map((one) => (
        <Text key={one.key} style={styles.body}>
          {t('calendarView.groups.slot', {
            day: formatDay(one.day),
            half: t(`calendarView.periods.${one.slot.half}`),
            slot: one.slot.index,
            group: schoolClass.groups.find((group) => group.id === one.groupId)?.name ?? '',
            status: t(`calendarView.edit.status.${one.calendar ?? 'open'}`),
          })}
        </Text>
      ))}
    </View>
  );
}
