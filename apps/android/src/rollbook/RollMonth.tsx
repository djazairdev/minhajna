// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book (#217, Month and Month-year), opened from the Class
// page: chips for the school year's months up to today and its yearly
// summary. A month shows its Gregorian and Hijri names (answer 253), the
// paper book's legend, the table of its session days so far (answer 258) and
// its totals; a day opens its roll call, or with several, a sheet listing
// them by time, each saying whether it was taken (answer 255). The summary
// shows each month and the year for every pupil, with the class's totals.
// Both open the counting rules, and Roll-print on the month or the summary
// shown (answer 260). The screen reads the record and adds nothing to it.

import { parseDay, type Session } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { OptionRow } from '../components/OptionRow';
import { colors, spacing, typography } from '../design/tokens';
import { monthLabel } from '../documents/document-data';
import { useDocumentData } from '../documents/useDocumentData';
import { courseGroup } from '../classes/class-page-rules';
import { classRows } from '../classes/class-rules';
import { unitTime } from '../roll/roll-labels';
import { recordedMarks } from '../roll/roll-rules';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { hijriOf } from './hijri-months';
import { MonthGrid } from './MonthGrid';
import { YearGrid } from './YearGrid';
import { bookMonths, monthView, percent, totals, yearView, type BookDay } from './month-rules';

export type RollMonthProps = {
  readonly courseId: string;
  /** A month written YYYY-MM, or `year` for the yearly summary. */
  readonly month: string;
  readonly onMonth: (month: string) => void;
  readonly onRoll: (session: Session) => void;
  readonly onRules: () => void;
  readonly onPupil?: (pupilId: string) => void;
  readonly onPrint?: () => void;
};

