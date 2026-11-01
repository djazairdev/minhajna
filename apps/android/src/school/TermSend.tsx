// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Term-send in a demo world (#591, §3.7, §5.9, R-2.6-10, R-3.7-02, R-3.7-09,
// R-3.7-20, R-5.5-11, answer 619), opened from a joined school's card: as it
// opens it reads the teacher's channel and the stand-in's receipts
// (useTermSend.ts); a chip for each class and subject of the timetable in
// force, the first chosen until another is; the term, class, subject and
// world's date; that the world makes the marks up; the chosen course's checks,
// rows and comparison (TermSendMarks.tsx), or why it has none: no timetable
// yet, no term yet, a subject the country does not know, a class the sector's
// stand-in has no list for, or the school's data that does not read; the
// course's latest receipt for the term from this key, received on the world's
// date with its pupils' count and the day signed, marked as the stand-in's, or
// that the same export came before; and signing in one step, the fingerprint or
// PIN named and not asked, refused while a mark is missing or the comparison
// does not match. Then the files and corrections outside a world, and the
// footnote that parents read marks in the state's awlyaa space and that
// Minhajna issues no report cards. Problems are shown in the catalogue's words
// with a way to read again, and said except on a PC; the band, bar and column
// are WeekPage.tsx's.

import type { DemoSchool, Day, SchoolJoined, Subject } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { termName } from '../exams/course-label';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import type { MineCalendar } from '../week/school-mine-session';
import { courseLabel, courseKey } from '../week/week-sign-session';
import { WeekPage } from '../week/WeekPage';
import { TermSendMarks } from './TermSendMarks';
import { useTermSend } from './useTermSend';

export type TermSendProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  readonly join: SchoolJoined;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out. */
  readonly dayText: (day: Day) => string;
  readonly onClose: () => void;
  /** The page's title, said as it opens. */
  readonly said: string;
  /** The country's subjects, which give each timetable subject its code. */
  readonly subjects?: readonly Subject[];
  /** The joined school's calendar and the country's profile, for the term and the bundled data. */
  readonly mine?: MineCalendar;
  /** The world's school, rebuilt from the world's ID, whose classes list their pupils. */
  readonly school?: DemoSchool | null;
};

/** A term's marks for each course, checked, signed in one step and sent to the state's stand-in. */
export function TermSend(props: TermSendProps) {
  const { world, dayText, onClose } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const view = useTermSend(props);
  const { courses, course, sheet, term, receipt, step, problem } = view;
  const subtitle = [
    ...(term === null ? [] : [termName(t, term.number)]),
    ...(course === undefined ? [] : [isolate(course.class), isolate(course.subject)]),
    dayText(world.date),
  ].join(' · ');
  return (
    <WeekPage
      testID="term-send"
      date={world.date}
      region={view.region}
      title={t('demo.termSend.title')}
      subtitle={subtitle}
      onBack={onClose}
    >
      <Text style={[styles.small, align]}>{t('demo.termSend.madeUp')}</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {step === null ? '' : t(`demo.termSend.steps.${step}`)}
      </Text>
      {problem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[styles.problem, align]}>
            {t(problem)}
          </Text>
          <Button testID="term-send-again" variant="line" label={t('demo.termSend.again')} onPress={view.reload} />
        </View>
      )}
      {view.reason !== null && <Text style={[styles.body, align]}>{t(view.reason)}</Text>}
      {courses.length > 0 && view.reason === null && (
        <ChipGroup
          testID="term-send-course"
          label={t('demo.termSend.courses')}
          choices={courses.map((one) => ({ value: courseKey(one), label: courseLabel(courses, one) }))}
          selected={course === undefined ? null : courseKey(course)}
          onSelect={view.choose}
        />
      )}
      {sheet?.kind === 'no-subject' && <Text style={[styles.problem, align]}>{t('demo.termSend.unknownSubject')}</Text>}
      {sheet?.kind === 'no-list' && course !== undefined && (
        <Text style={[styles.body, align]}>{t('demo.termSend.noList', { class: isolate(course.class) })}</Text>
      )}
      {sheet?.kind === 'marks' && view.matches !== null && <TermSendMarks sheet={sheet} matches={view.matches} />}
      {receipt !== null && (
        <View testID="term-send-receipt" style={styles.card}>
          <Text style={[styles.head, align]}>{t('demo.termSend.received')}</Text>
          <Text style={[styles.body, align]}>
            {t('demo.termSend.receivedLine', {
              received: dayText(receipt.received),
              pupils: t('demo.termSend.pupils', { count: receipt.rows }),
              signed: dayText(receipt.signed),
            })}
          </Text>
          <Text style={[styles.small, align]}>{t('demo.termSend.standIn')}</Text>
          {view.again && <Text style={[styles.body, align]}>{t('demo.termSend.already')}</Text>}
        </View>
      )}
      {sheet?.kind === 'marks' && (
        <View style={styles.card}>
          <Text style={[styles.head, align]}>{t('demo.termSend.withKey')}</Text>
          <Text style={[styles.small, align]}>{t('demo.termSend.oneStep')}</Text>
          <Button
            testID="term-send-go"
            label={t(receipt === null ? 'demo.termSend.sign' : 'demo.termSend.sendAgain')}
            disabled={step !== null || !view.ready}
            onPress={view.sign}
          />
          <Text style={[styles.small, styles.centre]}>{t('demo.termSend.signNote')}</Text>
        </View>
      )}
      <View style={styles.card}>
        <Text style={[styles.head, align]}>{t('demo.termSend.files')}</Text>
        <Text style={[styles.small, align]}>{t('demo.termSend.filesLine')}</Text>
        <Text style={[styles.head, align]}>{t('demo.termSend.fix')}</Text>
        <Text style={[styles.small, align]}>{t('demo.termSend.fixLine')}</Text>
      </View>
      <Text style={[styles.small, align]}>{t('demo.termSend.foot')}</Text>
    </WeekPage>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  centre: { textAlign: 'center' },
  problem: { ...typography.body, color: colors['error-ink'] },
});
