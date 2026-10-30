// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The part of a signed week that the totals above the school read (#555,
// PRD §5.10, answer 565). A signed week's text (certify.ts) is a JSON
// object: `format` names it, `course` and `week` say which course and which
// week it records, `version` counts its signed corrections from 0, and
// `totals` holds the figures the teacher's app works out from the week when
// it is signed. The rest of the week, its sessions, homework, roll call and
// marks (#524), is the school's record and is never read here. The figures:
// the subject's ID; each plan item the week worked on, with its sessions
// and whether it was taught, merged, skipped or re-taught; how far the
// class got in its plan by the week's end, in thousandths; whether its plan
// runs past the term's end; the class's sessions that another teacher gave
// as cover, counted once, in the week of the class covered; and the class's
// sessions lost to closures in the public calendar. Never a count of
// sessions not held, a reason, or anything from the private layer. Who
// signed the week is its certificate's, not the text's. A week's text is
// read only up to WEEK_TEXT_BYTES.

import { isDay, type Day } from './day.ts';
import { ITEM_ID } from './pack-fields.ts';
import { ENTRY_ID } from './reference-fields.ts';
import { ID } from './school-key-shape.ts';
import { utf8Length } from './signed-read.ts';

export const WEEK_FORMAT = 'minhajna/week/1';
export const ITEM_OUTCOMES = ['taught', 'merged', 'skipped', 'retaught'] as const;
export type ItemOutcome = (typeof ITEM_OUTCOMES)[number];

/** The most sessions one week gives an item, has covered, or loses to closures. */
export const MOST_WEEK_SESSIONS = 60;
/** The most plan items one week works on. */
export const MOST_WEEK_ITEMS = 64;
/** The most a signed week's text may weigh, in UTF-8 bytes, for the totals to read it. */
export const WEEK_TEXT_BYTES = 65_536;

export interface ItemFigures {
  readonly item: string;
  /** None for a skipped item; at least one for an item taught or re-taught. */
  readonly sessions: number;
  readonly outcome: ItemOutcome;
}

export interface WeekTotals {
  readonly subject: string;
  /** In order of item, each once. */
  readonly items: readonly ItemFigures[];
  /** How far the class got in its plan by the week's end, in thousandths. */
  readonly reached: number;
  readonly runsLong: boolean;
  /** The class's sessions that another teacher gave as cover. */
  readonly covered: number;
  /** The class's sessions lost to closures in the public calendar. */
  readonly closed: number;
}

export interface WeekForTotals {
  readonly course: string;
  /** The week's first day. */
  readonly week: Day;
  readonly version: number;
  readonly totals: WeekTotals;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown, most: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= most;
}

function readItem(value: unknown): ItemFigures | null {
  if (!isRecord(value) || Object.keys(value).length !== 3) return null;
  const { item, sessions, outcome } = value;
  if (typeof item !== 'string' || !ITEM_ID.test(item) || !isCount(sessions, MOST_WEEK_SESSIONS)) return null;
  if (!ITEM_OUTCOMES.includes(outcome as ItemOutcome)) return null;
  if (outcome === 'skipped' ? sessions !== 0 : outcome !== 'merged' && sessions === 0) return null;
  return { item, sessions, outcome: outcome as ItemOutcome };
}

function readTotals(value: unknown): WeekTotals | null {
  if (!isRecord(value) || Object.keys(value).length !== 6) return null;
  const { subject, items, reached, runsLong, covered, closed } = value;
  if (typeof subject !== 'string' || !ENTRY_ID.test(subject)) return null;
  if (!isCount(reached, 1000) || typeof runsLong !== 'boolean') return null;
  if (!isCount(covered, MOST_WEEK_SESSIONS) || !isCount(closed, MOST_WEEK_SESSIONS)) return null;
  if (!Array.isArray(items) || items.length > MOST_WEEK_ITEMS) return null;
  const read = items.map(readItem);
  if (read.some((one, index) => one === null || (index > 0 && read[index - 1]!.item >= one.item))) return null;
  return { subject, items: read as ItemFigures[], reached, runsLong, covered, closed };
}

/** What the totals read in a signed week's text, or null when it holds none. */
export function readWeekTotals(text: string): WeekForTotals | null {
  const bytes = text.length > WEEK_TEXT_BYTES ? null : utf8Length(text);
  if (bytes === null || bytes > WEEK_TEXT_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value) || value['format'] !== WEEK_FORMAT) return null;
  const { course, week, version } = value;
  if (typeof course !== 'string' || !ID.test(course) || typeof week !== 'string' || !isDay(week)) return null;
  if (!isCount(version, Number.MAX_SAFE_INTEGER)) return null;
  const totals = readTotals(value['totals']);
  return totals === null ? null : { course, week, version, totals };
}
