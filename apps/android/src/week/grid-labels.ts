// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words around the week's grid (#28): day names, slots named by their
// half-day and place, such as «ص1», never clock times, which come from bell
// times (#29), and what TalkBack says for each cell.

import {
  slotKey,
  type SchoolClass,
  type Slot,
  type TimetableVersion,
  type Weekday,
  type WeekGrid as Grid,
} from '@minhajna/core';
import type { WeekGridCell, WeekGridDay, WeekGridSlot } from '../components/WeekGrid';
import { currentLanguage, type useText } from '../text/i18n';
import { itemsAt, type Lookup } from './slot-rules';
import type { Cell } from './week-rules';

type Translate = ReturnType<typeof useText>;

/** Keeps a class name, such as 4AM3, from setting the direction of the line around it. */
export const isolate = (name: string) => `\u2068${name}\u2069`;

/** A slot as TalkBack says it, such as «الحصة 2 صباحاً». */
export function slotSpoken(t: Translate, slot: Slot): string {
  return t('week.slotSpoken', {
    half: t(slot.half === 'morning' ? 'week.morning' : 'week.afternoon'),
    index: slot.index,
  });
}

/** The grid's days and slots as WeekGrid takes them, with a way back to the core's. */
export function gridLabels(t: Translate, grid: Grid) {
  const days: WeekGridDay[] = grid.days.map((day) => ({ key: String(day), label: t(`week.days.${day}`) }));
  const slots: (WeekGridSlot & { readonly slot: Slot })[] = grid.slots.map((slot) => {
    const morning = slot.half === 'morning';
    return {
      key: slotKey(slot),
      label: t(morning ? 'week.slotMorning' : 'week.slotAfternoon', { index: slot.index }),
      spoken: slotSpoken(t, slot),
      first: slot.index === 1,
      slot,
    };
  });
  const cellName = (day: WeekGridDay, slot: WeekGridSlot, cell: WeekGridCell) =>
    t('week.cellName', { day: day.label, slot: slot.spoken, content: cell?.spoken ?? cell?.label ?? t('week.empty') });
  const cellOf = (day: WeekGridDay, slot: WeekGridSlot) => ({
    weekday: Number(day.key) as Weekday,
    slot: slots.find((candidate) => candidate.key === slot.key)?.slot ?? { half: 'morning' as const, index: 1 },
  });
  return { days, slots, cellName, cellOf };
}

/** A slot's content as WeekGrid shows it: each item short on its own line, and in full for a screen reader. */
export function gridCell(
  t: Translate,
  version: TimetableVersion,
  lookup: Lookup & { readonly schoolClass: (id: string) => SchoolClass | undefined },
  cell: Cell,
): WeekGridCell {
  const items = itemsAt(version, lookup, cell);
  if (items.length === 0) return null;
  const comma = currentLanguage() === 'ar' ? '، ' : ', ';
  const parts = items.map((item) => {
    const weeks = item.weeks === 'every' ? null : item.weeks;
    if (item.kind === 'own') {
      const name = item.ownKind !== undefined ? t(`week.kinds.${item.ownKind}`) : item.label;
      return {
        short: [name, weeks && t(weeks === 'A' ? 'week.weekShortA' : 'week.weekShortB')].filter(Boolean).join(' '),
        spoken: [name, weeks && t(weeks === 'A' ? 'week.weekA' : 'week.weekB')].filter(Boolean).join(comma),
      };
    }
    const schoolClass = lookup.schoolClass(item.classId);
    const half = schoolClass?.groups
      .filter((group) => group.kind === 'half')
      .findIndex((group) => group.id === item.groupId);
    const group = half !== undefined && half >= 0 ? half + 1 : null;
    const name = schoolClass?.name ?? '';
    return {
      short: [
        isolate(name),
        group && t('week.groupShort', { n: group }),
        weeks && t(weeks === 'A' ? 'week.weekShortA' : 'week.weekShortB'),
      ]
        .filter(Boolean)
        .join(' '),
      spoken: [name, group && t('week.halfName', { n: group }), weeks && t(weeks === 'A' ? 'week.weekA' : 'week.weekB')]
        .filter(Boolean)
        .join(comma),
    };
  });
  return {
    label: parts.map((part) => part.short).join('\n'),
    spoken: parts.map((part) => part.spoken).join(comma),
    kind: items.some((item) => item.kind === 'class') ? 'class' : 'own',
  };
}
