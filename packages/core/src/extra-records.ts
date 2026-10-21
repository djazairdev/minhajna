// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A session outside the timetable as the history keeps it (PRD §3.3), and
// its order: by day, then by the time typed. Its topic, in the teacher's
// own words, is the private note under `extraNoteKey`, since it may name
// pupils (§5.4). Apart from extra.ts, so the state can order them without
// importing the rules that read the state.

import { clockMinutes } from './bells.ts';
import { compareDays, type Day } from './day.ts';

/** The kinds of session outside the timetable, in the order the page lists them. */
export const EXTRA_KINDS = ['support', 'catch-up', 'review', 'supervised'] as const;

export type ExtraKind = (typeof EXTRA_KINDS)[number];

/** A session outside the timetable, with the date and times the teacher typed. */
export interface ExtraSession {
  readonly id: string;
  readonly courseId: string;
  readonly kind: ExtraKind;
  readonly day: Day;
  /** As typed, HH:MM on a 24-hour clock. */
  readonly from: string;
  readonly to: string;
  /** For a support or «تدارك» session: the support item it took (#228). */
  readonly item?: string;
  /** Whether the session finished that item. */
  readonly finished?: true;
  /** The scheduled support session it logs, which it ends (answer 362). */
  readonly scheduled?: string;
}

/** The key of a session's private note that holds its topic. */
export function extraNoteKey(id: string): string {
  return `extra:${id}`;
}

export function compareExtras(a: ExtraSession, b: ExtraSession): number {
  return (
    compareDays(a.day, b.day) ||
    clockMinutes(a.from) - clockMinutes(b.from) ||
    clockMinutes(a.to) - clockMinutes(b.to) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
