// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Seminars, duties and school events on Today (#224, Today-special,
// R-3.3-05, answer 335): a line under the day's name says what makes the day
// special, then each has a card with its kind, its part of the day and its
// school, and where the journal writes it: a school's or a wilaya's event,
// as the journal's page for seminars takes them. A seminar or a duty takes only
// the sessions of its part of the day, which show with its name; a school
// event takes none. A holiday, a closure or an exam week keeps its banner,
// and Ramadan has a card of its own.

import type { CalendarEntry, State, TodayView } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { entryKind } from '../calendar/edit-draft';
import { Badge } from '../components/Badge';
import { colors, radius, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { currentLanguage, useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

type Translate = ReturnType<typeof useText>;

type Special = 'training' | 'duty' | 'event';

function specialOf(entry: CalendarEntry): Special | null {
  if (entry.layer === 'teacher' && entry.effect === 'closure') return entryKind(entry) === 'duty' ? 'duty' : 'training';
  const local = entry.layer === 'school' || entry.layer === 'zone';
  return local && entry.effect === 'marker' && entry.times === undefined ? 'event' : null;
}

/** The day's seminars, duties and school events, in the order the calendar gives them. */
export function specialEntries(view: TodayView): CalendarEntry[] {
  return view.marks.filter((entry) => specialOf(entry) !== null);
}

/** How many of the day's sessions its seminars and duties took, counted apart as any calendar cause. */
export function specialLost(view: TodayView, entries: readonly CalendarEntry[]): number {
  const ids = new Set(entries.map((entry) => entry.id));
  return view.sessions.filter((item) => item.status === 'calendar' && ids.has(item.session.calendarEntry ?? '')).length;
}

/** «يوم خاص: ندوة تربوية · المساء», or null on an ordinary day. */
export function specialLine(t: Translate, entries: readonly CalendarEntry[]): string | null {
  if (entries.length === 0) return null;
  const what = entries.map((entry) =>
    [
      isolate(localized(entry.name)),
      ...(entry.half === undefined ? [] : [t(`calendarView.periods.${entry.half}`)]),
    ].join(' · '),
  );
  return t('special.line', { what: what.join(currentLanguage() === 'ar' ? '، ' : ', ') });
}

export function SpecialCards({ entries, state }: { entries: readonly CalendarEntry[]; state: State }) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return entries.map((entry) => {
    const kind = specialOf(entry) ?? 'event';
    const school = entry.schoolId === undefined ? undefined : state.schools.get(entry.schoolId)?.name;
    const meta = [t(`calendarView.periods.${entry.half ?? 'all'}`), ...(school === undefined ? [] : [school])];
    return (
      <View key={entry.id} testID={`special-${entry.id}`} accessible style={styles.card}>
        <View style={[styles.meta, { direction }]}>
          <Badge label={t(`special.kinds.${kind}`)} />
          <Text style={[styles.sub, align]}>{meta.join(' · ')}</Text>
        </View>
        <Text style={[styles.body, align]}>{t(`special.notes.${kind}`, { name: localized(entry.name) })}</Text>
      </View>
    );
  });
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-8'] },
  sub: { ...typography.caption, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
});
