// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Classes tab (#37, Classes): one card per class and subject, with its
// pupils, its first session today, and where it stands against the plan,
// buffers first, with its page (#279) and its texts book (#213) a tap away; the
// plan opens from the page (answer 257). The heading names the subjects, the
// schools and the pupils; on a PC it reads «الأقسام والنقاط», as the rail does
// (#251, answer 524). A teacher in two schools or more (#232, answers 394, 397
// and 398) sees a section per school, «مدرسة الفتح · 7 أفواج», the heading
// counting the groups, archived ones aside, and the schools, and a card for the
// merged week saying whether a clash is open, which opens the week. A
// specialist, in one school or more, is told that each class's register counts
// only their sessions, called one by one. «ملخص الأسبوع» opens the weekly
// digest (#234). The year switch, the attendance and the roll call button come
// with their own issues.

import { courseSetup, versionOn, weekClashes } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice } from '../components/Notice';
import { PageHeading } from '../components/PageHeading';
import { RowLink } from '../components/RowLink';
import { SectionHeader } from '../components/SectionHeader';
import { SessionCard } from '../components/SessionCard';
import { controlIcon } from '../design/Icon';
import { colors, spacing } from '../design/tokens';
import { localized, yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useDeviceText } from '../text/device-text';
import { currentLanguage } from '../text/i18n';
import { sessionTime } from '../times/times-rules';
import { isolate } from '../week/grid-labels';
import { bySchool, classRows, paceLine, specialistRoll, type ClassRow } from './class-rules';
import { useCountMinutes } from '../settings/preferences';

/** The tab; `onClass` opens a class's page, `onBook` its texts book, `onWeek` the week and `onDigest` the digest. */
export function ClassesTab({
  onClass,
  onBook,
  onWeek,
  onDigest,
}: {
  onClass: (courseId: string) => void;
  onBook: (courseId: string) => void;
  onWeek: () => void;
  onDigest: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useDeviceText();
  const minutes = useCountMinutes();
  const { state, profile, year, calendar, calendarRelease, packs, bells, today } = useAppData();
  const day = today();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const rows = useMemo(() => classRows(context, day), [context, day]);
  const subjects = [...new Set(rows.map((row) => row.course.subject))];
  const subjectName = (code: string) => {
    const subject = profile.subjects.find((candidate) => candidate.code === code);
    return subject === undefined ? code : localized(subject.name);
  };
  const sections = bySchool(rows);
  const schoolName = (id: string) => state.schools.get(id)?.name ?? '';
  const pupils = [...new Map(rows.map((row) => [row.schoolClass.id, row.pupils])).values()].reduce((a, b) => a + b, 0);
  const groups = (own: readonly ClassRow[]) =>
    new Set(own.filter((row) => row.archived === undefined).map((row) => row.schoolClass.id)).size;
  const many = sections.length > 1;
  const comma = currentLanguage() === 'ar' ? '، ' : ', ';
  const version = versionOn(state.timetables, day);
  const clashes = version === null ? 0 : weekClashes(version, state).filter((clash) => !clash.kept).length;
  const specialist = rows.some((row) => specialistRoll(context, row.schoolClass));
  const schools = many
    ? [t('count.groups', { count: groups(rows) }), t('count.schools', { count: sections.length })].join(' · ')
    : sections.map(([id]) => schoolName(id)).join(comma);

  const card = (row: ClassRow) => {
    const school = state.schools.get(row.schoolClass.schoolId);
    const time =
      row.today === null ? null : sessionTime({ bells, calendar, state }, school, row.today.slot, row.today.day);
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
            row.grade === undefined ? row.schoolClass.name : `${row.schoolClass.name} · ${yearShort(t, row.grade)}`,
          slot: t('setup.pupils', { count: row.pupils }),
          ...(extra.length > 0 && { subject: extra.join(' · ') }),
        }}
        lesson={paceLine(t, row, minutes ? courseSetup(context, row.course.id).sessionMinutes : undefined)}
        show={{ id: 'class', label: t('classPage.open'), onPress: () => onClass(row.course.id) }}
        also={{ id: 'book', label: t('book.open'), onPress: () => onBook(row.course.id) }}
      />
    );
  };

  return (
    <View style={[styles.screen, { direction, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <PageHeading
          testID="classes-heading"
          title={t('navigation.classes')}
          scope={[subjects.map(subjectName).join(comma), schools, t('setup.pupils', { count: pupils })]
            .filter(Boolean)
            .join(' · ')}
        />
        <View style={styles.list}>
          {rows.length > 0 && (
            <RowLink
              testID="classes-digest"
              icon={controlIcon('info')}
              title={t('digest.title')}
              description={t('digest.rowNote')}
              onPress={onDigest}
            />
          )}
          {specialist && (
            <Notice testID="classes-register" icon={controlIcon('pupils')} message={t('classes.register')} />
          )}
          {many && (
            <RowLink
              testID="classes-week"
              icon={controlIcon('school')}
              title={t('classes.week', { schools: t('count.schools', { count: sections.length }) })}
              description={t('classes.weekNote', {
                clashes: clashes === 0 ? t('week.noClash') : t('week.clashes', { count: clashes }),
              })}
              onPress={onWeek}
            />
          )}
          {many
            ? sections.map(([id, own]) => (
                <View key={id} style={styles.section}>
                  <SectionHeader
                    testID={`classes-school-${id}`}
                    label={t('classes.school', {
                      school: isolate(schoolName(id)),
                      groups: t('count.groups', { count: groups(own) }),
                    })}
                  />
                  {own.map(card)}
                </View>
              ))
            : rows.map(card)}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: spacing['space-16'] },
  list: { gap: spacing['space-10'], paddingHorizontal: spacing['space-16'], paddingBottom: spacing['space-16'] },
  section: { gap: spacing['space-10'] },
});
