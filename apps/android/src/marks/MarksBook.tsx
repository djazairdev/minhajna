// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «كشف النقاط» for a class, subject and term (#240, Marks-book, P-Marks,
// answers 457 to 459): the line «كشف النقاط · 4م2 · اللغة العربية · الفصل
// الأول», the formula and the scale, «حسب القائمة» or «حسب المعدل», the rows,
// the class's figures, the note that thresholds and ranks compare the full
// value, and a line for each pupil shown at the threshold whose full value is
// below it. A row opens the pupil's value sheet, and from it their
// justification.

import { gradeBook, type BookRow } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice } from '../components/Notice';
import { SegmentedControl } from '../components/SegmentedControl';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { courseLabel } from '../exams/course-label';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { atThresholdLines, figuresLine, monthsLine, orderedRows, type BookOrder } from './book-rules';
import { BookTable } from './BookTable';
import { BookValue } from './BookValue';
import { assessmentData, formulaText, termWord } from './marks-rules';

export type MarksBookProps = {
  readonly courseId: string;
  readonly term: number;
  /** Opens the pupil's justification. */
  readonly onJustify: (pupilId: string) => void;
};

export function MarksBook({ courseId, term, onJustify }: MarksBookProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const data = assessmentData(profile);
  const book = useMemo(
    () => (data === null ? null : gradeBook(context, data, courseId, term)),
    [context, data, courseId, term],
  );
  const [order, setOrder] = useState<BookOrder>('list');
  const [open, setOpen] = useState<BookRow | null>(null);
  const opener = useRef<ViewInstance | null>(null);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  if (book === null) {
    return <Text style={[styles.empty, align]}>{t('marks.book.none')}</Text>;
  }
  const nameOf = (pupilId: string) => state.pupils.get(pupilId)?.name ?? pupilId;
  const below = atThresholdLines(t, book, nameOf);
  const formula = book.formula === null ? null : formulaText(t, book.formula);
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
      <Text testID="book-line" style={[styles.heading, align]}>
        {t('marks.book.line', { class: courseLabel(t, state, profile, courseId, true), term: termWord(t, term) })}
      </Text>
      <View testID="book-formula" accessible style={styles.card}>
        <Text style={[styles.body, align]}>
          {formula === null ? t('marks.formula.none') : `${t('marks.book.average')} = ${formula}`}
        </Text>
        <Text style={[styles.note, align]}>
          {[
            t('marks.book.outOf', { scale: book.scale }),
            ...(book.months.length > 0 ? [t('marks.book.months')] : []),
          ].join(' · ')}
        </Text>
      </View>
      {book.rows.length === 0 ? (
        <Notice icon={controlIcon('info')} message={t('marks.book.noPupils')} />
      ) : (
        <>
          {book.formula !== null && (
            <SegmentedControl
              testID="book-order"
              label={t('marks.book.order')}
              selected={order}
              onSelect={setOrder}
              choices={[
                { value: 'list', label: t('marks.book.byList') },
                { value: 'average', label: t('marks.book.byAverage') },
              ]}
            />
          )}
          <BookTable
            book={book}
            rows={orderedRows(book, order)}
            nameOf={nameOf}
            monthsOf={(row) => monthsLine(t, profile, book, row, term)}
            onOpen={(row, ref) => {
              opener.current = ref;
              setOpen(row);
            }}
          />
          {book.formula !== null && (
            <View testID="book-figures" accessible style={styles.notes}>
              <Text style={[styles.label, align]}>{figuresLine(t, book)}</Text>
              <Text style={[styles.note, align]}>{t('marks.book.fullNote')}</Text>
              {below.map((line) => (
                <Text key={line} style={[styles.note, align]}>
                  {line}
                </Text>
              ))}
            </View>
          )}
        </>
      )}
      <BookValue
        book={book}
        row={open}
        name={open === null ? '' : nameOf(open.pupilId)}
        returnFocusRef={opener}
        onClose={() => setOpen(null)}
        onJustify={(pupilId) => {
          setOpen(null);
          onJustify(pupilId);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  empty: { ...typography.body, color: colors.ink2, padding: spacing['space-16'] },
  heading: { ...typography.label, color: colors.ink2 },
  card: {
    gap: spacing['space-4'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  notes: { gap: spacing['space-4'] },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
