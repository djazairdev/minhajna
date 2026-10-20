// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { nextSeq, recordChange, type Context, type PlanChange, type RecordBook } from '../src/index.ts';
import { contextOf, d } from './fixtures.ts';

/** A change without its place in the course's order. */
export type Draft = PlanChange extends infer C ? (C extends unknown ? Omit<C, 'seq'> : never) : never;

export const day = d('2026-09-20');
export const made = { courseId: 'c-math', day } as const;

/** The change with the next place in its course's order. */
export const next = (context: Context, draft: Draft): PlanChange => ({
  ...draft,
  seq: nextSeq(context.state.decisions, draft.courseId),
});

/** Records the changes in turn, each checked. */
export async function change(book: RecordBook, ...changes: Draft[]): Promise<Context> {
  for (const one of changes) await book.record(day, recordChange(contextOf(book), next(contextOf(book), one)));
  return contextOf(book);
}

/** A change to try, for refusals. */
export const attempt = (context: Context, draft: Draft) => () => recordChange(context, next(context, draft));
