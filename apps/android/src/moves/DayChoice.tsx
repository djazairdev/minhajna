// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «ابتداءً من»: the move's day, from two chips and «تاريخ آخر», which shows
// the working days of the two weeks around today.

import type { Day } from '@minhajna/core';
import { useState } from 'react';
import { ChipGroup } from '../components/Chip';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { moveDays } from './move-days';

export function DayChoice({ day, onDay, testID }: { day: Day | null; onDay: (day: Day) => void; testID: string }) {
  const t = useText();
  const { profile, today } = useAppData();
  const [all, setAll] = useState(false);
  const days = moveDays(profile, today());
  const shown = all ? days.all : day !== null && !days.first.includes(day) ? [...days.first, day] : days.first;
  return (
    <ChipGroup
      testID={testID}
      label={t('move.from')}
      choices={shown.map((one) => ({ value: one, label: dayName(t, one, currentLanguage(), profile) }))}
      selected={day}
      onSelect={onDay}
      {...(!all && { more: { label: t('move.otherDay'), onPress: () => setAll(true) } })}
    />
  );
}
