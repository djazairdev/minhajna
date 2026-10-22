// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a Today card says of its time (#232, answer 400): a session in the same
// slot as one of another school says «يتزامن مع 5AP-C · مدرسة الرياض», so the
// teacher confirms the one held and records the other «لم تُعقد»; a session
// moved for the day says «نُقلت من 09:00 لهذا اليوم». Sessions meet by their
// slot, as clashes do on the week; two schools' different slots whose bell
// times overlap are not said to meet.

import { slotKey, type TodaySession } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { sessionTime } from '../times/times-rules';
import { isolate, slotSpoken } from '../week/grid-labels';

/** The lines of each of the day's sessions, by session key; none for most. */
export function useSameTime(items: readonly TodaySession[]): (item: TodaySession) => string[] {
  const t = useText();
  const data = useAppData();
  const { state } = data;
  const schoolOf = (item: TodaySession) => {
    const schoolClass = state.classes.get(item.course.classId);
    return schoolClass && state.schools.get(schoolClass.schoolId);
  };
  return (item) => {
    const school = schoolOf(item);
    const same = items.filter(
      (other) =>
        other.status !== 'calendar' &&
        slotKey(other.session.slot) === slotKey(item.session.slot) &&
        schoolOf(other)?.id !== school?.id,
    );
    const moved = item.session.movedFrom;
    return [
      ...same.map((other) =>
        t('today.sameTime', {
          class: isolate(state.classes.get(other.course.classId)?.name ?? ''),
          school: isolate(schoolOf(other)?.name ?? ''),
        }),
      ),
      ...(moved === undefined
        ? []
        : [
            t('today.movedFrom', {
              time: sessionTime(data, school, moved, item.session.day)?.from ?? slotSpoken(t, moved),
            }),
          ]),
    ];
  };
}

/** The lines, each on its own row. */
export function SameTime({ lines, testID }: { lines: readonly string[]; testID: string }) {
  const { direction } = useLocale();
  if (lines.length === 0) return null;
  return (
    <View testID={testID} style={styles.lines}>
      {lines.map((line) => (
        <Text key={line} style={[styles.line, { writingDirection: direction, textAlign: 'start' }]}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lines: { gap: spacing['space-2'] },
  line: { ...typography.small, color: colors['notice-ink'] },
});
