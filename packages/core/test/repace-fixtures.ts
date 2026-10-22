// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The re-pace tests' made-up setup (#229): the demo maths pack with
// «Subtracting whole numbers» optional, the demo language pack with
// «Writing 2» optional, and a book late on its plan.

import {
  awaitingBetween,
  confirmSessions,
  makeContext,
  packKey,
  type Context,
  type Day,
  type RecordBook,
  type RepaceDraft,
} from '../src/index.ts';
import { cemEvents, d, languagePack, mathPack, openBook, reference } from './fixtures.ts';

export const pack = {
  ...mathPack,
  items: mathPack.items.map((item) => (item.id === 'l4' ? { ...item, optional: true } : item)),
};
const words = {
  ...languagePack,
  items: languagePack.items.map((item) => (item.id === 'w2' ? { ...item, optional: true } : item)),
};
export const ref = {
  ...reference,
  packs: new Map([
    ...reference.packs,
    [packKey(pack.id, pack.release), pack],
    [packKey(words.id, words.release), words],
  ]),
};
export const today = d('2026-10-04');
/** Late enough that items land after the exams, so the draft offers choices. */
export const nearExams = d('2026-11-24');

/** The book with every session until `until` recorded as not held. */
export async function late(events = cemEvents(), until: Day = today): Promise<RecordBook> {
  const book = await openBook(events);
  const before = makeContext(ref, book.state);
  const sessions = awaitingBetween(before, d('2026-09-20'), until);
  await book.recordAll(
    until,
    confirmSessions(
      before,
      sessions.map((session) => ({ session, choice: { outcome: 'not-held' } })),
    ),
  );
  return book;
}

export const contextOf = (book: RecordBook): Context => makeContext(ref, book.state);
export const itemIds = (draft: RepaceDraft): string[] =>
  draft.weeks.flatMap((week) => week.entries.flatMap((entry) => (entry.kind === 'item' ? [entry.item.id] : [])));
export const plan = (draft: RepaceDraft): number => draft.weeks.reduce((sum, week) => sum + week.plan, 0);
