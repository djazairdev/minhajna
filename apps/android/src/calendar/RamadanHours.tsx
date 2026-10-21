// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Ramadan on its calendar entry (Calendar-ramadan board, answers 318 to
// 320): how sure the teacher's own level's times are, apart from its first
// day, and each level's session length with how sure it is, the teacher's
// levels first. A level with no length yet keeps its usual one, and says so.

import { ramadanLength, type CalendarEntry } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { localized } from '../setup/names';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';

export function RamadanHours({ entry }: { entry: CalendarEntry }) {
  const t = useText();
  const { direction } = useLocale();
  const { profile, bells, state } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const mine = new Set([...state.schools.values()].flatMap((school) => school.levels));
  const levels = [...profile.levels].sort((a, b) => Number(mine.has(b.code)) - Number(mine.has(a.code)));
  const first = levels.find((level) => mine.has(level.code) && ramadanLength(bells, level.code, entry) !== null);
  const times = first && ramadanLength(bells, first.code, entry)?.confidence;
  const badge = (key: 'times' | 'first', confidence: CalendarEntry['confidence']) => (
    <Badge
      testID={`ramadan-${key}`}
      label={t(`calendarView.ramadanHours.${key}`, { confidence: t(`settings.confidence.${confidence}`) })}
      variant={confidence === 'announced' ? 'done' : 'warning'}
    />
  );
  return (
    <View testID="ramadan-hours" style={styles.card}>
      {times !== undefined && badge('times', times)}
      {badge('first', entry.confidence)}
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('calendarView.ramadanHours.title')}
      </Text>
      {levels.map((level) => {
        const length = ramadanLength(bells, level.code, entry);
        const name = [
          localized(level.name),
          ...(mine.has(level.code) ? [t('settings.myLevel')] : []),
          ...(length === null ? [] : [t(`settings.confidence.${length.confidence}`)]),
        ].join(' · ');
        return (
          <View key={level.code} testID={`ramadan-length-${level.code}`}>
            <Text style={[styles.body, align]}>{name}</Text>
            <Text style={[styles.sub, align]}>
              {length === null
                ? t('calendarView.ramadanHours.none')
                : level.rollCallUnit === 'half-day'
                  ? t('calendarView.ramadanHours.length', { minutes: length.minutes })
                  : t('calendarView.ramadanHours.lengthFrom', {
                      minutes: length.minutes,
                      usual: level.sessionMinutes,
                    })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
