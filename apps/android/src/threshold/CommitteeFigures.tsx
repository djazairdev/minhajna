// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The figures of a committee's room, before or after the exam (#604, #605,
// #606, answers 51, 549, 638 to 640): the classes, teachers and schools the
// totals cover and the share of the classes that reached each item of the plan
// on the figures day, with the last two term ends with totals as comparison
// only and the table of the same figures, a figure held back under the floors,
// and for the nation the wilayas as a range, never named; or that the figures
// are not added up or are hidden; the last item every class, nine classes in
// ten and half of them reached; and the sessions lost to closures.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text } from 'react-native';
import { ChartFigure } from '../drawing/ChartFigure';
import { useDeviceText } from '../text/device-text';
import { committeeSpec, gradeMarks, rangeSpec, wilayaRange } from './committee-figures';
import { gradeShown } from './exam-totals';
import { thresholdStyles as styles } from './ThresholdFrame';
import type { LevelFigures } from './use-committee-figures';

export type CommitteeFiguresProps = {
  /** The test IDs' first word. */
  readonly testID: string;
  readonly level: 'directorate' | 'national';
  readonly subject: string;
  readonly grade: string;
  readonly items: readonly string[];
  /** A plan item's name, quoted, or that there is none. */
  readonly item: (id: string | null) => string;
  /** The figures day, as the page writes it. */
  readonly day: string;
  readonly dayText: (day: Day) => string;
  /** The figures day's figures: null when not added up, undefined while read or after a problem. */
  readonly figures: LevelFigures | null | undefined;
  /** The term ends' figures, each with its day. */
  readonly ends: readonly { readonly day: Day; readonly figures: LevelFigures | null }[];
};

/** A room's counts, charts, marks and closures. */
export function CommitteeFigures(props: CommitteeFiguresProps) {
  const { testID, level, subject, grade, items, item, day, dayText, figures, ends } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const small = (words: string) => <Text style={[styles.small, align]}>{words}</Text>;
  const shown = figures === undefined ? undefined : gradeShown(figures, subject, grade);
  const closures = figures?.subjects.find(([code]) => code === subject)?.[1]?.closed;
  const range = figures?.wilayas === undefined ? null : wilayaRange(figures.wilayas, subject, grade, items);
  const compared = ends.flatMap((end) => {
    const figure = end.figures === null ? 'notYet' : gradeShown(end.figures, subject, grade);
    return typeof figure === 'object' ? [{ grade: figure, day: dayText(end.day) }] : [];
  });
  const marks = typeof shown === 'object' ? gradeMarks(shown, items) : null;
  return (
    <>
      {typeof shown === 'string' && (
        <Text style={[styles.body, align]}>
          {t(shown === 'hidden' ? `demo.committee.level.${level}.hidden` : 'demo.committee.notYet')}
        </Text>
      )}
      {typeof shown === 'object' && (
        <>
          {small(
            t('demo.committee.counts', { teachers: shown.teachers, classes: shown.classes, schools: shown.schools }),
          )}
          <ChartFigure
            testID={`${testID}-chart`}
            spec={committeeSpec(t, { grade: shown, day }, compared, items, item)}
            categoryLabel={t('demo.examTotals.item')}
          />
          {range !== null &&
            (['all', 'middle'] as const).map((which) => (
              <ChartFigure
                key={which}
                testID={`${testID}-range-${which}`}
                spec={rangeSpec(t, which, { grade: shown, day }, range, items, item)}
                categoryLabel={t('demo.examTotals.item')}
              />
            ))}
          {marks !== null &&
            small(
              marks.every === null
                ? t('demo.committee.marks.everyNone')
                : t('demo.committee.marks.every', { item: item(marks.every) }),
            )}
          {marks?.ninety != null && small(t('demo.committee.marks.ninety', { item: item(marks.ninety) }))}
          {marks?.half != null && small(t('demo.committee.marks.half', { item: item(marks.half) }))}
          {figures?.wilayas !== undefined &&
            small(t(range === null ? 'demo.committee.noRange' : 'demo.committee.range'))}
        </>
      )}
      {closures !== undefined && small(t('demo.committee.closures', { count: closures }))}
    </>
  );
}
