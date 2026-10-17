// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words around the week's grid (#28): day names, slots named by their
// half-day and place, such as «ص1», never clock times, which come from bell
// times (#29), and what TalkBack says for each cell. In a week of two
// schools, each class carries its school, and the sessions are counted by
// school; clashing slots are listed.

import {
  slotKey,
  weekClashes,
  type School,
  type State,
  type SchoolClass,
  type Slot,
  type TimetableVersion,
  type Weekday,
  type WeekGrid as Grid,
} from '@minhajna/core';
import type { WeekGridCell, WeekGridDay, WeekGridSlot } from '../components/WeekGrid';
import { currentLanguage, type useText } from '../text/i18n';
import { itemsAt, type Lookup } from './slot-rules';
import { classLoads, type Cell, type ClassOf } from './week-rules';

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

/** A slot with its day, such as «خانة الأحد، الحصة 1 صباحاً». */
export function slotName(t: Translate, cell: Cell): string {
  return t('week.slotTitle', { day: t(`week.days.${cell.weekday}`), slot: slotSpoken(t, cell.slot) });
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

/** A school's short name in the merged week: the last word of its name, such as «النجاح». */
export function schoolShort(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

/**
 * A slot's content as WeekGrid shows it: each item short on its own line, and in full for a screen reader. With
 * `schools`, each class carries its school's short name, for a week of two schools; `clash` marks the cell; `shown`
 * isolates the names in `spoken`.
 */
export function gridCell(
  t: Translate,
  version: TimetableVersion,
  lookup: Lookup & { readonly schoolClass: (id: string) => SchoolClass | undefined },
  cell: Cell,
  marks: {
    readonly schools?: (schoolId: string) => string | undefined;
    readonly clash?: boolean;
    /** Isolates the names in `spoken`, for text shown on screen rather than read out. */
    readonly shown?: boolean;
  } = {},
): WeekGridCell {
  const named = (name: string) => (marks.shown === true ? isolate(name) : name);
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
    const school = schoolClass && marks.schools?.(schoolClass.schoolId);
    return {
      short: [
        isolate(name),
        school && isolate(schoolShort(school)),
        group && t('week.groupShort', { n: group }),
        weeks && t(weeks === 'A' ? 'week.weekShortA' : 'week.weekShortB'),
      ]
        .filter(Boolean)
        .join(' '),
      spoken: [
        named(name),
        school && named(school),
        group && t('week.halfName', { n: group }),
        weeks && t(weeks === 'A' ? 'week.weekA' : 'week.weekB'),
      ]
        .filter(Boolean)
        .join(comma),
    };
  });
  const spoken = parts.map((part) => part.spoken).join(comma);
  return {
    label: parts.map((part) => part.short).join('\n'),
    spoken: marks.clash === true ? `${t('week.clash')}${comma}${spoken}` : spoken,
    kind: items.some((item) => item.kind === 'class') ? 'class' : 'own',
    ...(marks.clash === true && { clash: true }),
  };
}

const cellKey = (cell: Cell) => `${cell.weekday}:${cell.slot.half}:${cell.slot.index}`;

/** The marks of a week: school names when it holds classes of two schools or more, and its clashing slots. */
export function weekMarks(version: TimetableVersion, state: State, classes: readonly SchoolClass[]) {
  const schoolIds = new Set(classes.map((schoolClass) => schoolClass.schoolId));
  const clashes = new Map(weekClashes(version, state).map((clash) => [cellKey(clash), clash]));
  return {
    schools: schoolIds.size > 1 ? (schoolId: string) => state.schools.get(schoolId)?.name : undefined,
    clashAt: (cell: Cell) => clashes.has(cellKey(cell)),
    clashes: [...clashes.values()].map((clash): Cell => ({ weekday: clash.weekday, slot: clash.slot })),
  };
}

/** Each school's sessions a week, such as «النجاح: 6 حصص», for a week of two schools. */
export function schoolTally(
  t: Translate,
  version: TimetableVersion,
  classOf: ClassOf,
  classes: readonly SchoolClass[],
  schools: Iterable<School>,
): string[] {
  return [...schools].flatMap((school) => {
    const own = classes.filter((schoolClass) => schoolClass.schoolId === school.id);
    if (own.length === 0) return [];
    const count = classLoads(version, classOf, own).total;
    return [`${isolate(schoolShort(school.name))}: ${t('week.sessions', { count })}`];
  });
}
