// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A document's «نطاق الطباعة» in «طباعة الأسبوع» (#215, Print-set,
// R-3.8-55): what is new since its last print, a month of the school year,
// or the days between two dates, and for a journal, one journal or one per
// class (answer 252), under what the range covers now. A month steps from
// one to the next; the two dates step a day at a time, the first never
// after the second.

import { addDays, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import type { RefObject } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { ChipGroup } from '../components/Chip';
import { IconButton } from '../components/IconButton';
import { RadioCardGroup } from '../components/RadioCard';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import type { DocumentKind } from './catalogue';
import { DayStep } from './DayStep';
import { monthLabel, type DocumentData } from './document-data';
import type { PrintRange } from './print-ranges';

export type PrintRangeSheetProps = {
  readonly kind: DocumentKind | null;
  readonly data: DocumentData;
  readonly range: PrintRange;
  /** What the range covers now, as the document's line says it. */
  readonly line: string;
  readonly layout?: string;
  readonly onRange: (range: PrintRange) => void;
  readonly onLayout: (layout: string) => void;
  readonly onClose: () => void;
  readonly returnFocusRef: RefObject<ViewInstance | null>;
};

const monthOf = (day: Day) => day.slice(0, 7);

/** The month after or before `month`, such as `2026-11` after `2026-10`. */
function stepMonth(month: string, by: 1 | -1): string {
  const day = `${month}-01` as Day;
  return monthOf(by === 1 ? addDays(day, 31) : addDays(day, -1));
}

export function PrintRangeSheet({
  kind,
  data,
  range,
  line,
  layout,
  onRange,
  onLayout,
  onClose,
  returnFocusRef,
}: PrintRangeSheetProps) {
  const t = useText();
  const { direction } = useLocale();
  const { from: first, to: last } = data.year;
  const today = data.day < first ? first : data.day > last ? last : data.day;
  const layouts = kind?.layouts?.(t) ?? [];
  const month = range.kind === 'month' ? range.month : monthOf(today);
  const choose = (value: PrintRange['kind']) =>
    onRange(
      value === 'new'
        ? { kind: 'new' }
        : value === 'month'
          ? { kind: 'month', month }
          : { kind: 'days', from: addDays(today, -6) < first ? first : addDays(today, -6), to: today },
    );
  return (
    <BottomSheet
      testID="print-range"
      visible={kind !== null}
      title={kind?.title(t) ?? ''}
      context={line}
      reassurance={t('documents.printWeek.rangeLine')}
      returnFocusRef={returnFocusRef}
      onClose={onClose}
    >
      <ChipGroup
        testID="print-range-kind"
        label={t('documents.printWeek.range')}
        selected={range.kind}
        onSelect={choose}
        choices={[
          { value: 'new', label: t('documents.printWeek.new') },
          { value: 'month', label: t('documents.printWeek.month') },
          { value: 'days', label: t('documents.printWeek.days') },
        ]}
      />
      {range.kind === 'month' && (
        <View testID="print-month" style={[styles.step, { direction }]}>
          <View style={styles.flip}>
            <IconButton
              testID="print-month-before"
              icon={controlIcon('chevron')}
              accessibilityLabel={t('documents.printWeek.monthBefore')}
              disabled={`${month}-01` <= first}
              onPress={() => onRange({ kind: 'month', month: stepMonth(month, -1) })}
            />
          </View>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.month}>
            {monthLabel(data, `${month}-01` as Day)}
          </Text>
          <IconButton
            testID="print-month-after"
            icon={controlIcon('chevron')}
            accessibilityLabel={t('documents.printWeek.monthAfter')}
            disabled={`${stepMonth(month, 1)}-01` > last}
            onPress={() => onRange({ kind: 'month', month: stepMonth(month, 1) })}
          />
        </View>
      )}
      {range.kind === 'days' && (
        <View style={styles.days}>
          <Text style={[styles.label, { textAlign: 'auto' }]}>{t('documents.printWeek.from')}</Text>
          <DayStep
            testID="print-from"
            day={range.from}
            first={first}
            last={range.to}
            disabled={false}
            profile={data.profile}
            onDay={(day) => onRange({ ...range, from: day })}
          />
          <Text style={[styles.label, { textAlign: 'auto' }]}>{t('documents.printWeek.to')}</Text>
          <DayStep
            testID="print-to"
            day={range.to}
            first={range.from}
            last={last}
            disabled={false}
            profile={data.profile}
            onDay={(day) => onRange({ ...range, to: day })}
          />
        </View>
      )}
      {layout !== undefined && layouts.length > 0 && (
        <RadioCardGroup
          testID="print-layout"
          label={t('documents.output.layout')}
          selected={layout}
          onSelect={onLayout}
          choices={layouts}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  flip: { transform: [{ scaleX: -1 }] },
  month: { ...typography.label, color: colors.ink, flex: 1, textAlign: 'center' },
  days: { gap: spacing['space-8'] },
  label: { ...typography.label, color: colors.ink2 },
});
