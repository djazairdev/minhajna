// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One class and subject (#279, Class): its subject and pupils, chips to switch
// to the teacher's other classes of the subject, today's session with its roll
// call, then a row for each of its records, each opening its screen: the texts
// book, the plan, the roll-call book and its print (answer 260), homework,
// sessions outside the timetable, supervised or extra lessons, and assessment,
// with the term holding today and its setup (#238, answer 436). Then the
// pupils, each with the month's absences and lateness so far, and
// «إضافة أو نقل», then «غادروا القسم», each pupil who left with the day,
// opening their page like the others (answer 475). The settings button in the
// top bar opens the class's settings that exist (answer 256). The page reads
// the record and adds nothing to it. A class archived after a reorientation
// says so, and offers no session outside the timetable and no pupil move
// (#231).

import { courseSetup, termNumberOn, type Session } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { DueStrip } from '../components/DueStrip';
import { RowLink } from '../components/RowLink';
import { SectionHeader } from '../components/SectionHeader';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { frontDate } from '../documents/front-tables';
import { useDocumentData } from '../documents/useDocumentData';
import { bookSpan } from '../entry/book-lines';
import { marksLine } from '../marks/marks-rules';
import { localized, yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useCountMinutes } from '../settings/preferences';
import { useText } from '../text/i18n';
import { sessionTime } from '../times/times-rules';
import { rollStrip } from '../today/roll-strip';
import { isolate } from '../week/grid-labels';
import { reshapedWith } from '../reorient/reorient-rules';
import { ClassSettings } from './ClassSettings';
import {
  bookLine,
  homeworkLine,
  leftLines,
  monthSoFar,
  pupilLines,
  rollLine,
  supervisedLine,
  tdLine,
} from './class-page-rules';
import { classRows, paceLine } from './class-rules';

export type ClassPageProps = {
  readonly courseId: string;
  readonly settings: boolean;
  readonly onSettings: (open: boolean) => void;
  readonly settingsOpener: React.RefObject<ViewInstance | null>;
  readonly onCourse: (courseId: string) => void;
  readonly onRoll: (session: Session) => void;
  readonly onBook: () => void;
  readonly onPlan: () => void;
  readonly onTests?: () => void;
  /** Opens «التقويم والنقاط»; the row is disabled without it. */
  readonly onMarks?: () => void;
  /** Opens the roll-call book's month; the row is disabled without it. */
  readonly onMonth?: () => void;
  /** Opens Roll-print on this class's book. */
  readonly onRollPrint?: () => void;
  readonly onHomework: () => void;
  readonly onExtra: () => void;
  readonly onSupervised: () => void;
  /** Opens a pupil; none until the pupil's page is built. */
  readonly onPupil?: (pupilId: string) => void;
  readonly onMove: () => void;
  readonly onSeats: () => void;
  readonly onRules: () => void;
  /** Opens the reorientation; offered only for a lycée class that can be reshaped. */
  readonly onReorient: () => void;
};

