// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The entries an update adds, changes or takes out for the teacher's own
// schools and classes, each with its dates and, for one it moves, the dates
// it had and why, and Ramadan's announced lengths; the entries for others
// are only counted (answer 310).

import { canonicalJson, formatDay, type Day, type RamadanHours, type UpdateChange } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { localized } from '../setup/names';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

export function UpdateChangeList({ mine, others }: { mine: readonly UpdateChange[]; others: number }) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { profile } = useAppData();
  const range = (from: Day, to: Day) => t('calendarView.range', { from: formatDay(from), to: formatDay(to) });
  const lengths = (hours: RamadanHours) =>
    hours.lengths
      .map((one) => {
        const level = profile.levels.find((candidate) => candidate.code === one.level);
        return `${level === undefined ? one.level : localized(level.name)} ${t('settings.minutes', { count: one.minutes })}`;
      })
      .join(currentLanguage() === 'ar' ? '، ' : ', ');
  const newHours = (change: UpdateChange) =>
    change.entry.hours !== undefined &&
    (change.before?.hours === undefined || canonicalJson(change.before.hours) !== canonicalJson(change.entry.hours));
  return (
    <>
      {mine.length === 0 && <Text style={[styles.body, align]}>{t('calendarView.update.none')}</Text>}
      {mine.map((change) => (
        <View key={`${change.kind}-${change.entry.id}`} testID={`update-change-${change.entry.id}`}>
          <Text style={[styles.body, align]}>
            {`${t(`calendarView.update.kinds.${change.kind}`)} · ${localized(change.entry.name)}`}
          </Text>
          <Text style={[styles.body, align]}>{range(change.entry.from, change.entry.to)}</Text>
          {change.kind !== 'removed' && change.entry.moved !== undefined && (
            <Text style={[styles.body, align]}>
              {t('calendarView.update.moved', {
                range: range(change.entry.moved.from, change.entry.moved.to),
                reason: isolate(change.entry.moved.reason),
              })}
            </Text>
          )}
          {change.kind !== 'removed' && change.entry.hours !== undefined && newHours(change) && (
            <Text testID={`update-hours-${change.entry.id}`} style={[styles.body, align]}>
              {t('calendarView.update.hours', {
                confidence: t(`settings.confidence.${change.entry.hours.confidence}`),
                lengths: lengths(change.entry.hours),
              })}
            </Text>
          )}
          {change.kind !== 'removed' && change.entry.hours === undefined && change.before?.hours !== undefined && (
            <Text testID={`update-hours-${change.entry.id}`} style={[styles.body, align]}>
              {t('calendarView.update.hoursDropped')}
            </Text>
          )}
          {change.kind !== 'removed' && (
            <Text style={[styles.sub, align]}>{t('settings.source', { source: isolate(change.entry.source) })}</Text>
          )}
        </View>
      ))}
      {others > 0 && (
        <Text testID="update-others" style={[styles.body, align]}>
          {t('calendarView.update.others', { count: others })}
        </Text>
      )}
    </>
  );
}
