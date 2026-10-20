// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  CalendarView,
  formatDay,
  maxDay,
  minDay,
  setCalendarEntry,
  type CalendarEntry,
  type Parity,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { MonthDays } from '../extra/MonthDays';
import { SourceConfidence } from '../extra/SourceConfidence';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { PreviewActions } from './PreviewActions';
import { useCalendarPreview } from './useCalendarPreview';
import { calendarCatalogues } from './catalogues';

/** The school chooses its letter. A local entry records the teacher's source, not verified school authority. */
export function AbReset({
  schoolId,
  old,
  onSaved,
}: {
  schoolId: string;
  old?: CalendarEntry;
  onSaved: (entry: CalendarEntry) => void;
}) {
  const data = useAppData();
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const context = coreContext(data);
  const school = data.state.schools.get(schoolId)!;
  const [id] = useState(() => old?.id ?? data.newId());
  const [day, setDay] = useState(() => old?.from ?? minDay(maxDay(data.today(), data.year.from), data.year.to));
  const [month, setMonth] = useState(day.slice(0, 7));
  const [parity, setParity] = useState<Parity>(
    old === undefined ? (context.calendar.parityOn(day, school) ?? 'A') : old.effect === 'week-a' ? 'A' : 'B',
  );
  const [source, setSource] = useState(old?.source ?? '');
  const [confidence, setConfidence] = useState<'announced' | 'expected'>(
    old?.confidence === 'expected' ? 'expected' : 'announced',
  );
  const draft = useCalendarPreview(
    () =>
      setCalendarEntry(context, {
        ...old,
        id,
        layer: 'school',
        schoolId,
        from: day,
        to: day,
        effect: parity === 'A' ? 'week-a' : 'week-b',
        source,
        confidence,
        name:
          old?.name ??
          Object.fromEntries(
            Object.entries(calendarCatalogues).map(([language, text]) => [language, text.abEdit.name]),
          ),
      }),
    onSaved,
  );
  const weeks = context.calendar.teachingWeeks(school);
  const current = context.calendar.weekOf(data.today(), school);
  const preview =
    draft.shown === null
      ? null
      : new CalendarView(context.ref, [...data.state.calendar.filter((one) => one.id !== id), draft.shown.entry]);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {school.name}
      </Text>
      <Text style={[styles.body, align]}>
        {current === null
          ? t('calendarView.abEdit.noWeek', { day: formatDay(data.today()) })
          : t('calendarView.abEdit.current', {
              day: formatDay(current.start),
              letter: t(`calendarView.parity.${current.parity}`),
            })}
      </Text>
      <Notice icon={controlIcon('info')} message={t('calendarView.abEdit.notice')} />
      <MonthDays
        month={month}
        selected={day}
        first={data.year.from}
        last={data.year.to}
        profile={data.profile}
        onMonth={setMonth}
        onSelect={(next) => draft.change(() => setDay(next))}
        allows={(next) => context.calendar.weekOf(next, school) !== null}
      />
      <ChipGroup
        testID="calendar-reset-letter"
        label={t('calendarView.abEdit.letter')}
        selected={parity}
        choices={(['A', 'B'] as const).map((value) => ({ value, label: t(`calendarView.parity.${value}`) }))}
        onSelect={(next) => draft.change(() => setParity(next))}
      />
      <SourceConfidence
        testID="calendar"
        source={source}
        confidence={confidence}
        busy={draft.busy}
        onSource={(next) => draft.change(() => setSource(next))}
        onConfidence={(next) => draft.change(() => setConfidence(next))}
      />
      <Text style={[styles.sub, align]}>{t('calendarView.abEdit.rules')}</Text>
      {preview !== null && (
        <Text style={[styles.body, align]}>
          {t('calendarView.abEdit.changed', {
            count: weeks.filter((week) => preview.weekOf(week.start, school)?.parity !== week.parity).length,
          })}
        </Text>
      )}
      {weeks.map((week) => (
        <Text key={week.start} style={[styles.body, align]}>
          {t('calendarView.abEdit.week', {
            day: formatDay(week.start),
            before: t(`calendarView.parity.${week.parity}`),
            after: t(`calendarView.parity.${preview?.weekOf(week.start, school)?.parity ?? week.parity}`),
          })}
        </Text>
      ))}
      <PreviewActions draft={draft} />
    </ScrollView>
  );
}
