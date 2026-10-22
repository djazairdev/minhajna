// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a class behind its plan can do, in order (#228, PRD §4.7,
// R-4.7-24 to R-4.7-28, answers 349 to 351): the buffers used and left
// before the next exams, TD's own sessions and items left, and the merges
// and optional items the pack proposes for that term, the same list the
// exam-window answer offers, and whether re-pacing is offered (#229).
// Shortening the item in progress is the teacher's in class, and adding
// sessions is theirs to schedule; nothing here changes the plan, which only
// the teacher's confirmations do.

import { courseSetup } from './choices.ts';
import type { Context } from './context.ts';
import type { Day } from './day.ts';
import { planChoices, type PlanChoice } from './exam-answers.ts';
import { queueItems } from './pack.ts';
import { nextExamTerm, pace, termCheck, type Pace } from './pacing.ts';
import { repaceOffered } from './repace-confirm.ts';

export interface CatchUp {
  /** The term whose exams come next, or null when the year has none left. */
  readonly term: number | null;
  readonly bufferUsed: number;
  readonly bufferLeft: number;
  /** Behind the plan beyond the buffers, in sessions. */
  readonly delay: number;
  /** Whether the pack has buffers for the next exams' term, used or not. */
  readonly hasBuffers: boolean;
  /** A class's own list: no buffers and no proposals, the teacher edits it. */
  readonly own: boolean;
  /** TD's sessions and items left before the next exams, counted apart; null without a term check. */
  readonly td: { readonly gives: number; readonly items: number } | null;
  /** The pack's merges and optional items for the next exams' term, in plan order. */
  readonly choices: readonly PlanChoice[];
  /** Whether rung 5, re-pacing the rest of the term, is offered (#229). */
  readonly repace: boolean;
}

/** Whether a class's pace calls for the catch-up options: buffers used, or behind beyond them. */
export function behindPlan(paced: Pace | null): boolean {
  return paced !== null && (paced.bufferUsed > 0 || paced.delay > 0);
}

/** A course's catch-up options on `today`; null without a plan to pace. */
export function catchUp(context: Context, courseId: string, today: Day): CatchUp | null {
  const setup = courseSetup(context, courseId);
  const paced = pace(context, courseId, today);
  if (setup.pack === null || paced === null) return null;
  const term = nextExamTerm(context, setup, today) ?? null;
  const buffers = queueItems(setup.pack, 'main').filter((item) => item.buffer === true);
  const check = term === null ? null : termCheck(context, courseId, today, term);
  return {
    term,
    bufferUsed: paced.bufferUsed,
    bufferLeft: paced.bufferLeft,
    delay: paced.delay,
    hasBuffers: term !== null && buffers.some((item) => item.term === undefined || item.term === term),
    own: setup.pack.status === 'own',
    td: check === null || (check.td.gives === 0 && check.td.items === 0) ? null : check.td,
    choices: term === null ? [] : planChoices(context, { courseId, term }),
    repace: repaceOffered(context, courseId, today),
  };
}
