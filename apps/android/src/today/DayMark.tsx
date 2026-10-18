// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A holiday, a closure or an exam week on Today (#36, Today-holiday and
// Today-exams): the day's name in chalk on the board; the sessions it took,
// counted apart so a holiday never reads as slow teaching (PRD §3.9, §4.7);
// in an exam week, that the plan pauses and no session counts as not held
// (PRD §3.3); and the next session the calendar leaves to teach. A make-up,
// support or revision day (#219) names the weekday whose timetable it
// follows, and takes the place of a holiday's mark: its make-up sessions
// are held as any other, while support and revision sessions show only there.

import { eachDay, weekday, type CalendarEntry, type CountryProfile, type Day, type TodayView } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { useText, type Language } from '../text/i18n';

type Translate = ReturnType<typeof useText>;

/**
 * The entry that marks the whole day: a day that adds sessions unless the
 * day is closed, then a holiday, then a closure, then an exam.
 */
export function dayMarkOf(view: TodayView): CalendarEntry | null {
  const find = (effect: CalendarEntry['effect']) => view.marks.find((mark) => mark.effect === effect);
  const closure = find('closure');
  return (
    (closure === undefined ? find('adds-sessions') : undefined) ?? find('no-school') ?? closure ?? find('exam') ?? null
  );
}

/** «2 نوفمبر», without the year. */
export function dayAndMonth(day: Day, language: Language, profile: Pick<CountryProfile, 'months'>): string {
  const month = profile.months?.[Number(day.slice(5, 7)) - 1]?.[language] ?? day.slice(5, 7);
  return `${Number(day.slice(8, 10))} ${month}`;
}

/** Which of the window's working days this is, or null on a day off. */
export function examDay(
  entry: CalendarEntry,
  day: Day,
  profile: Pick<CountryProfile, 'workingDays'>,
): { day: number; days: number } | null {
  const working = eachDay(entry.from, entry.to).filter((one) => profile.workingDays.includes(weekday(one)));
  const index = working.indexOf(day);
  return index < 0 ? null : { day: index + 1, days: working.length };
}

/** «الإثنين 2 نوفمبر». */
export function dayName(t: Translate, day: Day, language: Language, profile: Pick<CountryProfile, 'months'>): string {
  return `${t(`week.days.${weekday(day)}`)} ${dayAndMonth(day, language, profile)}`;
}

/** What the banner says under the day's name. */
export function markLine(
  t: Translate,
  entry: CalendarEntry,
  day: Day,
  language: Language,
  profile: Pick<CountryProfile, 'months' | 'workingDays'>,
): string {
  if (entry.effect === 'no-school')
    return t(entry.layer === 'national' ? 'daymark.holidayNational' : 'daymark.holiday');
  if (entry.effect === 'closure') return t('daymark.closure');
  if (entry.effect === 'adds-sessions') {
    const kind = entry.adds === 'make-up' ? 'makeUp' : (entry.adds ?? 'support');
    return t(`daymark.${kind}`, { weekday: t(`week.days.${entry.follows ?? weekday(day)}`) });
  }
  const span = { from: dayAndMonth(entry.from, language, profile), to: dayAndMonth(entry.to, language, profile) };
  const which = examDay(entry, day, profile);
  return which === null ? t('daymark.examOff', span) : t('daymark.exam', { ...span, ...which });
}

export interface DayBannerProps {
  readonly entry: CalendarEntry;
  /** Such as «عطلة وطنية، لا حصص اليوم.», or the exam window's days. */
  readonly line: string;
}

export function DayBanner({ entry, line }: DayBannerProps) {
  const name = localized(entry.name);
  return (
    <View testID="day-mark" accessible accessibilityLabel={`${name}. ${line}`} style={styles.banner}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.line}>{line}</Text>
    </View>
  );
}

/** A card with a title and a note, for the sessions lost and the plan's pause. */
export function DayNote({ testID, title, note }: { testID: string; title: string; note: string }) {
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID={testID} accessible style={styles.card}>
      <Text style={[styles.title, align]}>{title}</Text>
      <Text style={[styles.note, align]}>{note}</Text>
    </View>
  );
}

/** The next session the calendar leaves to teach: the class, the time and the day. */
export function NextSession({ line }: { line: string }) {
  const { direction } = useLocale();
  const t = useText();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID="day-next" accessible style={styles.card}>
      <Text style={[styles.label, align]}>{t('daymark.next')}</Text>
      <Text style={[styles.body, align]}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    gap: spacing['space-8'],
    paddingVertical: spacing['space-24'],
    paddingHorizontal: spacing['space-16'],
    borderRadius: radius['radius-card'],
    backgroundColor: colors.board,
  },
  name: { ...typography.day, lineHeight: undefined, color: colors.chalk, textAlign: 'center', alignSelf: 'stretch' },
  line: { ...typography.body, color: colors['chalk-82'], textAlign: 'center', alignSelf: 'stretch' },
  card: {
    gap: spacing['space-8'],
    paddingVertical: spacing['space-12'],
    paddingHorizontal: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  title: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
