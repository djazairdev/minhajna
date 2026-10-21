// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The texts book's homework record in the app (#214, P67, R-3.8-19 to 23):
// one class and subject, the homework its sessions set in the order it was
// set, in the subject's language and direction. Homework that has come back
// opens its two counts; the homework that comes back today, or the one
// Today's card opened, starts open. A count is saved the moment it is
// confirmed, with «تراجع» while it is still the latest. Only confirmed
// counts print; the rest stay blank, as on paper. The year's homework
// pages print from here.

import {
  canonicalJson,
  compareDays,
  countHomework,
  courseGrade,
  current,
  homeworkRecord,
  isJoint,
  uncountHomework,
  type HomeworkItem,
  type RecordEvent,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Snackbar } from '../components/Snackbar';
import { colors, radius, spacing, typography } from '../design/tokens';
import { directionOf, subjectLanguage, wordsFor } from '../documents/texts-book-pages';
import { yearShort } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, i18n, isLanguage, useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { HomeworkCounter } from './HomeworkCounter';
import { HomeworkRow } from './HomeworkRow';

/** What «تراجع» takes back: the count the tap made, while it is still the latest. */
interface Undo {
  readonly key: string;
  readonly made: string;
  readonly events: readonly RecordEvent[];
}

export interface HomeworkBookProps {
  readonly courseId: string;
  /** The homework Today's card opened, by the key of the session that set it. */
  readonly sessionKey?: string;
  /** Prints the homework pages of the year. */
  readonly onPrint?: () => void;
}

export function HomeworkBook({ courseId, sessionKey, onPrint }: HomeworkBookProps) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, calendar, calendarRelease, packs, today, recordAll } = useAppData();
  const day = today();
  const lang = currentLanguage();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const items = useMemo(() => homeworkRecord(context, courseId), [context, courseId]);
  const [chosen, setChosen] = useState<string | null>(sessionKey ?? null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const course = state.courses.get(courseId);
  const schoolClass = course && state.classes.get(course.classId);
  const book = isLanguage(profile.language) ? profile.language : lang;
  const words = course === undefined ? book : wordsFor(subjectLanguage(profile, course.subject, lang), book);
  const dir = directionOf(words);
  const st = i18n.getFixedT(words);
  const names = { notDone: st('documents.homework.notDone'), reliedOn: st('documents.homework.reliedOn') };

  if (course === undefined || schoolClass === undefined) {
    return (
      <View style={[styles.screen, { direction, padding: spacing['space-16'] }]}>
        <Text style={styles.empty}>{t('homework.empty')}</Text>
      </View>
    );
  }
  const grade = isJoint(schoolClass) ? courseGrade(course, schoolClass) : undefined;
  const className = isolate(grade === undefined ? schoolClass.name : `${schoolClass.name} · ${yearShort(t, grade)}`);
  const subject = profile.subjects.find((one) => one.code === course.subject)?.name[lang] ?? course.subject;
  const open =
    chosen ?? items.find((item) => item.count === null && compareDays(item.due, day) === 0)?.session.key ?? null;
  const undoing =
    undo !== null && canonicalJson(current(state.homeworkCounts.get(undo.key))) === undo.made ? undo : null;

  const count = (item: HomeworkItem, notDone: number, reliedOn: number) => {
    let event: RecordEvent;
    try {
      event = countHomework(context, item, notDone, reliedOn, day);
    } catch (error) {
      if (__DEV__) console.warn('The count was refused', error);
      return;
    }
    recordAll([event]);
    if (event.kind !== 'homework.counted') return;
    const before = item.count;
    setUndo({
      key: item.session.key,
      made: canonicalJson(event.count),
      events: [before === null ? uncountHomework(item.session.key) : { kind: 'homework.counted', count: before }],
    });
  };

  return (
    <View style={[styles.screen, { direction }]}>
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
        <Text testID="homework-heading" accessibilityRole="header" style={styles.heading}>
          {t('homework.heading', { className, subject })}
        </Text>
        <Text style={styles.sub}>{st('documents.homework.sideNote')}</Text>
        {items.length === 0 ? (
          <Text testID="homework-empty" style={styles.empty}>
            {t('homework.empty')}
          </Text>
        ) : (
          <View style={styles.page}>
            <View style={[styles.head, { direction: dir }]} importantForAccessibility="no-hide-descendants">
              <Text style={[styles.headText, styles.when]}>
                {`${st('documents.homework.date')}\n${st('documents.homework.due')}`}
              </Text>
              <Text style={[styles.headText, styles.grow]}>{st('documents.homework.activity')}</Text>
            </View>
            <View style={[styles.head, { direction: dir }]} importantForAccessibility="no-hide-descendants">
              <Text style={[styles.headText, styles.grow, styles.split]}>
                {`${names.notDone}\n${st('documents.homework.number')} · %`}
              </Text>
              <Text style={[styles.headText, styles.grow]}>
                {`${names.reliedOn}\n${st('documents.homework.number')} · %`}
              </Text>
            </View>
            {items.map((item) => {
              const key = item.session.key;
              const back = compareDays(item.due, day) <= 0;
              return (
                <HomeworkRow
                  key={key}
                  item={item}
                  dir={dir}
                  dueToday={compareDays(item.due, day) === 0}
                  chosen={open === key}
                  names={names}
                  {...(back && { onChoose: () => setChosen(open === key ? '' : key) })}
                >
                  {open === key && back && (
                    <HomeworkCounter
                      key={`${canonicalJson(item.count)}/${item.listed}`}
                      item={item}
                      names={names}
                      onCount={(notDone, reliedOn) => count(item, notDone, reliedOn)}
                    />
                  )}
                </HomeworkRow>
              );
            })}
          </View>
        )}
        <Text style={styles.note}>{t('homework.printNote')}</Text>
        {onPrint !== undefined && (
          <Button testID="homework-print" variant="soft" label={t('homework.print')} onPress={onPrint} />
        )}
      </ScrollView>
      {undoing !== null && (
        <Snackbar
          testID="homework-snack"
          message={t('homework.saved')}
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

/** The room the undo bar takes at the foot, as on Today. */
const SNACK_ROOM = 96;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingTop: spacing['space-8'] },
  heading: { ...typography['bar-title'], color: colors.ink },
  sub: { ...typography.body, color: colors.pencil },
  empty: { ...typography.body, color: colors.pencil },
  note: { ...typography.body, color: colors.pencil },
  page: {
    borderWidth: 1.5,
    borderColor: colors['book-edge'],
    borderRadius: radius['radius-control'],
    overflow: 'hidden',
    backgroundColor: colors.sheet,
  },
  head: { flexDirection: 'row', borderBottomWidth: 1.5, borderColor: colors['book-edge'] },
  headText: { ...typography['book-head'], color: colors['head-ink'], textAlign: 'center', padding: spacing['space-8'] },
  when: { width: '34%', borderEndWidth: 1, borderColor: colors.line },
  grow: { flex: 1 },
  split: { borderEndWidth: 1, borderColor: colors.line },
});
