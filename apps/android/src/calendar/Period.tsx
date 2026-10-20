// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ChipGroup } from '../components/Chip';
import { useText } from '../text/i18n';

/** The chosen half applies on every date of the range, without storing clock times. */
export function Period({
  selected,
  onSelect,
}: {
  selected: 'all' | 'morning' | 'afternoon';
  onSelect: (period: 'all' | 'morning' | 'afternoon') => void;
}) {
  const t = useText();
  return (
    <ChipGroup
      testID="calendar-period"
      label={t('calendarView.period')}
      choices={(['all', 'morning', 'afternoon'] as const).map((value) => ({
        value,
        label: t(`calendarView.periods.${value}`),
      }))}
      selected={selected}
      onSelect={onSelect}
    />
  );
}
