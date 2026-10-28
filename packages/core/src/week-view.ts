// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's week at once (#251, Web-week, answers 526 and 527), for the
// PC: the week's working days, and any other day a session falls on, each as
// Today has it, with its sessions' proposals and records, each course walked
// once for the whole week; the slots the
// timetable in force draws, and any other a session takes; and how many
// sessions the calendar left, and how many of them are recorded.

import type { Context } from './context.ts';
import { addDays, startOfWeek, weekday, type Day } from './day.ts';
import { compareSlots, slotKey, type Slot } from './records.ts';
import { versionOn } from './sessions.ts';
import { daysView, type TodaySession, type TodayView } from './today.ts';
import { weekGrid } from './week.ts';

export interface WeekView {
  /** The week's first day, by the country's week. */
  readonly start: Day;
  readonly days: readonly TodayView[];
  readonly slots: readonly Slot[];
  /** The sessions the calendar left this week. */
  readonly held: number;
  /** Those of them recorded. */
  readonly recorded: number;
}

/** The week that holds `day`. */
export function weekView(context: Context, day: Day): WeekView {
  const country = context.ref.country;
  const start = startOfWeek(day, country.weekStartsOn);
  const end = addDays(start, 6);
  const days = daysView(context, start, end).filter(
    (view) => country.workingDays.includes(weekday(view.day)) || view.sessions.length > 0,
  );
  const version = versionOn(context.state.timetables, start) ?? versionOn(context.state.timetables, end);
  const slots = new Map(weekGrid(country, version?.options).slots.map((slot) => [slotKey(slot), slot]));
  for (const view of days) for (const item of view.sessions) slots.set(slotKey(item.session.slot), item.session.slot);
  const held = days.flatMap((view) => view.sessions).filter((item) => item.status !== 'calendar');
  return {
    start,
    days,
    slots: [...slots.values()].sort(compareSlots),
    held: held.length,
    recorded: held.filter((item) => item.status === 'recorded').length,
  };
}

/** A day's sessions in one slot. */
export function weekCell(view: TodayView, slot: Slot): TodaySession[] {
  const key = slotKey(slot);
  return view.sessions.filter((item) => slotKey(item.session.slot) === key);
}