export function RollMonth(props: RollMonthProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { state, profile, year, calendar, calendarRelease, packs, bells, today } = useAppData();
  const data = useDocumentData();
  const day = today();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const row = useMemo(
    () => classRows(context, day).find((one) => one.course.id === props.courseId),
    [context, day, props.courseId],
  );
  const months = useMemo(() => bookMonths(context, day), [context, day]);
  const yearly = props.month === 'year';
  const month = yearly || !months.includes(props.month) ? (months.at(-1) ?? props.month) : props.month;
  const view = useMemo(
    () => (row === undefined || yearly ? null : monthView(context, row.schoolClass.id, courseGroup(row), month, day)),
    [context, row, yearly, month, day],
  );
  const summary = useMemo(
    () => (row === undefined || !yearly ? null : yearView(context, row.schoolClass.id, courseGroup(row), day)),
    [context, row, yearly, day],
  );
  const [open, setOpen] = useState<BookDay | null>(null);
  const opener = useRef<ViewInstance>(null);
  if (row === undefined) return null;
  const align = { writingDirection: direction, textAlign: 'auto' } as const;
  const monthName = (one: string) => data.profile.months?.[Number(one.slice(5, 7)) - 1]?.[data.lang] ?? one;
  const named = (one: string) => monthLabel(data, parseDay(`${one}-01`));
  const first = months[0] ?? month;
  const hijri = hijriOf(month, data.lang);
  const head = yearly
    ? t('rollBook.yearLine', { from: named(first), to: named(summary?.months.at(-1)?.month ?? first) })
    : hijri === null
      ? named(month)
      : t('rollBook.monthLine', { month: named(month), hijri });
  const sum = totals((view?.rows ?? []).map((one) => one.count));
  const possibles = new Set((view?.rows ?? []).map((one) => one.count?.possible ?? 0));
  const [each] = possibles;
  const rate = `\u2066${percent(sum.rate)}%\u2069`;
  const footer =
    sum.possible === 0
      ? null
      : t(possibles.size === 1 ? 'rollBook.each' : 'rollBook.sum', {
          possible: each,
          absent: t('classPage.absences', { count: sum.absent }),
          total: sum.possible,
          rate,
        });
  const onDay = (one: BookDay) => {
    const [only, more] = one.units;
    const session = only?.sessions[0];
    if (more === undefined && session !== undefined) props.onRoll(session);
    else setOpen(one);
  };
  const note = (text: string, testID?: string) => (
    <Text testID={testID} style={[styles.note, align]}>
      {text}
    </Text>
  );
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
      <Text testID="month-head" style={[styles.line, align]}>
        {head}
      </Text>
      <ChipGroup
        testID="month-switch"
        label={t('rollBook.months')}
        selected={yearly ? 'year' : month}
        onSelect={props.onMonth}
        choices={[
          ...months.map((one) => ({ value: one, label: monthName(one) })),
          { value: 'year', label: t('rollBook.year') },
        ]}
      />
      {yearly ? (
        <>
          {note(
            [
              `${t('rollBook.possible')} ${t('rollBook.possibleLong')}`,
              `${t('rollBook.absent')} ${t('rollBook.absentLong')}`,
              `${t('rollBook.present')} ${t('rollBook.presentLong')}`,
              `${t('rollBook.rate')} ${t('rollBook.rateLong')}`,
            ].join('  '),
            'year-legend',
          )}
          {note(`${t('rollBook.yearNote', { day: dayName(t, day, data.lang, profile) })} ${t('rollBook.yearScroll')}`)}
          {summary !== null && <YearGrid view={summary} monthName={monthName} onPupil={props.onPupil} />}
          {note(t('rollBook.yearFoot'))}
        </>
      ) : (
        <>
          {note(
            [
              `- ${t('rollBook.legend.morning')}`,
              `ǀ ${t('rollBook.legend.afternoon')}`,
              `+ ${t('rollBook.legend.day')}`,
              `(-) ${t('rollBook.legend.justified')}`,
              `+م½ ${t('rollBook.legend.half')}`,
            ].join('   '),
            'month-legend',
          )}
          {note(t('rollBook.tap'))}
          <View ref={opener} collapsable={false}>
            {view !== null && view.days.length > 0 ? (
              <MonthGrid days={view.days} rows={view.rows} onDay={onDay} onPupil={props.onPupil} />
            ) : (
              note(t('rollBook.noDays'), 'month-none')
            )}
          </View>
          {footer !== null && note(footer, 'month-footer')}
          {view?.countsFrom != null &&
            note(t('rollBook.countsFrom', { day: dayName(t, view.countsFrom, data.lang, profile) }), 'month-from')}
          {note(t('rollBook.daysNote'))}
        </>
      )}
      {props.onPrint !== undefined && (
        <Button
          testID="month-print"
          variant="line"
          label={t(yearly ? 'rollPrint.yearPrint' : 'rollPrint.monthPrint')}
          onPress={props.onPrint}
        />
      )}
      <Button testID="month-rules" variant="line" label={t('rules.title')} onPress={props.onRules} />
      <BottomSheet
        testID="month-day-sheet"
        visible={open !== null}
        title={open === null ? '' : t('rollBook.daySessions', { day: dayName(t, open.day, data.lang, profile) })}
        context={t('rollBook.daySub')}
        reassurance={t('roll.official')}
        returnFocusRef={opener}
        onClose={() => setOpen(null)}
      >
        {open?.units.map((unit, index, units) => {
          const session = unit.sessions[0];
          const twins = units.filter((one) => one.sessions.length === 0 && one.half === unit.half);
          const half = t(`rollBook.spoken.${unit.half}`);
          return (
            <OptionRow
              key={unit.key}
              testID={`month-unit-${unit.key}`}
              label={
                unitTime({ state, bells, calendar }, unit, direction) ??
                (twins.length > 1 ? `${half} · ${twins.indexOf(unit) + 1}` : half)
              }
              sub={t(
                session === undefined
                  ? 'rollBook.gone'
                  : recordedMarks(context, unit) === null
                    ? 'rollBook.untaken'
                    : 'rollBook.taken',
              )}
              directional
              disabled={session === undefined}
              onPress={() => {
                setOpen(null);
                if (session !== undefined) props.onRoll(session);
              }}
            />
          );
        })}
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  line: { ...typography.body, color: colors.pencil },
  note: { ...typography.caption, color: colors.ink2 },
});
