// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book in the app (#213, P09, P10): one class and subject, page
// by page as it prints, in the subject's language and direction, opening on
// the latest page. The class's other subjects are a tap away. A confirmed
// row opens the session's details to correct it; a session awaiting
// confirmation is confirmed as proposed with one tap, with «تراجع», or opened
// for another outcome (R-2.3-07); «تراجع» shows only while the record the
// tap made is still the session's latest. The month on screen prints from
// here, so any month of the year can be printed (R-3.8-01).

import {
  canonicalJson,
  confirmSessions,
  courseGrade,
  current,
  isJoint,
  refOf,
  type Course,
  type Day,
  type RecordEvent,
  type Session,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Snackbar } from '../components/Snackbar';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDocumentData } from '../documents/useDocumentData';
import { directionOf, subjectLanguage, wordsFor } from '../documents/texts-book-pages';
import { yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { i18n, isLanguage, useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { bookViewPages, type ViewPage } from './book-pages';
import { BookPageRow } from './BookPageRow';

/** What «تراجع» takes back: the record the tap made, while it is still the session's latest. */
interface Undo {
  readonly key: string;
  readonly made: string;
  readonly events: readonly RecordEvent[];
}

/** The room the undo bar takes at the foot, as on Today. */
const SNACK_ROOM = 96;

export interface TextsBookProps {
  readonly courseId: string;
  readonly onCourse: (courseId: string) => void;
  readonly onDetails: (session: Session) => void;
  /** Prints the month of `day`. */
  readonly onPrint: (day: Day) => void;
}

export function TextsBook({ courseId, onCourse, onDetails, onPrint }: TextsBookProps) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { recordAll, today } = useAppData();
  const data = useDocumentData();
  const day = today();
  const { state, profile } = data;
  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  const context = useMemo(() => coreContext(data), [data]);
  const book = isLanguage(profile.language) ? profile.language : data.lang;
  const words = course === undefined ? book : wordsFor(subjectLanguage(profile, course.subject, data.lang), book);
  const dir = directionOf(words);
  const st = useMemo(() => i18n.getFixedT(words), [words]);
  const pages = useMemo(
    () => (course === undefined ? [] : bookViewPages(data, context, course, st, dir, day)),
    [data, context, course, st, dir, day],
  );
  const [shown, setShown] = useState<number | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const index = shown === null || shown >= pages.length ? pages.length - 1 : shown;
  const page = pages[index];

  if (course === undefined || schoolClass === undefined) {
    return (
      <View style={[styles.screen, styles.content, { direction, padding: spacing['space-16'] }]}>
        <Text testID="book-empty" style={styles.empty}>
          {t('book.empty')}
        </Text>
      </View>
    );
  }
  const levelOf = (other: Course) => (isJoint(schoolClass) ? courseGrade(other, schoolClass) : undefined);
  const subjectName = (code: string) => profile.subjects.find((one) => one.code === code)?.name[data.lang] ?? code;
  const siblings = [...state.courses.values()].filter(
    (other) => other.classId === course.classId && other.year === course.year,
  );
  const grade = levelOf(course);
  const className = isolate(grade === undefined ? schoolClass.name : `${schoolClass.name} · ${yearShort(t, grade)}`);
  const monthName = (month: string) =>
    `${profile.months?.[Number(month.slice(5, 7)) - 1]?.[data.lang] ?? month.slice(5, 7)} ${month.slice(0, 4)}`;

  const pageName = (other: ViewPage | undefined) =>
    other === undefined ? '' : (other.number ?? monthName(other.month));

  const confirm = (session: Session) => {
    const events = confirmSessions(context, [{ session }]);
    const made = events.find((event) => event.kind === 'session.recorded');
    recordAll(events);
    if (made?.kind === 'session.recorded') {
      setUndo({
        key: session.key,
        made: canonicalJson(made.record),
        events: [{ kind: 'session.withdrawn', session: refOf(session) }],
      });
    }
  };
  const undoing = undo !== null && canonicalJson(current(state.sessions.get(undo.key))) === undo.made ? undo : null;

  return (
    <View style={[styles.screen, { direction, paddingTop: spacing['space-8'] }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
            paddingBottom: insets.bottom + spacing['space-16'] + (undoing === null ? 0 : SNACK_ROOM),
          },
        ]}
      >
        <Text testID="book-heading" accessibilityRole="header" style={styles.heading}>
          {t('book.heading', { className, subject: subjectName(course.subject) })}
        </Text>
        {page !== undefined && (
          <Text testID="book-page" style={styles.sub}>
            {page.number === null
              ? t('book.unprinted', { month: monthName(page.month) })
              : t('book.page', { page: page.number, month: monthName(page.month) })}
          </Text>
        )}
        {siblings.length > 1 && (
          <ChipGroup
            testID="book-subjects"
            label={t('book.subjects')}
            choices={siblings.map((other) => {
              const level = levelOf(other);
              const name = subjectName(other.subject);
              return { value: other.id, label: level === undefined ? name : `${name} · ${yearShort(t, level)}` };
            })}
            selected={course.id}
            onSelect={(id) => id !== course.id && onCourse(id)}
          />
        )}
        {page === undefined ? (
          <Text testID="book-empty" style={styles.empty}>
            {t('book.empty')}
          </Text>
        ) : (
          <View style={styles.page}>
            <View style={[styles.head, { direction: dir }]} importantForAccessibility="no-hide-descendants">
              <Text style={[styles.headText, styles.when]}>
                {`${st('documents.textsBook.date')}\n${st('documents.textsBook.time')}`}
              </Text>
              <Text style={[styles.headText, styles.grow]}>{st('documents.textsBook.topic')}</Text>
              <Text style={[styles.headText, styles.sign]}>{st('documents.textsBook.signature')}</Text>
            </View>
            {page.rows.map((row) => (
              <BookPageRow
                key={row.key}
                row={row}
                dir={dir}
                today={row.day === day}
                t={t}
                onDetails={() => onDetails(row.session)}
                onConfirm={() => confirm(row.session)}
              />
            ))}
          </View>
        )}
        <View style={styles.foot}>
          {index > 0 && (
            <Button
              testID="book-before"
              variant="line"
              label={t('book.before', { page: pageName(pages[index - 1]) })}
              onPress={() => setShown(index - 1)}
            />
          )}
          {index < pages.length - 1 && (
            <Button
              testID="book-after"
              variant="line"
              label={t('book.after', { page: pageName(pages[index + 1]) })}
              onPress={() => setShown(index + 1)}
            />
          )}
          {page !== undefined && (
            <Button
              testID="book-print"
              variant="soft"
              label={t('book.print', { month: monthName(page.month) })}
              onPress={() => onPrint(`${page.month}-01` as Day)}
            />
          )}
        </View>
      </ScrollView>
      {undoing !== null && (
        <Snackbar
          testID="book-snack"
          message={t('today.snack')}
          undoLabel={t('today.undo')}
          bottomOffset={insets.bottom}
          onUndo={() => {
            recordAll(undoing.events);
            setUndo(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'] },
  heading: { ...typography['bar-title'], color: colors.ink },
  sub: { ...typography.body, color: colors.pencil },
  empty: { ...typography.body, color: colors.pencil },
  page: {
    borderWidth: 1.5,
    borderColor: colors['book-edge'],
    borderRadius: radius['radius-control'],
    overflow: 'hidden',
    backgroundColor: colors.sheet,
  },
  head: { flexDirection: 'row', borderBottomWidth: 1.5, borderColor: colors['book-edge'] },
  headText: { ...typography['book-head'], color: colors['head-ink'], textAlign: 'center', padding: spacing['space-8'] },
  when: { width: '30%' },
  grow: { flex: 1 },
  sign: { width: 48, paddingHorizontal: 0 },
  foot: { gap: spacing['space-8'] },
});
