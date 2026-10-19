// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Printing the roll-call book (#217, Roll-print, answers 260 to 264): a class's
// book, then what prints: the month's two-page A4 portrait spread, the yearly
// summary on A4 landscape, the front pages, the blank sheet of one of the
// class's session days, or, where the roll is called per session, the slip of
// one taken roll call, picked by its day and then its session; as recorded or
// blank, but for the sheet and the slip, and «طباعة» or «حفظ PDF». It opens on
// the Month screen's class and month, the yearly summary's, the Class page's
// class, the Roll screen's day for the blank sheet or its roll call for the
// slip, or from the Documents tab on the first class and the latest month.
// «خانة توقيعي» shows for the spread and the summary, with the drawn signature
// disabled until #236, so the boxes print blank, and a file with pupils' data
// says «داخلي · سري» is on every page.

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
import { monthLabel } from '../documents/document-data';
import { useOutputRun } from '../documents/output-run';
import { sessionDays } from '../documents/roll-day-sheet';
import { slipDays, slipsOffered, slipLabel, slipUnits } from '../documents/roll-slip';
import { rollOutput, type RollPrintChoice } from '../documents/roll-print-output';
import { rollBooks, type RollBook } from '../documents/roll-spread-pages';
import { useDocumentData } from '../documents/useDocumentData';
import { coreContext } from '../storage/core-context';
import { useText } from '../text/i18n';
import { bookMonths } from './month-rules';
import { blankLine, choiceNote, whatChoices } from './roll-print-choices';
import { RollPrintDay } from './RollPrintDay';

export type { RollPrintChoice };

export type RollPrintProps = {
  /** The course whose book opens first; the first book when not given. */
  readonly courseId?: string;
  /** A month written YYYY-MM; the latest when not given. */
  readonly month?: string;
  /** The blank sheet's day; today or the next session day when not given. */
  readonly day?: string;
  /** The slip's roll call, by its key, on `day`. */
  readonly unit?: string;
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
  const [unitKey, setUnitKey] = useState<string | null>(props.unit ?? null);
  const [picked, setChoice] = useState<RollPrintChoice>(props.choice ?? 'spread');
  const [blank, setBlank] = useState(false);
  const { busy, said, print, save, clear } = useOutputRun();
  const book = books.find((one) => bookKey(one) === chosen) ?? books[0];
  const span = useMemo(() => {
    if (book === undefined) return [];
    return countYear(context, book.classId, undefined, data.day).months.map((one) => one.month);
  }, [context, book, data.day]);
  const offered = book !== undefined && slipsOffered(data, book);
  const choice = picked === 'slip' && !offered ? 'spread' : picked;
  const days = useMemo(() => (book === undefined ? [] : sessionDays(data, book)), [data, book]);
  const taken = useMemo(() => (book === undefined || !offered ? [] : slipDays(data, book)), [data, book, offered]);
  const monthName = (one: string) => data.profile.months?.[Number(one.slice(5, 7)) - 1]?.[data.lang] ?? one;
  const shown = month ?? months.at(-1) ?? data.day.slice(0, 7);
  const sheetDay: Day | undefined =
    days.find((one) => one === day) ?? days.find((one) => compareDays(one, data.day) >= 0) ?? days.at(-1);
  const slipDay: Day | undefined =
    taken.find((one) => one === day) ??
    [...taken].reverse().find((one) => compareDays(one, data.day) <= 0) ??
    taken.at(-1);
  const units = book === undefined || slipDay === undefined ? [] : slipUnits(data, book, slipDay);
  const unit = units.find((one) => one.key === unitKey) ?? units[0];
  const named = monthLabel(data, parseDay(`${shown}-01`));
  const className = (one: RollBook) => {
    const schoolClass = data.state.classes.get(one.classId);
    const group = schoolClass?.groups.find((each) => each.id === one.groupId);
    return group === undefined || group.kind === 'whole'
      ? (schoolClass?.name ?? '')
      : `${schoolClass?.name ?? ''} · ${group.name}`;
  };
  const output =
    book === undefined || (choice === 'day' && sheetDay === undefined) || (choice === 'slip' && unit === undefined)
      ? null
      : rollOutput(data, t, {
          choice,
          book,
          name: className(book),
          blank,
          month: shown,
          day: sheetDay ?? data.day,
          ...(unit !== undefined && { unit }),
        });
  const signed = choice === 'spread' || choice === 'year';
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
        <RollPrintDay
          testID="roll-print-day"
          label={t('rollPrint.day.days')}
          day={sheetDay}
          days={days}
          year={data.year}
          profile={data.profile}
          disabled={busy}
          onDay={change(setDay)}
        />
      )}
      {choice === 'slip' && slipDay !== undefined && unit !== undefined && (
        <RollPrintDay
          testID="roll-print-slip"
          label={t('rollPrint.slip.days')}
          day={slipDay}
          days={taken}
          year={data.year}
          profile={data.profile}
          disabled={busy}
          onDay={change(setDay)}
          sessions={{
            label: t('rollPrint.slip.sessions'),
            selected: unit.key,
            choices: units.map((one) => ({ value: one.key, label: slipLabel(data, t, one) })),
            onSelect: change(setUnitKey),
          }}
        />
      )}
      <RadioCardGroup
        testID="roll-print-what"
        label={t('rollPrint.what')}
        selected={choice}
        disabled={busy}
        onSelect={change(setChoice)}
        choices={whatChoices(t, {
          month: named,
          from: monthName(span[0] ?? data.year.from.slice(0, 7)),
          to: monthName(span.at(-1) ?? data.year.to.slice(0, 7)),
          slip: offered,
        })}
      />
      <Text style={styles.line}>{choiceNote(t, choice)}</Text>
      {choice !== 'day' && choice !== 'slip' && (
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
            { value: 'blank', label: t('documents.output.blank'), description: blankLine(t, choice) },
          ]}
        />
      )}
      <Notice
        testID="roll-print-confidential"
        variant="notice"
        badge={t('documents.confidential')}
        message={t(
          choice === 'day' || choice === 'slip' ? 'rollPrint.day.confidential' : 'documents.output.confidentialLine',
        )}
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
          message={t(
            book === undefined
              ? 'documents.output.noClasses'
              : choice === 'slip'
                ? 'rollPrint.slip.empty'
                : 'rollPrint.day.none',
          )}
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