export function ClassPage(props: ClassPageProps) {
  const t = useText();
  const minutes = useCountMinutes();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs, bells, today } = useAppData();
  const data = useDocumentData();
  const day = today();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const rows = useMemo(() => classRows(context, day), [context, day]);
  const row = rows.find((one) => one.course.id === props.courseId);
  const month = useMemo(
    () => (row === undefined ? null : monthSoFar(context, row.schoolClass.id, day)),
    [context, row, day],
  );
  const pupils = useMemo(
    () => (row === undefined ? [] : pupilLines(t, context, row, day, month)),
    [t, context, row, day, month],
  );
  const left = useMemo(() => (row === undefined ? [] : leftLines(t, context, row, day)), [t, context, row, day]);
  const lines = useMemo(
    () =>
      row === undefined
        ? null
        : {
            book: bookLine(t, data, context, row, day),
            roll: rollLine(t, data, day, month, pupils),
            homework: homeworkLine(t, context, row.course.id, day),
            supervised: supervisedLine(t, data, context, row),
            marks: marksLine(t, state, profile, row.course.id, termNumberOn(year, day)),
          },
    [t, data, context, row, day, month, pupils, state, profile, year],
  );
  if (row === undefined || lines === null) return null;
  const align = { writingDirection: direction, textAlign: 'auto' } as const;
  const subject = profile.subjects.find((one) => one.code === row.course.subject);
  const siblings = rows.filter((one) => one.course.subject === row.course.subject);
  const label = (one: (typeof rows)[number]) =>
    one.grade === undefined ? one.schoolClass.name : `${one.schoolClass.name} · ${yearShort(t, one.grade)}`;
  const strip = row.today === null ? undefined : rollStrip(t, context, row.today, props.onRoll)[0];
  const time =
    row.today === null
      ? null
      : sessionTime(
          { bells, calendar, state },
          state.schools.get(row.schoolClass.schoolId),
          row.today.slot,
          row.today.day,
        );
  const plan = [
    paceLine(t, row, minutes ? courseSetup(context, row.course.id).sessionMinutes : undefined),
    tdLine(t, row.check),
  ].filter((line): line is string => line !== null);
  const link = (
    id: string,
    icon: Parameters<typeof controlIcon>[0],
    title: string,
    line: string,
    press?: () => void,
  ) => (
    <RowLink
      key={id}
      testID={`class-${id}`}
      icon={controlIcon(icon)}
      title={title}
      description={line}
      disabled={press === undefined}
      onPress={press ?? (() => undefined)}
    />
  );
  const pupil = (one: (typeof pupils)[number], variant: 'default' | 'warning'): ReactNode => {
    const content = (
      <>
        <Text style={styles.number}>{one.number}</Text>
        <Text style={[styles.name, align]}>{one.name}</Text>
        {one.badge !== null && <Badge label={one.badge} variant={variant} />}
      </>
    );
    return props.onPupil === undefined ? (
      <View key={one.id} testID={`class-pupil-${one.id}`} accessible style={styles.pupil}>
        {content}
      </View>
    ) : (
      <Pressable
        key={one.id}
        testID={`class-pupil-${one.id}`}
        accessibilityRole="button"
        onPress={() => props.onPupil?.(one.id)}
        style={styles.pupil}
      >
        {content}
      </Pressable>
    );
  };
  return (
    <ScrollView
      style={styles.screen}
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
      <Text testID="class-subtitle" style={[styles.line, align]}>
        {t('classPage.subtitle', {
          subject: subject === undefined ? row.course.subject : localized(subject.name),
          pupils: t('setup.pupils', { count: row.pupils }),
        })}
      </Text>
      {row.archived !== undefined && (
        <Text testID="class-archived" style={[styles.line, align]}>
          {t('classPage.archived', { day: isolate(frontDate(row.archived)) })}
        </Text>
      )}
      {siblings.length > 1 && (
        <ChipGroup
          testID="class-switch"
          label={t('classPage.switch')}
          selected={row.course.id}
          onSelect={props.onCourse}
          choices={siblings.map((one) => ({ value: one.course.id, label: label(one) }))}
        />
      )}
      {strip !== undefined && (
        <DueStrip
          {...strip}
          testID="class-today"
          fact={t('classPage.today', { time: bookSpan(t, time, direction) ?? '', roll: strip.fact })}
        />
      )}
      <View style={styles.rows}>
        {link('book', 'school', t('book.title'), lines.book, props.onBook)}
        {link('plan', 'tune', t('classPlan.open'), plan.join('\n'), props.onPlan)}
        {link('tests', 'check', t('tests.open'), t('tests.openLine'), props.onTests)}
        {link('roll', 'pupils', t('classPage.roll'), lines.roll, props.onMonth)}
        {link('roll-print', 'print', t('rollPrint.classRow'), t('rollPrint.classRowLine'), props.onRollPrint)}
        {link('homework', 'homework', t('homework.open'), lines.homework, props.onHomework)}
        {row.archived === undefined && link('extra', 'plus', t('extra.title'), t('classPage.extraLine'), props.onExtra)}
        {link('supervised', 'school', t('documents.supervised.name'), lines.supervised, props.onSupervised)}
        {link('marks', 'check', t('classPage.marks'), lines.marks, props.onMarks)}
      </View>
      <SectionHeader
        testID="class-pupils"
        label={t('classPage.pupils')}
        {...(row.archived === undefined && {
          action: <Button testID="class-move" variant="line" label={t('move.open')} onPress={props.onMove} />,
        })}
      />
      {pupils.length === 0 ? (
        <Text style={[styles.line, align]}>{t('setup.pupils', { count: 0 })}</Text>
      ) : (
        <View>{pupils.map((one) => pupil(one, 'warning'))}</View>
      )}
      {left.length > 0 && (
        <>
          <SectionHeader testID="class-left" label={t('classPage.left')} />
          <View>{left.map((one) => pupil(one, 'default'))}</View>
        </>
      )}
      <ClassSettings
        visible={props.settings}
        className={label(row)}
        returnFocusRef={props.settingsOpener}
        onClose={() => props.onSettings(false)}
        onSeats={props.onSeats}
        onRules={props.onRules}
        {...(row.archived === undefined && { onMove: props.onMove })}
        {...(reshapedWith(context, row.schoolClass.id).length > 0 && { onReorient: props.onReorient })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  line: { ...typography.body, color: colors.pencil },
  rows: { gap: spacing['space-10'] },
  pupil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-10'],
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  number: { ...typography.label, color: colors.pencil, minWidth: 28, textAlign: 'center' },
  name: { ...typography.body, color: colors.ink, flex: 1 },
});
