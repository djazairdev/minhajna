// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Ramadan on Today (#224, Today-ramadan, answers 318 to 320 and 336): a line
// under the day's name, «أول يوم من رمضان» and then «رمضان · اليوم 5 من 29»,
// and two cards from its first day until the teacher hides them: Ramadan's
// times with each of the teacher's levels' session length and its source,
// and «الحصة المختصرة تُحسب حصة واحدة» with its links. Hiding keeps the
// Ramadan and the lengths they showed, so new lengths or next year's Ramadan
// bring the cards back. A level with no length announced keeps its usual
// one, and says so; with none at all, no session is shortened, and the rule
// card does not show, so the notice has «إخفاء» of its own.

import { daysBetween, ramadanLength, type CalendarEntry, type TodayView } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { hideRamadan, useHiddenRamadan } from './ramadan-hidden';

type Translate = ReturnType<typeof useText>;

export interface RamadanOpen {
  /** Ramadan's entry in the calendar of the teacher's first school. */
  readonly calendar: (id: string, schoolId: string) => void;
  /** The documents, where the texts book is. */
  readonly book: () => void;
}

/** The day's Ramadan entry, or null. */
export function ramadanOf(view: TodayView): CalendarEntry | null {
  return view.marks.find((entry) => entry.times === 'ramadan') ?? null;
}

/** «أول يوم من رمضان», «رمضان · اليوم 5 من 29», or null outside Ramadan. */
export function ramadanLine(t: Translate, view: TodayView): string | null {
  const entry = ramadanOf(view);
  if (entry === null) return null;
  const day = daysBetween(entry.from, view.day) + 1;
  return day === 1
    ? t('ramadanToday.first')
    : t('ramadanToday.day', { day, days: daysBetween(entry.from, entry.to) + 1 });
}

/** Ramadan's line before the special day's, when both are. */
export function withRamadan(t: Translate, view: TodayView, special: string | null): string | null {
  return [ramadanLine(t, view), special].filter((one) => one !== null).join(' · ') || null;
}

/** The day's Ramadan, the teacher's levels' lengths, and the key the hidden cards keep; null once hidden. */
function useRamadan(view: TodayView) {
  const { state, profile, bells } = useAppData();
  const hidden = useHiddenRamadan();
  const entry = ramadanOf(view);
  if (entry === null) return null;
  const mine = new Set([...state.schools.values()].flatMap((school) => school.levels));
  const levels = profile.levels.filter((level) => mine.has(level.code));
  const lengths = levels.map((level) => ({ level, length: ramadanLength(bells, level.code, entry) }));
  const shown = `${entry.id}@${entry.from}:${lengths
    .map(({ level, length }) => `${level.code}=${length?.minutes}/${length?.confidence}`)
    .join(',')}`;
  return hidden === shown ? null : { entry, lengths, shown, school: [...state.schools.keys()][0] };
}

/** «مواقيت رمضان من اليوم»: each level's session length and source; «إخفاء» when no rule card shows. */
export function RamadanNotice({ view }: { view: TodayView }) {
  const t = useText();
  const { direction } = useLocale();
  const ramadan = useRamadan(view);
  if (ramadan === null) return null;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { lengths, shown } = ramadan;
  const sources = [...new Set(lengths.flatMap(({ length }) => (length === null ? [] : [length.source])))];
  return (
    <View testID="ramadan-notice" style={styles.card}>
      <View accessible style={styles.about}>
        <Text style={[styles.title, align]}>{t('ramadanToday.times')}</Text>
        {lengths.map(({ level, length }) => {
          const said =
            length === null
              ? t('calendarView.ramadanHours.none')
              : level.rollCallUnit === 'half-day'
                ? t('calendarView.ramadanHours.length', { minutes: length.minutes })
                : t('calendarView.ramadanHours.lengthFrom', { minutes: length.minutes, usual: level.sessionMinutes });
          return (
            <Text key={level.code} style={[styles.body, align]}>
              {lengths.length > 1 ? t('ramadanToday.level', { level: localized(level.name), said }) : said}
            </Text>
          );
        })}
        {sources.map((source) => (
          <Text key={source} style={[styles.note, align]}>
            {t('settings.source', { source: isolate(source) })}
          </Text>
        ))}
      </View>
      {lengths.every(({ length }) => length === null) && (
        <Button
          testID="ramadan-hide"
          variant="line"
          label={t('ramadanToday.hide')}
          onPress={() => hideRamadan(shown)}
        />
      )}
    </View>
  );
}

/** «الحصة المختصرة تُحسب حصة واحدة», its links, and «إخفاء» for both cards; none when no session is shortened. */
export function RamadanRule({ view, open }: { view: TodayView; open: RamadanOpen }) {
  const t = useText();
  const { direction } = useLocale();
  const ramadan = useRamadan(view);
  if (ramadan === null) return null;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { entry, school, shown, lengths } = ramadan;
  if (lengths.every(({ length }) => length === null)) return null;
  return (
    <View testID="ramadan-rule" style={styles.card}>
      <View accessible style={styles.about}>
        <Text style={[styles.title, align]}>{t('ramadanToday.rule')}</Text>
        <Text style={[styles.body, align]}>{t('ramadanToday.ruleNote')}</Text>
      </View>
      <RowLink
        testID="ramadan-book"
        icon={controlIcon('print')}
        title={t('ramadanToday.book')}
        description={t('ramadanToday.bookNote')}
        onPress={open.book}
      />
      {school !== undefined && (
        <RowLink
          testID="ramadan-calendar"
          icon={controlIcon('school')}
          title={t('ramadanToday.calendar')}
          description={t('ramadanToday.calendarNote')}
          onPress={() => open.calendar(entry.id, school)}
        />
      )}
      <Button testID="ramadan-hide" variant="line" label={t('ramadanToday.hide')} onPress={() => hideRamadan(shown)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-8'],
    paddingVertical: spacing['space-12'],
    paddingHorizontal: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  about: { gap: spacing['space-8'] },
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
