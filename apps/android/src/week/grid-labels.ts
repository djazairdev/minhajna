// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words around the week's grid (#28): day names, slots named by their
// half-day and place, such as «ص1», never clock times, which come from bell
// times (#29), and what TalkBack says for each cell.

import { slotKey, type Slot, type TimetableVersion, type Weekday, type WeekGrid as Grid } from '@minhajna/core';
import type { WeekGridCell, WeekGridDay, WeekGridSlot } from '../components/WeekGrid';
import type { useText } from '../text/i18n';
import { contentOf, type Cell, type ClassOf } from './week-rules';

type Translate = ReturnType<typeof useText>;

/** The grid's days and slots as WeekGrid takes them, with a way back to the core's. */
export function gridLabels(t: Translate, grid: Grid) {
  const days: WeekGridDay[] = grid.days.map((day) => ({ key: String(day), label: t(`week.days.${day}`) }));
  const slots: (WeekGridSlot & { readonly slot: Slot })[] = grid.slots.map((slot) => {
    const morning = slot.half === 'morning';
    return {
      key: slotKey(slot),
      label: t(morning ? 'week.slotMorning' : 'week.slotAfternoon', { index: slot.index }),
      spoken: t('week.slotSpoken', { half: t(morning ? 'week.morning' : 'week.afternoon'), index: slot.index }),
      first: slot.index === 1,
      slot,
    };
  });
  const cellName = (day: WeekGridDay, slot: WeekGridSlot, cell: WeekGridCell) =>
    t('week.cellName', { day: day.label, slot: slot.spoken, content: cell?.label ?? t('week.empty') });
  const cellOf = (day: WeekGridDay, slot: WeekGridSlot) => ({
    weekday: Number(day.key) as Weekday,
    slot: slots.find((candidate) => candidate.key === slot.key)?.slot ?? { half: 'morning' as const, index: 1 },
  });
  return { days, slots, cellName, cellOf };
}

/** A slot's content as WeekGrid shows it. */
export function gridCell(version: TimetableVersion, classOf: ClassOf, cell: Cell): WeekGridCell {
  const shown = contentOf(version, classOf, cell);
  if (shown === null) return null;
  return shown.kind === 'class' ? { label: shown.name, kind: 'class' } : { label: shown.label, kind: 'own' };
}
