// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Classes tab (#37, Classes): one card per class and subject, with its
// pupils, its first session today, and where it stands against the plan,
// buffers first, with its plan and its texts book a tap away (#213). The
// heading names the subjects, the schools and the pupils. The year switch,
// the weekly digest, the attendance and the roll call button come with
// their own issues.

import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeading } from '../components/PageHeading';
import { SessionCard } from '../components/SessionCard';
import { colors, spacing } from '../design/tokens';
import { localized, yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { sessionTime } from '../times/times-rules';
import { classRows, paceLine } from './class-rules';

/** The tab; `onPlan` opens a class's plan, and `onBook` its texts book. */
export function ClassesTab({
  onPlan,
  onBook,
}: {
  onPlan: (courseId: string) => void;
  onBook: (courseId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, calendar, packs, bells, today } = useAppData();
  const day = today();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, packs, state }),
    [profile, year, calendar, packs, state],
  );
  const rows = useMemo(() => classRows(context, day), [context, day]);
  const subjects = [...new Set(rows.map((row) => row.course.subject))];
  const subjectName = (code: string) => {
    const subject = profile.subjects.find((candidate) => candidate.code === code);
    return subject === undefined ? code : localized(subject.name);
  };
  const schools = [...new Set(rows.map((row) => row.schoolClass.schoolId))]
    .map((id) => state.schools.get(id)?.name)
    .filter((name): name is string => name !== undefined);
  const pupils = [...new Map(rows.map((row) => [row.schoolClass.id, row.pupils])).values()].reduce((a, b) => a + b, 0);
  const comma = currentLanguage() === 'ar' ? '، ' : ', ';

  return (
    <View style={[styles.screen, { direction, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <PageHeading
          testID="classes-heading"
          title={t('navigation.classes')}
          scope={[subjects.map(subjectName).join(comma), schools.join(comma), t('setup.pupils', { count: pupils })]
            .filter(Boolean)
            .join(' · ')}
        />
        <View style={styles.list}>
          {rows.map((row) => {
            const school = state.schools.get(row.schoolClass.schoolId);
            const time =
              row.today === null
                ? null
                : sessionTime({ bells, calendar, state }, school, row.today.slot, row.today.day);
            const extra = [
              subjects.length > 1 ? subjectName(row.course.subject) : null,
              time === null ? null : t('classes.today', { time: time.from }),
            ].filter((part): part is string => part !== null);
            return (
              <SessionCard
                key={row.course.id}
                testID={`classes-${row.course.id}`}
                kind="mini"
                meta={{
                  className:
                    row.grade === undefined
                      ? row.schoolClass.name
                      : `${row.schoolClass.name} · ${yearShort(t, row.grade)}`,
                  slot: t('setup.pupils', { count: row.pupils }),
                  ...(extra.length > 0 && { subject: extra.join(' · ') }),
                }}
                lesson={paceLine(t, row)}
                show={{ id: 'plan', label: t('classPlan.open'), onPress: () => onPlan(row.course.id) }}
                also={{ id: 'book', label: t('book.open'), onPress: () => onBook(row.course.id) }}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: spacing['space-16'] },
  list: { gap: spacing['space-10'], paddingHorizontal: spacing['space-16'], paddingBottom: spacing['space-16'] },
});
