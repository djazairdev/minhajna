// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Printing the roll-call book (#217, Roll-print, answers 260 to 262): a
// class's book, then what prints: the month's two-page A4 portrait spread,
// the yearly summary on A4 landscape, the front pages, or the blank sheet of
// one of the class's session days; as recorded or blank, but for the sheet,
// and «طباعة» or «حفظ PDF». It opens on the Month screen's class and month,
// the yearly summary's, the Class page's class, the Roll screen's day for the
// blank sheet, or from the Documents tab on the first class and the latest
// month. «خانة توقيعي» shows for the spread and the summary, with the drawn
// signature disabled until #236, so the boxes print blank, and a file with
// pupils' data says «داخلي · سري» is on every page.

import { useLocale } from '@react-navigation/native';
import { compareDays, countYear, courseGrade, isJoint, parseDay, type Day } from '@minhajna/core';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { RadioCardGroup } from '../components/RadioCard';
import { SegmentedControl } from '../components/SegmentedControl';
import { courseGroup } from '../classes/class-page-rules';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { DayStep } from '../documents/DayStep';
import { monthLabel } from '../documents/document-data';
import { useOutputRun } from '../documents/output-run';
import { sessionDays } from '../documents/roll-day-sheet';
import { rollOutput, type RollPrintChoice } from '../documents/roll-print-output';
import { rollBooks, type RollBook } from '../documents/roll-spread-pages';
import { useDocumentData } from '../documents/useDocumentData';
import { coreContext } from '../storage/core-context';
import { useText } from '../text/i18n';
import { bookMonths } from './month-rules';

export type { RollPrintChoice };

export type RollPrintProps = {
  /** The course whose book opens first; the first book when not given. */
  readonly courseId?: string;
  /** A month written YYYY-MM; the latest when not given. */
  readonly month?: string;
  /** The blank sheet's day; today or the next session day when not given. */
  readonly day?: string;
  readonly choice?: RollPrintChoice;
};

const bookKey = (book: Pick<RollBook, 'classId' | 'groupId'>) => `${book.classId}/${book.groupId}`;

