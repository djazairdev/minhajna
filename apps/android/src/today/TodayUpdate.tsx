// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today's card for a calendar update applied today (Calendar-update-today
// board, answer 311): the entries that concern the teacher and the sessions
// the update took or gave back, with «ما تغيّر» and «إخفاء», which hides it
// on this phone, with any applied before it that day. It shows only on the
// day an update is applied, and only for one that concerns the teacher
// (answer 315): the latest of the day that is not hidden.

import { formatDay, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { hideUpdate, useHiddenUpdate } from '../calendar/update-hidden';
import { appliedChanges, type AppliedChanges } from '../calendar/useAppliedChanges';
import { localized } from '../setup/names';
import { useAppData, type AppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

/** The latest update applied on `day` that concerns the teacher, after the one whose card was hidden. */
export function todayChanges(data: AppData, day: Day, hidden: string | null): AppliedChanges | null {
  const releases = [...data.state.calendarUpdatedOn].filter(([, on]) => on === day).map(([release]) => release);
  const shown = releases.slice((hidden === null ? -1 : releases.indexOf(hidden)) + 1);
  for (const release of shown.reverse()) {
    const changes = appliedChanges(data, release);
    if (changes !== null && changes.laid && changes.mine.length > 0) return changes;
  }
  return null;
}

export function TodayUpdate({ day, open }: { day: Day; open: (release: string) => void }) {
  const data = useAppData();
  const t = useText();
  const { direction } = useLocale();
  const hidden = useHiddenUpdate();
  const changes = useMemo(() => todayChanges(data, day, hidden), [data, day, hidden]);
  if (changes === null) return null;
  const release = changes.applied.update.release;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const count = (taken: boolean) =>
    changes.impact.changes.filter(
      ({ before, after }) =>
        before !== null && after !== null && (before.calendar == null) === taken && (after.calendar == null) !== taken,
    ).length;
  const [taken, given] = [count(true), count(false)];
  const counts = [
    ...(taken > 0 ? [t('calendarView.update.today.taken', { count: taken })] : []),
    ...(given > 0 ? [t('calendarView.update.today.given', { count: given })] : []),
  ];
  return (
    <View testID="today-update" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('calendarView.update.today.title')}
      </Text>
      {changes.mine.map((change) => (
        <Text key={`${change.kind}-${change.entry.id}`} style={[styles.body, align]}>
          {[
            `${t(`calendarView.update.kinds.${change.kind}`)} · ${localized(change.entry.name)}`,
            t('calendarView.range', { from: formatDay(change.entry.from), to: formatDay(change.entry.to) }),
            t('settings.source', { source: isolate(change.entry.source) }),
          ].join(' · ')}
        </Text>
      ))}
      <Text testID="today-update-taken" style={[styles.note, align]}>
        {counts.length > 0 ? counts.join(' ') : t('calendarView.update.today.none')}
      </Text>
      <Button testID="today-update-open" label={t('calendarView.update.today.open')} onPress={() => open(release)} />
      <Button
        testID="today-update-hide"
        variant="line"
        label={t('calendarView.update.today.hide')}
        onPress={() => hideUpdate(release)}
      />
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
  title: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
