// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the teacher captures during a session (#239, R-3.5-07, R-3.5-08,
// R-3.8-24, answers 441 and 442), and what the component marks are set
// beside. Participation and behaviour count taps; homework is not done, 1,
// or done with someone's help, 2; a notebook is incomplete, 1. A capture
// keeps no detail, and the last one for a pupil and item counts. The app
// never turns captures into points: it shows them as evidence, and proposes
// the homework counts of the session's homework record (P67), confirmed by
// the teacher. A session recorded as not held keeps its captures in the
// history, but they no longer count; a withdrawn one's still do, as for a
// session not yet recorded (answer 450).

import { compareDays, type Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import type { SessionRef } from './records.ts';
import type { State } from './state-type.ts';
import { current } from './versions.ts';

export const CAPTURE_ITEMS = ['participation', 'homework', 'notebook', 'behaviour'] as const;

export type CaptureItem = (typeof CAPTURE_ITEMS)[number];

/** The highest value of an item: homework's two states, the notebook's one; taps have none. */
export const CAPTURE_MAX: Readonly<Record<CaptureItem, number | null>> = {
  participation: null,
  homework: 2,
  notebook: 1,
  behaviour: null,
};

export interface SessionCapture {
  readonly session: SessionRef;
  readonly pupilId: string;
  readonly item: CaptureItem;
  /** Taps, or the item's state; 0 clears it. */
  readonly value: number;
}

/** The key the last capture for a session, pupil and item is kept under. */
export function captureKey(capture: Pick<SessionCapture, 'session' | 'pupilId' | 'item'>): string {
  return `${capture.session.key}/${capture.pupilId}/${capture.item}`;
}

/** The event that records a capture; a value outside the item's range is refused. */
export function setCapture(session: SessionRef, pupilId: string, item: CaptureItem, value: number): RecordEvent {
  const max = CAPTURE_MAX[item];
  if (!Number.isSafeInteger(value) || value < 0 || (max !== null && value > max)) {
    throw new RangeError('A capture is a whole number within its item');
  }
  return { kind: 'capture.set', capture: { session, pupilId, item, value } };
}

/** Whether a session's captures count: unless it is recorded as not held. */
function counts(state: Pick<State, 'sessions'>, sessionKey: string): boolean {
  return current(state.sessions.get(sessionKey))?.outcome !== 'not-held';
}

/** A session's captures, by pupil and item. */
export function sessionCaptures(
  state: Pick<State, 'captures' | 'sessions'>,
  sessionKey: string,
): Map<string, Partial<Record<CaptureItem, number>>> {
  const found = new Map<string, Partial<Record<CaptureItem, number>>>();
  if (!counts(state, sessionKey)) return found;
  for (const capture of state.captures.values()) {
    if (capture.session.key !== sessionKey || capture.value === 0) continue;
    found.set(capture.pupilId, { ...found.get(capture.pupilId), [capture.item]: capture.value });
  }
  return found;
}

/** The homework counts a session's captures propose for the homework that comes back in it, among `listed`. */
export function homeworkProposal(
  state: Pick<State, 'captures' | 'sessions'>,
  sessionKey: string,
  listed: readonly string[],
): { readonly notDone: number; readonly reliedOn: number } {
  const captured = sessionCaptures(state, sessionKey);
  const states = listed.map((pupilId) => captured.get(pupilId)?.homework);
  return { notDone: states.filter((one) => one === 1).length, reliedOn: states.filter((one) => one === 2).length };
}

export interface Evidence {
  readonly participation: number;
  readonly behaviour: number;
  readonly homeworkNotDone: number;
  readonly homeworkHelped: number;
  readonly notebookIncomplete: number;
}

const within = (day: Day, from: Day, to: Day) => compareDays(day, from) >= 0 && compareDays(day, to) <= 0;

/** What was captured for a pupil in a course's sessions from `from` to `to`. */
export function evidence(
  state: Pick<State, 'captures' | 'sessions'>,
  courseId: string,
  pupilId: string,
  from: Day,
  to: Day,
): Evidence {
  const totals = { participation: 0, behaviour: 0, homeworkNotDone: 0, homeworkHelped: 0, notebookIncomplete: 0 };
  for (const capture of state.captures.values()) {
    const { session } = capture;
    if (capture.pupilId !== pupilId || session.courseId !== courseId || !within(session.day, from, to)) continue;
    if (!counts(state, session.key)) continue;
    if (capture.item === 'participation') totals.participation += capture.value;
    if (capture.item === 'behaviour') totals.behaviour += capture.value;
    if (capture.item === 'homework' && capture.value === 1) totals.homeworkNotDone += 1;
    if (capture.item === 'homework' && capture.value === 2) totals.homeworkHelped += 1;
    if (capture.item === 'notebook' && capture.value === 1) totals.notebookIncomplete += 1;
  }
  return totals;
}
