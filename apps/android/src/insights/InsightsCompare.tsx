// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How a class compares with its peers (#623, R-1.6-07, R-8.4-02 to R-8.4-04,
// answer 700), as Insights-compare draws it: worked out here, from the
// published figures whose counts it names; the sessions each item took against
// the plan (CompareTable.tsx); the items most changed, each in a band of the
// classes that reached it; how far the classes got, with the self-selection
// note. One live line says each state as it comes, or why there is none, and
// the comparison being ready is said as the page's opening is.

import type { CompareBand } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { subjectName } from '../sharing/statement-lines';
import { gradeName } from '../setup/names';
import type { TermReference } from '../director/seeded-fill';
import { useDeviceText } from '../text/device-text';
import { CompareTable } from './CompareTable';
import { InsightsScreen } from './InsightsScreen';
import { compareStyles as local } from './compare-styles';
import { insightsStyles as styles } from './insights-styles';
import type { ClassCompare } from './use-class-compare';

export type InsightsCompareProps = {
  readonly className: string;
  readonly compare: ClassCompare;
  readonly reference: TermReference;
  /** The world's date, written out for the band. */
  readonly date: string;
  readonly term: 1 | 2 | 3;
  readonly onAgain: () => void;
  readonly onClose: () => void;
};

/** The class's comparison page. */
export function InsightsCompare(props: InsightsCompareProps) {
  const { className, compare, reference, date, term, onAgain, onClose } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const words = { class: className };
  const band = ([low, high]: CompareBand) =>
    high === 100
      ? t('demo.insights.compare.band.over', { low })
      : t('demo.insights.compare.band.between', { low, high });
  const termName = `${t(`demo.insights.compare.term.${term}`)} ${reference.calendar.year.id}`;
  const sub =
    compare.kind === 'ready'
      ? [
          gradeName(reference.profile, compare.sending.grade),
          subjectName(reference.profile, compare.sending.subject),
          termName,
        ].join(' · ')
      : termName;
  const placed = (title: string | null) => title ?? t('demo.insights.compare.place.notBegun');
  const middle = ({ low, high }: { readonly low: string | null; readonly high: string | null }) =>
    high === null
      ? t('demo.insights.compare.place.notBegun')
      : low === null
        ? t('demo.insights.compare.place.upTo', { high })
        : t('demo.insights.compare.place.between', { low, high });
  const said =
    compare.kind === 'problem'
      ? t(compare.problem)
      : compare.kind === 'unmade'
        ? t('demo.insights.preview.failed')
        : t(`demo.insights.compare.${compare.kind}`);
  return (
    <InsightsScreen
      name="insights-compare"
      title={t('demo.insights.compare.title', words)}
      sub={sub}
      date={date}
      {...(compare.kind === 'ready' && { news: said })}
      onClose={onClose}
    >
      <Text
        testID={`insights-compare-${compare.kind}`}
        accessibilityLiveRegion="polite"
        style={compare.kind === 'ready' ? styles.hidden : [styles.note, align]}
      >
        {compare.kind === 'ready' ? '' : said}
      </Text>
      {compare.kind === 'problem' && (
        <Button
          testID="insights-compare-again"
          variant="line"
          label={t('demo.insights.sending.retry')}
          onPress={onAgain}
        />
      )}
      {compare.kind === 'ready' && (
        <>
          <View testID="insights-compare-here" style={styles.card}>
            <Text accessibilityRole="header" style={[styles.head, align]}>
              {t('demo.insights.compare.here.head')}
            </Text>
            <Text style={[styles.note, align]}>
              {t(`demo.insights.compare.here.${compare.scope}`, {
                ...words,
                classes: compare.figure.classes,
                teachers: compare.figure.teachers,
                schools: compare.figure.schools,
              })}
            </Text>
          </View>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.insights.compare.sessions.head')}
          </Text>
          <CompareTable className={className} rows={compare.comparison.rows} />
          <Text style={[styles.small, align]}>{t('demo.insights.compare.sessions.overNote')}</Text>
          {compare.scaled && (
            <Text testID="insights-compare-scaled" style={[styles.small, align]}>
              {t('demo.insights.compare.sessions.scaled')}
            </Text>
          )}
          {compare.comparison.changes.length > 0 && (
            <View testID="insights-compare-changes" style={styles.card}>
              <Text accessibilityRole="header" style={[styles.head, align]}>
                {t(`demo.insights.compare.changes.head.${compare.scope}`)}
              </Text>
              {compare.comparison.changes.map((one) => (
                <View key={`${one.list}-${one.item}`} accessible style={local.change}>
                  <Text style={[local.changeLine, styles.note, align]}>
                    {t(`demo.insights.compare.changes.${one.list}`, { item: one.title })}
                  </Text>
                  <Text style={[local.band, styles.small]}>{band(one.band)}</Text>
                </View>
              ))}
              <Text style={[styles.small, align]}>{t('demo.insights.compare.changes.basis')}</Text>
            </View>
          )}
          {compare.comparison.place !== null && (
            <View testID="insights-compare-place" style={styles.card}>
              <Text accessibilityRole="header" style={[styles.head, align]}>
                {t(`demo.insights.payload.reached.${term}`)}
              </Text>
              {(
                [
                  [className, placed(compare.comparison.place.mine)],
                  [t('demo.insights.compare.sessions.median'), placed(compare.comparison.place.median)],
                  [t('demo.insights.compare.place.middle'), middle(compare.comparison.place)],
                ] as const
              ).map(([label, value]) => (
                <View key={label} accessible style={local.place}>
                  <Text style={[styles.small, align]}>{label}</Text>
                  <Text style={[styles.note, align]}>{value}</Text>
                </View>
              ))}
              <Text style={[styles.small, align]}>
                {t('demo.insights.compare.place.basis', { classes: compare.figure.classes })}
              </Text>
            </View>
          )}
          <Text testID="insights-compare-note" style={[styles.small, align]}>
            {t('demo.insights.compare.note')}
          </Text>
        </>
      )}
    </InsightsScreen>
  );
}
