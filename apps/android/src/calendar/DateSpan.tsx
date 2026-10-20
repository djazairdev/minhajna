// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { formatDay, type Day } from '@minhajna/core';
import { useState } from 'react';
import { Text } from 'react-native';
import { SegmentedControl } from '../components/SegmentedControl';
import { MonthDays } from '../extra/MonthDays';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { settingsStyles } from '../settings/styles';

/** One date picker for both ends of a whole-day range; each selected endpoint stays visible. */
export function DateSpan({ from, to, onChange }: { from: Day; to: Day; onChange: (from: Day, to: Day) => void }) {
  const t = useText();
  const { year, profile } = useAppData();
  const [edge, setEdge] = useState<'from' | 'to'>('from');
  const [month, setMonth] = useState(from.slice(0, 7));
  return (
    <>
      <SegmentedControl
        testID="calendar-date-edge"
        label={t('calendarView.edit.dates')}
        choices={[
          { value: 'from', label: t('calendarView.edit.fromLabel') },
          { value: 'to', label: t('calendarView.edit.toLabel') },
        ]}
        selected={edge}
        onSelect={(next) => {
          setEdge(next);
          setMonth((next === 'from' ? from : to).slice(0, 7));
        }}
      />
      <Text style={settingsStyles.body}>{t('calendarView.range', { from: formatDay(from), to: formatDay(to) })}</Text>
      <MonthDays
        month={month}
        selected={edge === 'from' ? from : to}
        first={year.from}
        last={year.to}
        profile={profile}
        onMonth={setMonth}
        onSelect={(day) => onChange(edge === 'from' ? day : from, edge === 'to' ? day : to < day ? day : to)}
      />
    </>
  );
}
