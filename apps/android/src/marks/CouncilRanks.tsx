// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The comparison and ranks of «ملف مجلس القسم» (#244, Council, Council-t2,
// answer 470): from term 2, the class average and how many reach the threshold,
// with its share, in the previous term and this one, each with its trend shown
// as an arrow and read in words, or why there is nothing to compare; then every
// pupil with an average by rank, equal values sharing one, with their average
// and, from term 2, their previous rank and its change, shown as an arrow and
// read in words, each row as one line.

import type { CouncilPack } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { rankChange, share, shown, trend } from './council-rules';
import { termWord } from './marks-rules';

export type CouncilRanksProps = {
  readonly pack: CouncilPack;
  readonly term: number;
  readonly nameOf: (pupilId: string) => string;
};

export function CouncilRanks({ pack, term, nameOf }: CouncilRanksProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { threshold } = pack.book;
  const { previous } = pack;
  const earlier = termWord(t, term - 1);
  const later = term > 1;
  const rate = (reached: number, counted: number) => (counted === 0 ? null : reached / counted);
  const comparison =
    !later || previous === null
      ? null
      : [
          {
            text: t('marks.council.compareMean', { from: shown(previous.mean), to: shown(pack.mean) }),
            ...trend(t, previous.mean, pack.mean),
          },
          {
            text: t('marks.council.compareReached', {
              threshold,
              fromCount: previous.reached,
              fromTotal: previous.counted,
              fromShare: share(previous.reached, previous.counted),
              toCount: pack.reached,
              toTotal: pack.counted,
              toShare: share(pack.reached, pack.counted),
            }),
            ...trend(t, rate(previous.reached, previous.counted), rate(pack.reached, pack.counted)),
          },
        ];
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {later ? t('marks.council.compareTitle', { term: earlier }) : t('marks.council.compareTitleFirst')}
      </Text>
      {!later && <Text style={[styles.body, align]}>{t('marks.council.noCompareFirst')}</Text>}
      {later && previous === null && (
        <Text style={[styles.body, align]}>{t('marks.council.noComparePrevious', { term: earlier })}</Text>
      )}
      {comparison !== null && (
        <View
          testID="council-compare"
          accessible
          accessibilityLabel={comparison.map((line) => `${line.text} ${line.spoken}`.trim()).join('. ')}
          style={styles.card}
        >
          {comparison.map((line) => (
            <Text key={line.text} style={[styles.body, align]}>
              {`${line.text} ${line.shown}`.trim()}
            </Text>
          ))}
        </View>
      )}
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('marks.council.ranks')}
      </Text>
      {pack.ranks.length === 0 && <Text style={[styles.body, align]}>{t('marks.council.noRanks')}</Text>}
      {pack.ranks.map((row) => {
        const name = isolate(nameOf(row.pupilId));
        const change = rankChange(t, row);
        const head = t('marks.council.rankLine', { rank: row.rank, name });
        const before = t('marks.council.previous', { rank: row.previous ?? '—' });
        const spoken = (later ? [head, shown(row.average), before, change.spoken] : [head, shown(row.average)]).join(
          t('marks.book.comma'),
        );
        return (
          <View
            key={row.pupilId}
            testID={`council-rank-${row.pupilId}`}
            accessible
            accessibilityLabel={spoken}
            style={styles.row}
          >
            <Text style={[styles.body, styles.grow, align]}>{head}</Text>
            <Text style={styles.value}>{shown(row.average)}</Text>
            {later && <Text style={[styles.note, styles.change]}>{`${before} · ${change.shown}`}</Text>}
          </View>
        );
      })}
      {later && <Text style={[styles.note, align]}>{t('marks.council.rankNote')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-8'] },
  card: {
    gap: spacing['space-4'],
    padding: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing['space-8'],
    minHeight: 48,
    paddingHorizontal: spacing['space-12'],
    paddingVertical: spacing['space-6'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
  },
  grow: { flex: 1 },
  change: { minWidth: 88 },
  value: { ...typography.label, color: colors.ink },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
