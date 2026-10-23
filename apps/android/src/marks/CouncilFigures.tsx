// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The figures of «ملف مجلس القسم» (#244, Council, answer 470): six tiles,
// each read as its figure then its label: the class average, the highest and
// lowest averages, the standard deviation, how many reach 10, or 5 in primary,
// with its share, and the term's attendance; the note that thresholds and
// ranks compare the full value, with any pupil shown at the threshold who does
// not reach it; the bands as bars, each read as its bounds and count, the
// count always written so colour is never the only sign; and boys and girls,
// each row read as one line.

import type { CouncilPack } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { atThresholdLines } from './book-rules';
import { bandLabel, share, shown } from './council-rules';

export type CouncilFiguresProps = {
  readonly pack: CouncilPack;
  readonly nameOf: (pupilId: string) => string;
};

export function CouncilFigures({ pack, nameOf }: CouncilFiguresProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { threshold } = pack.book;
  const rate = pack.attendance?.rate ?? null;
  const tiles = [
    { id: 'mean', value: shown(pack.mean), label: t('marks.council.mean') },
    { id: 'highest', value: shown(pack.highest), label: t('marks.council.highest') },
    { id: 'lowest', value: shown(pack.lowest), label: t('marks.council.lowest') },
    { id: 'deviation', value: shown(pack.deviation), label: t('marks.council.deviation') },
    {
      id: 'reached',
      value: share(pack.reached, pack.counted),
      label: t('marks.council.reached', { threshold, reached: pack.reached, counted: pack.counted }),
    },
    { id: 'rate', value: rate === null ? '—' : share(rate, 1), label: t('marks.council.attendanceRate') },
  ];
  const most = Math.max(1, ...pack.bands.map((band) => band.count));
  const sexes = pack.sexes.map((one) => ({
    ...one,
    name: t(one.sex === 'm' ? 'marks.council.boys' : 'marks.council.girls'),
  }));
  return (
    <View style={styles.group}>
      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View
            key={tile.id}
            testID={`council-${tile.id}`}
            accessible
            accessibilityLabel={`${tile.value} ${tile.label}`}
            style={styles.tile}
          >
            <Text style={[styles.stat, align]}>{tile.value}</Text>
            <Text style={[styles.note, align]}>{tile.label}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.note, align]}>{t('marks.council.fullNote')}</Text>
      {atThresholdLines(t, pack.book, nameOf).map((line) => (
        <Text key={line} testID="council-at-threshold" style={[styles.body, align]}>
          {line}
        </Text>
      ))}
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('marks.council.bands')}
      </Text>
      {pack.bands.map((band) => {
        const label = bandLabel(t, band);
        return (
          <View
            key={band.from}
            testID={`council-band-${band.from}`}
            accessible
            accessibilityLabel={t('marks.council.bandLine', { band: label, count: band.count })}
            style={styles.band}
          >
            <Text style={[styles.body, styles.bandLabel, align]}>{label}</Text>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${(band.count / most) * 100}%` }]} />
            </View>
            <Text style={[styles.count, align]}>{band.count}</Text>
          </View>
        );
      })}
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('marks.council.sexes')}
      </Text>
      <View style={styles.table}>
        <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text style={[styles.note, styles.name]} />
          <Text style={[styles.note, styles.cell]}>{t('marks.council.count')}</Text>
          <Text style={[styles.note, styles.cell]}>{t('marks.council.atLeast', { threshold })}</Text>
          <Text style={[styles.note, styles.cell]}>{t('marks.council.average')}</Text>
        </View>
        {sexes.map((one) => (
          <View
            key={one.sex}
            testID={`council-sex-${one.sex}`}
            accessible
            accessibilityLabel={t('marks.council.sexLine', {
              sex: one.name,
              counted: one.counted,
              threshold,
              reached: one.reached,
              mean: shown(one.mean),
            })}
            style={styles.row}
          >
            <Text style={[styles.body, styles.name, align]}>{one.name}</Text>
            <Text style={[styles.value, styles.cell]}>{one.counted}</Text>
            <Text style={[styles.value, styles.cell]}>{one.reached}</Text>
            <Text style={[styles.value, styles.cell]}>{shown(one.mean)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-10'] },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 96,
    gap: spacing['space-2'],
    padding: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  band: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'], minHeight: 32 },
  bandLabel: { width: 104 },
  track: { flex: 1, height: 12, borderRadius: radius['radius-tag'], backgroundColor: colors.line, overflow: 'hidden' },
  bar: { height: 12, borderRadius: radius['radius-tag'], backgroundColor: colors.ink },
  count: { ...typography.label, color: colors.ink, minWidth: 28 },
  table: { borderWidth: 1, borderColor: colors.line, borderRadius: radius['radius-card'], overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing['space-12'],
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  name: { flex: 1.4 },
  cell: { flex: 1, textAlign: 'center' },
  stat: { ...typography.stat, color: colors.ink },
  value: { ...typography.label, color: colors.ink },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