export function RollPrint(props: RollPrintProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const data = useDocumentData();
  const context = useMemo(() => coreContext(data), [data]);
  const books = useMemo(() => rollBooks(data), [data]);
  const months = useMemo(() => bookMonths(context, data.day), [context, data.day]);
  const [chosen, setChosen] = useState<string | null>(() => {
    const course = props.courseId === undefined ? undefined : data.state.courses.get(props.courseId);
    const schoolClass = course === undefined ? undefined : data.state.classes.get(course.classId);
    if (course === undefined || schoolClass === undefined) return null;
    const grade = isJoint(schoolClass) ? courseGrade(course, schoolClass) : undefined;
    return bookKey({
      classId: schoolClass.id,
      groupId: courseGroup({ schoolClass, ...(grade !== undefined && { grade }) }),
    });
  });
  const [month, setMonth] = useState(props.month !== undefined && months.includes(props.month) ? props.month : null);
  const [day, setDay] = useState<string | null>(props.day ?? null);
  const [choice, setChoice] = useState<RollPrintChoice>(props.choice ?? 'spread');
  const [blank, setBlank] = useState(false);
  const { busy, said, print, save, clear } = useOutputRun();
  const book = books.find((one) => bookKey(one) === chosen) ?? books[0];
  const span = useMemo(() => {
    if (book === undefined) return [];
    return countYear(context, book.classId, undefined, data.day).months.map((one) => one.month);
  }, [context, book, data.day]);
  const days = useMemo(() => (book === undefined ? [] : sessionDays(data, book)), [data, book]);
  const monthName = (one: string) => data.profile.months?.[Number(one.slice(5, 7)) - 1]?.[data.lang] ?? one;
  const shown = month ?? months.at(-1) ?? data.day.slice(0, 7);
  const sheetDay: Day | undefined =
    days.find((one) => one === day) ?? days.find((one) => compareDays(one, data.day) >= 0) ?? days.at(-1);
  const named = monthLabel(data, parseDay(`${shown}-01`));
  const className = (one: RollBook) => {
    const schoolClass = data.state.classes.get(one.classId);
    const group = schoolClass?.groups.find((each) => each.id === one.groupId);
    return group === undefined || group.kind === 'whole'
      ? (schoolClass?.name ?? '')
      : `${schoolClass?.name ?? ''} · ${group.name}`;
  };
  const output =
    book === undefined || (choice === 'day' && sheetDay === undefined)
      ? null
      : rollOutput(data, t, { choice, book, name: className(book), blank, month: shown, day: sheetDay ?? data.day });
  const signed = choice === 'spread' || choice === 'year';
  const notes: Record<RollPrintChoice, string> = {
    spread: t('rollPrint.spreadNote'),
    year: t('rollPrint.yearNote'),
    front: t('rollPrint.front.note'),
    day: t('rollPrint.day.note'),
  };
  const blankLines: Record<RollPrintChoice, string> = {
    spread: t('documents.output.blankRoll'),
    year: t('rollPrint.blankYear'),
    front: t('rollPrint.front.blank'),
    day: '',
  };
  const change =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      clear();
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
      {books.length > 1 && book !== undefined && (
        <ChipGroup
          testID="roll-print-class"
          label={t('rollPrint.classes')}
          selected={bookKey(book)}
          onSelect={change(setChosen)}
          choices={books.map((one) => ({ value: bookKey(one), label: className(one) }))}
        />
      )}
      {choice === 'spread' && (
        <ChipGroup
          testID="roll-print-month"
          label={t('rollBook.months')}
          selected={shown}
          onSelect={change(setMonth)}
          choices={months.map((one) => ({ value: one, label: monthName(one) }))}
        />
      )}
      {choice === 'day' && sheetDay !== undefined && (
        <>
          <Text style={styles.label}>{t('rollPrint.day.days')}</Text>
          <DayStep
            testID="roll-print-day"
            day={sheetDay}
            first={data.year.from}
            last={data.year.to}
            days={days}
            disabled={busy}
            profile={data.profile}
            onDay={change(setDay)}
          />
        </>
      )}
      <RadioCardGroup
        testID="roll-print-what"
        label={t('rollPrint.what')}
        selected={choice}
        disabled={busy}
        onSelect={change(setChoice)}
        choices={[
          { value: 'spread', label: t('rollPrint.spread', { month: named }), description: t('rollPrint.spreadLine') },
          {
            value: 'year',
            label: t('rollPrint.year'),
            description: t('rollPrint.yearLine', {
              from: monthName(span[0] ?? data.year.from.slice(0, 7)),
              to: monthName(span.at(-1) ?? data.year.to.slice(0, 7)),
            }),
          },
          { value: 'front', label: t('rollPrint.front.name'), description: t('rollPrint.front.line') },
          { value: 'day', label: t('rollPrint.day.name'), description: t('rollPrint.day.line') },
        ]}
      />
      <Text style={styles.line}>{notes[choice]}</Text>
      {choice !== 'day' && (
        <RadioCardGroup
          testID="roll-print-version"
          label={t('documents.output.version')}
          selected={blank ? 'blank' : 'recorded'}
          disabled={busy}
          onSelect={(value) => change(setBlank)(value === 'blank')}
          choices={[
            {
              value: 'recorded',
              label: t('documents.output.recorded'),
              description: t('documents.output.recordedLine'),
            },
            { value: 'blank', label: t('documents.output.blank'), description: blankLines[choice] },
          ]}
        />
      )}
      <Notice
        testID="roll-print-confidential"
        variant="notice"
        badge={t('documents.confidential')}
        message={t(choice === 'day' ? 'rollPrint.day.confidential' : 'documents.output.confidentialLine')}
      />
      {signed && (
        <>
          <Text style={styles.label}>{t('rollPrint.signature')}</Text>
          <SegmentedControl
            testID="roll-print-signature"
            label={t('rollPrint.signature')}
            selected="blank"
            disabled
            onSelect={() => undefined}
            choices={[
              { value: 'drawn', label: t('documents.printWeek.drawn') },
              { value: 'blank', label: t('documents.printWeek.blankBox') },
            ]}
          />
          <Text style={styles.line}>{t('rollPrint.signatureNote')}</Text>
        </>
      )}
      {output === null && (
        <Notice
          testID="roll-print-empty"
          icon={controlIcon('info')}
          message={t(book === undefined ? 'documents.output.noClasses' : 'rollPrint.day.none')}
        />
      )}
      {said !== null && (
        <Notice
          testID="roll-print-said"
          icon={controlIcon(said === 'saved' ? 'check' : 'info')}
          message={t(said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
        />
      )}
      <View style={styles.actions}>
        <Button
          testID="roll-print-print"
          label={t('documents.output.print')}
          disabled={busy || output === null}
          onPress={() => output !== null && print(output.html, output.title, output.landscape)}
        />
        <Button
          testID="roll-print-save"
          variant="line"
          label={t('documents.output.save')}
          disabled={busy || output === null}
          onPress={() => output !== null && save(output.html, output.made, output.file, output.landscape)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  line: { ...typography.body, color: colors.pencil },
  label: { ...typography.label, color: colors.ink2, marginBottom: -spacing['space-8'] },
  actions: { gap: spacing['space-10'], paddingTop: spacing['space-8'] },
});
