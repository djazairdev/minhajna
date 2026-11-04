// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One term's sendings for the teacher of a teachers' world (#622, answers 696
// and 697), as the opt-in shows them and as they are sent: the term's token and
// sending IDs are the draw the world's store keeps for the term, or a new one,
// kept there first, so that what is shown is what is sent; of two drawn at
// once, the first kept counts. Each class of the world's teacher comes with its
// sending, or why it makes none, worked out on the device from the world's
// description and the bundled reference data, as every device rebuilds them.

import {
  drawInsights,
  keptDraw,
  teacherSendings,
  type ClassSending,
  type Day,
  type RandomBytes,
  type RecordBook,
  type Term,
  type WorldMac,
  type WorldTeacher,
} from '@minhajna/core';
import { termReference, type TermReference } from '../director/seeded-fill';

export type TermSendingsInput = {
  readonly world: string;
  readonly mine: WorldTeacher;
  readonly term: Term & { readonly number: 1 | 2 | 3 };
  /** The world's store, and its date, which a new draw is kept under. */
  readonly book: RecordBook;
  readonly date: Day;
  readonly reference: TermReference;
  readonly kit: { readonly mac: WorldMac; readonly random: RandomBytes };
  readonly digest: (text: string) => Promise<string>;
};

/** Each of the teacher's classes with its sending for the term, or why it makes none. */
export async function termSendings(input: TermSendingsInput): Promise<ClassSending[]> {
  const { world, mine, term, book, date, reference, kit, digest } = input;
  const year = reference.calendar.year.id;
  if (keptDraw(book.entries, year, term.number) === null) {
    const drawn = drawInsights(year, term.number, mine.teacher.classIds, kit.random);
    await book.record(date, { kind: 'insights.drawn', drawn });
  }
  const draw = keptDraw(book.entries, year, term.number);
  if (draw === null) throw new Error('The draw kept does not read');
  const bells = reference.bells;
  const made = { seed: world, teacher: mine, reference: termReference(reference), bells, term, draw };
  return teacherSendings(made, kit.mac, digest);
}
