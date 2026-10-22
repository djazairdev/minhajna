// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التوزيعات» (#237, Dist, R-3.8-30, R-3.8-31, answers 416 (7), 421 to 424):
// one class and subject's distributions, the first with a plan unless one is
// given, with a choice between them when the teacher has more. The tabs
// «السنوي», «الشهري» and «الفصلي» show the annual one by sequence, the monthly
// one by teaching week of the month stepped to, which starts on today's, and
// the termly one by term, each from the plan fitted to the timetable and the
// calendar, so they move with what is confirmed. «تصدير أو طباعة» opens the
// output in the tab shown, on the month shown for the monthly one and on today
// for the others. With no class on a plan, the screen says where the
// distributions come from.

import { distributionSessions, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { PageHeading } from '../components/PageHeading';
import { SegmentedControl } from '../components/SegmentedControl';
import { controlIcon } from '../design/Icon';
import { fontFamilyForWeight } from '../design/fonts';
import { colors, fontFamilies, radius, spacing, typography } from '../design/tokens';
import { DayStep } from '../documents/DayStep';
import { distContext, plannedCourses } from '../documents/dist-pages';
import { monthLabel, yearShown } from '../documents/document-data';
import { useDocumentData } from '../documents/useDocumentData';
import { noteSubject } from '../notes/note-rules';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { distTable, shownMonth, yearMonths, type DistTab } from './dist-table';

export type DistProps = {
  readonly courseId?: string;
  /** Opens the output in `layout`, on `day`. */
  readonly onPrint: (layout: DistTab, day: Day) => void;
};

export function Dist({ courseId, onPrint }: DistProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const data = useDocumentData();
  const planned = useMemo(() => plannedCourses(data), [data]);
  const [chosen, setChosen] = useState(courseId);
  const [tab, setTab] = useState<DistTab>('year');
  const months = useMemo(() => yearMonths(data), [data]);
  const [stepped, setMonth] = useState(() => shownMonth(data, data.day));
  const month = months.includes(stepped) ? stepped : shownMonth(data, stepped);
  const one = planned.find((each) => each.course.id === chosen) ?? planned[0];
  const sessions = useMemo(
    () => (one === undefined ? [] : distributionSessions(distContext(data), one.course.id)),
    [data, one],
  );
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const subjectOf = (each: (typeof planned)[number]) =>
    noteSubject(t, data.profile, data.lang, each.course, each.schoolClass);
  if (one === undefined) {
    return (
      <View style={[styles.screen, styles.pad, { direction }]}>
        <Notice testID="dist-none" icon={controlIcon('info')} message={t('distributions.screen.none')} />
      </View>
    );
  }
  const table = distTable(data, t, tab, one, sessions, month.slice(0, 7));
  const line =
    tab === 'year'
      ? t('distributions.screen.year', { year: yearShown(data) })
      : t(tab === 'month' ? 'distributions.screen.month' : 'distributions.screen.term');
  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
          { paddingBottom: insets.bottom + spacing['space-16'] },
        ]}
      >
        <PageHeading
          testID="dist-heading"
          title={t('distributions.screen.title', { name: isolate(one.schoolClass.name) })}
          scope={subjectOf(one)}
        />
        {planned.length > 1 && (
          <ChipGroup
            testID="dist-course"
            label={t('distributions.screen.course')}
            choices={planned.map((each) => ({
              value: each.course.id,
              label: `${isolate(each.schoolClass.name)} · ${subjectOf(each)}`,
            }))}
            selected={one.course.id}
            onSelect={setChosen}
          />
        )}
        <SegmentedControl
          testID="dist-tabs"
          label={t('distributions.screen.tabs')}
          choices={[
            { value: 'year', label: t('distributions.layouts.year.label') },
            { value: 'month', label: t('distributions.layouts.month.label') },
            { value: 'term', label: t('distributions.layouts.term.label') },
          ]}
          selected={tab}
          onSelect={setTab}
        />
        {tab === 'month' && (
          <DayStep
            testID="dist-month"
            day={month}
            first={months[0]}
            last={months[months.length - 1]}
            days={months}
            disabled={false}
            profile={data.profile}
            onDay={setMonth}
            label={{
              text: monthLabel(data, month),
              before: t('distributions.screen.monthBefore'),
              after: t('distributions.screen.monthAfter'),
            }}
          />
        )}
        <Text testID="dist-line" style={[styles.hint, align]}>
          {line}
        </Text>
        <View testID="dist-table" style={styles.table}>
          <View style={[styles.row, styles.head]}>
            {table.heads.map((head, index) => (
              <Text key={head} style={[styles.label, align, index === 2 ? styles.number : styles.cell]}>
                {head}
              </Text>
            ))}
          </View>
          {table.rows.length === 0 && (
            <Text testID="dist-empty" style={[styles.body, styles.pad, align]}>
              {t('distributions.print.empty')}
            </Text>
          )}
          {table.rows.map((row) => (
            <View
              key={row.key}
              testID={`dist-row-${row.key}`}
              accessible
              accessibilityLabel={row.cells
                .map((cell, index) => `${table.heads[index]}: ${cell}`)
                .join(data.lang === 'ar' ? '، ' : ', ')}
              style={styles.row}
            >
              {row.cells.map((cell, index) => (
                <Text key={index} style={[styles.body, align, index === 2 ? styles.number : styles.cell]}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <Button
          testID="dist-print"
          variant="primary"
          icon={controlIcon('print')}
          label={t('distributions.screen.print')}
          onPress={() => onPrint(tab, tab === 'month' ? month : data.day)}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingTop: spacing['space-16'] },
  pad: { padding: spacing['space-16'] },
  table: { borderRadius: radius['radius-card'], backgroundColor: colors.sheet, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    gap: spacing['space-8'],
    paddingHorizontal: spacing['space-12'],
    paddingVertical: spacing['space-8'],
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  head: { borderTopWidth: 0, backgroundColor: colors.soft },
  cell: { flex: 3 },
  number: { flex: 1, textAlign: 'center' },
  body: { ...typography.body, color: colors.ink },
  label: { ...typography.body, fontFamily: fontFamilyForWeight(fontFamilies.arabic, '700'), fontWeight: '700' },
  hint: { ...typography.caption, color: colors.ink2 },
});
