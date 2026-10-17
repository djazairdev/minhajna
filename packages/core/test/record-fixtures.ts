// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Node's convenience helpers stay apart from the portable demo-class data.

import { MemoryStore, RecordBook, makeContext, type Context, type Day, type RecordEvent } from '../src/index.ts';
import { deps } from './support.ts';
import { d, reference } from './reference-fixtures.ts';

export { cemEvents, primaryEvents } from './demo-class.ts';

/** Opens a fresh, invented record book for a core test. */
export async function openBook(events: readonly RecordEvent[], day: Day = d('2026-09-13')): Promise<RecordBook> {
  const book = await RecordBook.open(new MemoryStore(), deps);
  await book.recordAll(day, events);
  return book;
}

/** The small invented reference used by the core's unit tests. */
export function contextOf(book: RecordBook): Context {
  return makeContext(reference, book.state);
}
