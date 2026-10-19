// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Printing the roll-call book (#217, Roll-print, answers 260 and 261): a
// class's book and a month, then what prints, the month's two-page A4
// portrait spread or the yearly summary on A4 landscape, as recorded or
// blank, and «طباعة» or «حفظ PDF». It opens on the Month screen's class and
// month, the yearly summary's, the Class page's class, or from the Documents
// tab on the first class and the latest month. «خانة توقيعي» shows with the
// drawn signature disabled until #236, so the boxes print blank, and a file
// with pupils' data says «داخلي · سري» is on every page.

import { useLocale } from '@react-navigation/native';
import { countYear, courseGrade, isJoint, parseDay } from '@minhajna/core';
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
import { monthLabel, yearShown } from '../documents/document-data';
import { useOutputRun } from '../documents/output-run';
import { rollBooks, rollSpreadPages, type RollBook } from '../documents/roll-spread-pages';
import { rollYearPages } from '../documents/roll-year-pages';
import { useDocumentData } from '../documents/useDocumentData';
import { coreContext } from '../storage/core-context';
import { useText } from '../text/i18n';
import { bookMonths } from './month-rules';

export type RollPrintChoice = 'spread' | 'year';

export type RollPrintProps = {
  /** The course whose book opens first; the first book when not given. */
  readonly courseId?: string;
  /** A month written YYYY-MM; the latest when not given. */
  readonly month?: string;
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
  const [choice, setChoice] = useState<RollPrintChoice>(props.choice ?? 'spread');
  const [blank, setBlank] = useState(false);
  const { busy, said, print, save, clear } = useOutputRun();
  const book = books.find((one) => bookKey(one) === chosen) ?? books[0];
  const span = useMemo(() => {
    if (book === undefined) return [];
    return countYear(context, book.classId, undefined, data.day).months.map((one) => one.month);
  }, [context, book, data.day]);
  const monthName = (one: string) => data.profile.months?.[Number(one.slice(5, 7)) - 1]?.[data.lang] ?? one;
  const shown = month ?? months.at(-1) ?? data.day.slice(0, 7);
  const yearly = choice === 'year';
  const named = monthLabel(data, parseDay(`${shown}-01`));
  const className = (one: RollBook) => {
    const schoolClass = data.state.classes.get(one.classId);
    const group = schoolClass?.groups.find((each) => each.id === one.groupId);
    return group === undefined || group.kind === 'whole'
      ? (schoolClass?.name ?? '')
      : `${schoolClass?.name ?? ''} · ${group.name}`;
  };
  const html = () =>
    book === undefined
      ? ''
      : yearly
        ? rollYearPages(data, t, blank, [book])
        : rollSpreadPages(data, t, blank, shown, [book]);
  const title = yearly
    ? t('rollPrint.yearTitle', { year: yearShown(data) })
    : t('rollPrint.spreadTitle', { month: named });
  const file = () => {
    const name = `${t('documents.rollBook')} ${book === undefined ? '' : className(book)} ${yearly ? data.year.id : shown}`;
    return `${name}${blank ? ` - ${t('documents.output.blank')}` : ''}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
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
      {!yearly && (
        <ChipGroup
          testID="roll-print-month"
          label={t('rollBook.months')}
          selected={shown}
          onSelect={change(setMonth)}
          choices={months.map((one) => ({
            value: one,
            label: monthName(one),
          }))}
        />
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
        ]}
      />
      <Text style={styles.line}>{t(yearly ? 'rollPrint.yearNote' : 'rollPrint.spreadNote')}</Text>
      <RadioCardGroup
        testID="roll-print-version"
        label={t('documents.output.version')}
        selected={blank ? 'blank' : 'recorded'}
        disabled={busy}
        onSelect={(value) => change(setBlank)(value === 'blank')}
        choices={[
          { value: 'recorded', label: t('documents.output.recorded'), description: t('documents.output.recordedLine') },
          {
            value: 'blank',
            label: t('documents.output.blank'),
            description: t(yearly ? 'rollPrint.blankYear' : 'documents.output.blankRoll'),
          },
        ]}
      />
      <Notice
        testID="roll-print-confidential"
        variant="notice"
        badge={t('documents.confidential')}
        message={t('documents.output.confidentialLine')}
      />
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
      {book === undefined && (
        <Notice testID="roll-print-empty" icon={controlIcon('info')} message={t('documents.output.noClasses')} />
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
          disabled={busy || book === undefined}
          onPress={() => print(html, title, yearly)}
        />
        <Button
          testID="roll-print-save"
          variant="line"
          label={t('documents.output.save')}
          disabled={busy || book === undefined}
          onPress={() => save(html, yearly ? 'roll-year' : `roll-${shown}`, file(), yearly)}
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
