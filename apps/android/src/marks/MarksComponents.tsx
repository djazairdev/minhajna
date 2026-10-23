// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «نقاط التقويم المستمر» (#239, answers 442 and 451): the class and the term,
// chips for the months the term covers in primary, open on today's month
// within the term, else its first, a note that the app never turns taps into
// marks, then one row for each component or column of the term's setup with
// its points and how many of its pupils are done, each opening the entry of
// that component's marks for the period. A class archived after a
// reorientation shows its rows, disabled.

import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { courseLabel } from '../exams/course-label';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { componentSheet, openingMonth, periodMonths, termLines } from './component-rules';
import { entryDone } from './entry-rules';
import { assessmentData, termWord } from './marks-rules';

export type MarksComponentsProps = {
  readonly courseId: string;
  readonly term: number;
  /** The month chosen in primary; today's within the term when not given. */
  readonly month?: string;
  readonly onMonth: (month: string) => void;
  readonly onEntry: (componentId: string, month?: string) => void;
};

export function MarksComponents({ courseId, term, month: chosen, onMonth, onEntry }: MarksComponentsProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs, today } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const data = assessmentData(profile);
  const room = state.classes.get(state.courses.get(courseId)?.classId ?? '');
  if (data === null || room === undefined) return null;
  const months = periodMonths(context, courseId, term);
  const month = chosen !== undefined && months.includes(chosen) ? chosen : openingMonth(months, today());
  const monthName = (one: string) => profile.months?.[Number(one.slice(5, 7)) - 1]?.[currentLanguage()] ?? one;
  const { lines } = termLines(context, data, courseId, term);
  const archived = room.archivedFrom !== undefined;
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
      <View accessible style={styles.head}>
        <Text testID="components-class" style={[styles.title, align]}>
          {courseLabel(t, state, profile, courseId, true)}
        </Text>
        <Text style={[styles.note, align]}>{termWord(t, term)}</Text>
      </View>
      {months.length > 0 && month !== undefined && (
        <ChipGroup
          testID="components-month"
          label={t('marks.componentMarks.months')}
          selected={month}
          onSelect={onMonth}
          choices={months.map((one) => ({ value: one, label: monthName(one) }))}
        />
      )}
      <Text style={[styles.note, align]}>{t('marks.componentMarks.note')}</Text>
      {lines.length === 0 && <Text style={[styles.body, align]}>{t('marks.componentMarks.none')}</Text>}
      <View style={styles.rows}>
        {lines.map((line) => {
          const sheet = componentSheet(context, data, courseId, term, line.id, month, today());
          return (
            <RowLink
              key={line.id}
              testID={`components-${line.id}`}
              icon={controlIcon('pencil')}
              title={sheet?.title ?? line.id}
              description={t('marks.componentMarks.line', {
                points: line.points,
                done: sheet === null ? 0 : entryDone(context, courseId, term, sheet).done,
                total: sheet?.listed.length ?? 0,
              })}
              disabled={archived || sheet === null}
              onPress={() => onEntry(line.id, month)}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingTop: spacing['space-16'] },
  head: { gap: spacing['space-2'] },
  rows: { gap: spacing['space-8'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
