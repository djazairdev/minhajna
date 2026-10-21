// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Settings-times (#29): each slot's time at the school, never part of the
// timetable (PRD §4.6). Today's times, usual or Ramadan's as the calendar
// says, and when Ramadan's start; the level and shift the times follow; and
// a table of the slots, usual or Ramadan's. Tapping a slot sets its time to
// match the school's bell, saved at once on the school. Ramadan keeps each
// session's place and start, shortened to the level's length.

import {
  bellTimes,
  formatDay,
  formatDayWithMonth,
  hoursOn,
  nextRamadan,
  ramadanLength,
  templateFor,
  weekday,
  weekGrid,
  withSlotTime,
  type Day,
  type Hours,
  type Slot,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { colors, radius, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { gridLabels, isolate } from '../week/grid-labels';
import { TimeTable } from './TimeTable';
import { TimeSheet } from './TimeSheet';
import { calendarEntries, levelOf, shiftOf, timesSchools } from './times-rules';

/** The screen. */
export function Times({ schoolId: initialSchoolId }: { schoolId?: string } = {}) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, calendar, bells, today, record } = useAppData();
  const schools = timesSchools(state);
  const [schoolId, setSchoolId] = useState(initialSchoolId ?? schools[0]?.id ?? '');
  const school = state.schools.get(schoolId) ?? schools[0];
  const day = today();
  const entries = calendarEntries({ calendar, state });
  const [hours, setHours] = useState<Hours>(() => hoursOn(entries, day));
  const [open, setOpen] = useState<Slot | null>(null);
  const ramadan = nextRamadan(entries, day);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  if (school === undefined) return <View style={styles.screen} />;

  const level = levelOf(school);
  const shift = shiftOf(state);
  const levelName = profile.levels.find((candidate) => candidate.code === level);
  const labels = gridLabels(t, weekGrid(profile, state.timetables.at(-1)?.version.options));
  const times = bellTimes(
    bells,
    school,
    level ?? '',
    shift,
    hours,
    labels.slots.map((slot) => slot.slot),
    ramadan,
  );
  const length = level === undefined ? null : ramadanLength(bells, level, ramadan);
  const now = hoursOn(entries, day);
  const named = (on: Day) => `${t(`week.days.${weekday(on)}`)} ${formatDayWithMonth(on, currentLanguage(), profile)}`;
  const ramadanNote =
    ramadan === null
      ? null
      : now === 'ramadan'
        ? t('times.ramadanToday', { date: named(ramadan.to) })
        : t(ramadan.confidence === 'expected' ? 'times.ramadanExpected' : 'times.ramadanAnnounced', {
            date: named(ramadan.from),
          });
  const mark = (of: Hours) =>
    now === of
      ? t('times.todayMark', { hours: t(`times.${of}`) })
      : of === 'ramadan' && ramadan?.confidence === 'expected'
        ? t('times.expectedMark', { hours: t(`times.${of}`) })
        : t(`times.${of}`);
  const source =
    level !== undefined && templateFor(bells, level, shift) !== null && levelName !== undefined
      ? t('times.template', { level: localized(levelName.name) })
      : t('times.noTemplate');
  const rules = [
    length === null ? t('times.noRamadan') : t('times.ramadanRule', { minutes: length.minutes }),
    t('times.rules.book'),
    t('times.rules.week'),
    t('times.rules.past'),
  ];
  const openTime =
    open && times[labels.slots.findIndex((row) => row.slot.half === open.half && row.slot.index === open.index)];
  const openLabel = open && labels.slots.find((row) => row.slot.half === open.half && row.slot.index === open.index);

  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView
        contentContainerStyle={[styles.content, sides, { paddingBottom: insets.bottom + spacing['space-16'] }]}
      >
        <View testID="times-today" style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={[styles.title, align]}>
              {t('times.today', { day: t(`week.days.${weekday(day)}`), date: formatDay(day) })}
            </Text>
            <Text style={styles.badge}>{t(now === 'ramadan' ? 'times.ramadanNow' : 'times.usualNow')}</Text>
          </View>
          {ramadanNote !== null && <Text style={[styles.body, align]}>{ramadanNote}</Text>}
        </View>
        <Text style={[styles.sub, align]}>{t('times.intro')}</Text>
        {schools.length > 1 && (
          <ChipGroup
            testID="times-school"
            label={t('times.school')}
            choices={schools.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            selected={school.id}
            onSelect={setSchoolId}
          />
        )}
        <View style={styles.card}>
          <Row
            label={t('times.level')}
            value={levelName ? localized(levelName.name) : ''}
            from={t('times.levelFrom')}
            direction={direction}
          />
          <Row label={t('times.shift')} value={t(`times.${shift}`)} from={t('times.shiftFrom')} direction={direction} />
        </View>
        <ChipGroup
          testID="times-hours"
          label={t('times.hours')}
          choices={(['usual', 'ramadan'] as const).map((value) => ({ value, label: mark(value) }))}
          selected={hours}
          onSelect={setHours}
        />
        <TimeTable labels={labels} times={times} onOpen={setOpen} />
        <Text testID="times-source" style={[styles.sub, align]}>
          {source}
        </Text>
        <View style={styles.rules}>
          {rules.map((rule) => (
            <View key={rule} style={styles.rule}>
              <View style={styles.dot} />
              <Text style={[styles.body, styles.ruleText, align]}>{rule}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <TimeSheet
        open={open && { slot: open, time: openTime ?? null }}
        title={
          openLabel
            ? t('times.sheetTitle', {
                slot: openLabel.spoken,
                hours: t(hours === 'usual' ? 'times.usualNow' : 'times.ramadanNow'),
              })
            : ''
        }
        onClose={() => setOpen(null)}
        onSave={(slot, span) => {
          record({ kind: 'school.set', school: withSlotTime(school, hours, slot, span) });
          setOpen(null);
        }}
      />
    </View>
  );
}

/** What the times follow, and where the teacher changes it. */
function Row({
  label,
  value,
  from,
  direction,
}: {
  label: string;
  value: string;
  from: string;
  direction: 'rtl' | 'ltr';
}) {
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.label, align]}>{label}</Text>
        <Text style={[styles.body, align]}>{isolate(value)}</Text>
      </View>
      <Text style={styles.from}>{from}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, gap: spacing['space-16'], paddingTop: spacing['space-8'] },
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-8'] },
  title: { ...typography.label, color: colors.ink, flexGrow: 1 },
  badge: {
    ...typography.badge,
    color: colors.ink,
    backgroundColor: colors.soft,
    borderRadius: radius['radius-badge'],
    paddingHorizontal: spacing['space-8'],
    paddingVertical: spacing['space-4'],
  },
  body: { ...typography.body, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
  label: { ...typography.label, color: colors.ink2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing['space-8'] },
  rowText: { flexGrow: 1, flexShrink: 1, gap: spacing['space-4'] },
  from: { ...typography.caption, color: colors.ink2 },
  rule: { flexDirection: 'row', alignItems: 'baseline', gap: spacing['space-8'] },
  ruleText: { flex: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink2, marginBottom: 2 },
  rules: {
    gap: spacing['space-8'],
    padding: spacing['space-14'],
    borderRadius: radius['radius-card'],
    backgroundColor: colors.soft,
  },
});
