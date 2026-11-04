// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How a seeded course moves through its pinned pack (#549, answer 626), shared
// by a seeded school's term of signed weeks (seeded-term.ts) and a teachers'
// world's made-up sendings (insights-seed.ts, answer 699): which days hold its
// lessons, at what pace it goes, and where its plan has reached. Left out of
// the package's index, as neither needs it from outside.

import type { CalendarView } from './calendar.ts';
import type { Day } from './day.ts';
import type { School, SchoolClass } from './records.ts';

/** The share of days a seeded teacher is absent. */
export const ABSENT = 0.02;
/** The share of the year's sessions a plan fills, leaving the rest as its buffer. */
export const PLAN_SHARE = 0.95;
/** The slowest and fastest a course moves through its plan, against the year's pace. */
export const PACE = [0.9, 1.15] as const;

/** Whether a day holds a course's lessons: a school day with no closure or exam. */
export function isLessonDay(view: CalendarView, place: School, schoolClass: SchoolClass, day: Day): boolean {
  const info = view.info(day, place, schoolClass);
  return info.schoolDay && info.closure === null && info.exam === null;
}

/** A pack's plan as a course moves through it, each held session moving it on by `step` of the plan's budget. */
export class Plan {
  readonly #items: readonly { readonly id: string; readonly from: number; readonly to: number }[];
  readonly #total: number;
  readonly #step: number;
  #at = 0;

  constructor(items: readonly { readonly id: string; readonly budget?: number }[], sessions: number) {
    let end = 0;
    this.#items = items.map((one) => ({ id: one.id, from: end, to: (end += Math.max(1, one.budget ?? 1)) }));
    this.#total = end;
    this.#step = sessions === 0 ? 0 : end / sessions;
  }

  /** The item a held session works on and those it passes over, merged; none once the plan is done. */
  teach(): { readonly item: string | null; readonly merged: readonly string[] } {
    const from = this.#at;
    const current = this.#items.find((one) => one.to > from);
    if (current === undefined || this.#step === 0) return { item: null, merged: [] };
    this.#at = Math.min(this.#total, from + this.#step);
    const merged = this.#items.filter((one) => one.from >= current.to && one.to <= this.#at).map((one) => one.id);
    return { item: current.id, merged };
  }

  get reached(): number {
    return this.#total === 0 ? 0 : Math.floor((1000 * this.#at) / this.#total);
  }

  /** Whether the plan's budget left is more than these sessions give at the course's pace. */
  runsLong(sessions: number): boolean {
    return this.#total - this.#at > sessions * this.#step + 1e-9;
  }
}
