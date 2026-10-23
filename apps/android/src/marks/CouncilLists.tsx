// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The lists of «ملف مجلس القسم» (#244, Council, R-3.7-16, answer 470): the
// pupils who may need remediation, below the first threshold, and those in line
// for a distinction, at or above the second, each in list order with their
// average and read as one line, under a badge naming the threshold; «تغيير»
// opens the two thresholds on the book's scale, refused unless each has at most
// two decimals, lies within the scale and the first is below the second, kept
// for every class at once, or put back to 8 and 15 on 20; a choice that changes
// nothing adds no record. The note says the thresholds are the teacher's, since
// none are official.

import {
  DEFAULT_THRESHOLDS,
  setThresholds,
  thresholdsOf,
  type CouncilPack,
  type CouncilRank,
  type CouncilThresholds,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { sameThresholds, shown, thresholdWords, typedThresholds } from './council-rules';

export type CouncilListsProps = {
  readonly pack: CouncilPack;
  readonly nameOf: (pupilId: string) => string;
};

export function CouncilLists({ pack, nameOf }: CouncilListsProps) {
  const t = useText();
  const { direction } = useLocale();
  const { record, state } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const words = thresholdWords(pack.thresholds);
  const [editing, setEditing] = useState(false);
  const [low, setLow] = useState(words.remedial);
  const [high, setHigh] = useState(words.distinction);
  const [tried, setTried] = useState(false);
  const { scale } = pack.book;
  const typed = typedThresholds(low, high, scale);
  const open = () => {
    setLow(words.remedial);
    setHigh(words.distinction);
    setTried(false);
    setEditing(true);
  };
  const save = (chosen: CouncilThresholds) => {
    if (!sameThresholds(chosen, thresholdsOf(state))) record(setThresholds(chosen));
    setEditing(false);
  };
  const keep = () => {
    setTried(true);
    if ('thresholds' in typed) save(typed.thresholds);
  };
  const list = (id: string, title: string, badge: string, rows: readonly CouncilRank[]) => (
    <View testID={`council-${id}`} style={styles.group}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[styles.title, styles.grow, align]}>
          {title}
        </Text>
        <Badge label={badge} />
      </View>
      {rows.length === 0 && <Text style={[styles.note, align]}>{t('marks.council.noneListed')}</Text>}
      {rows.map((row) => (
        <View
          key={row.pupilId}
          testID={`council-${id}-${row.pupilId}`}
          accessible
          accessibilityLabel={`${isolate(nameOf(row.pupilId))}${t('marks.book.comma')}${shown(row.average)}`}
          style={styles.row}
        >
          <Text style={[styles.body, styles.grow, align]}>{isolate(nameOf(row.pupilId))}</Text>
          <Text style={styles.value}>{shown(row.average)}</Text>
        </View>
      ))}
    </View>
  );
  return (
    <View style={styles.group}>
      {list('remedial', t('marks.council.remedial'), t('marks.council.below', { to: words.remedial }), pack.remedial)}
      {list(
        'distinction',
        t('marks.council.distinction'),
        t('marks.council.andAbove', { from: words.distinction }),
        pack.distinction,
      )}
      <Text style={[styles.note, align]}>{t('marks.council.thresholdsNote')}</Text>
      {!editing && (
        <Button testID="council-thresholds" variant="line" label={t('marks.council.change')} onPress={open} />
      )}
      {editing && (
        <View testID="council-thresholds-edit" style={styles.edit}>
          <TextField
            testID="council-remedial-field"
            label={t('marks.council.remedialField', { scale })}
            placeholder={words.remedial}
            value={low}
            onChangeText={setLow}
            keyboardType="decimal-pad"
            textDirection="ltr"
            maxLength={5}
          />
          <TextField
            testID="council-distinction-field"
            label={t('marks.council.distinctionField', { scale })}
            placeholder={words.distinction}
            value={high}
            onChangeText={setHigh}
            keyboardType="decimal-pad"
            textDirection="ltr"
            maxLength={5}
            error={tried && !('thresholds' in typed) ? t('marks.council.thresholdsRule', { scale }) : undefined}
          />
          <Text style={[styles.note, align]}>{t('marks.council.thresholdsAll')}</Text>
          <Button testID="council-thresholds-keep" label={t('marks.council.keep')} onPress={keep} />
          <Button
            testID="council-thresholds-default"
            variant="line"
            label={t('marks.council.toDefault')}
            onPress={() => save(DEFAULT_THRESHOLDS)}
          />
          <Button
            testID="council-thresholds-cancel"
            variant="plain"
            label={t('marks.council.cancel')}
            onPress={() => setEditing(false)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-8'] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  grow: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-8'],
    minHeight: 48,
    paddingHorizontal: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
  },
  edit: {
    gap: spacing['space-10'],
    padding: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  value: { ...typography.label, color: colors.ink },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
