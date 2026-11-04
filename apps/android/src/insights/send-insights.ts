// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sending a teachers' world's insights (#622, R-1.6-01, R-1.6-03, answer 697):
// while taking part is on, each term due (dueTerms in the core), from the
// latest term ended on the day it was last turned on to the world's date, goes
// to the world's observatory on the demo server, one sending for each class of
// the world's teacher that pins a plan pack and has not sent for that term,
// exactly the text the opt-in shows for that term (term-sendings.ts), with PUT
// /worlds/<ID>/insights/sendings. Each one the server takes, as new or as its
// own again, is kept in the log under the world's date as its exact text, the
// one the world's client sends for its body. The tries on one world's store
// take turns, so none sends what another has sent; a try stops before its next
// sending once the choice changes, taking part turned off or on again, or its
// caller has gone. A refusal stops there with an error, and what is left goes
// at the next try; a class with a pack and no sending is passed over and
// counted, the others sent, since trying again would not change it, and so is a
// sending refused for a term whose figures read, its collection having ended
// (#623, answer 700), and not asked about again while the app runs. A term
// whose classes have all sent is not worked out again.

import {
  dueTerms,
  insightsChoice,
  NO_PACK,
  wasSent,
  type Entry,
  type Day,
  type RandomBytes,
  type RecordBook,
  type WorldMac,
  type WorldTeacher,
} from '@minhajna/core';
import { unexpected, type Send } from '../demo/world-session';
import type { TermReference } from '../director/seeded-fill';
import { termPacks, type ReportTerm } from '../observatory/figures-read';
import { termSendings } from './term-sendings';

export type SendInsightsInput = {
  readonly world: string;
  readonly mine: WorldTeacher;
  readonly date: Day;
  readonly book: RecordBook;
  readonly reference: TermReference;
  readonly kit: { readonly mac: WorldMac; readonly random: RandomBytes };
  readonly digest: (text: string) => Promise<string>;
  readonly send: Send;
  /** Whether the caller still wants the sendings; true when absent. */
  readonly wanted?: () => boolean;
};

/** How many sendings the server took, how many classes with a pack had none to send, and how many came too late. */
export interface InsightsTry {
  readonly taken: number;
  readonly unsent: number;
  /** Sendings for a term whose collection had ended, read from its figures, as a refusal alone does not say why. */
  readonly late: number;
}

/** Each world store's sendings found late while the app runs, none of which is asked about again. */
const lateSendings = new WeakMap<RecordBook, Set<string>>();

/** Each world store's latest try, which the next one waits for. */
const tries = new WeakMap<RecordBook, Promise<unknown>>();

/** The terms due, each with the classes that pin a pack and have not sent for it. */
export function waitingSendings(
  mine: WorldTeacher,
  reference: TermReference,
  date: Day,
  entries: readonly Entry[],
): { readonly term: ReturnType<typeof dueTerms>[number]; readonly classIds: readonly string[] }[] {
  const year = reference.calendar.year;
  const subject = mine.teacher.subject;
  const packed = mine.school.classes.filter(
    (one) => mine.teacher.classIds.includes(one.id) && one.packs[subject] !== undefined,
  );
  return dueTerms(year, date, insightsChoice(entries))
    .map((term) => ({
      term,
      classIds: packed.filter((one) => !wasSent(entries, one.id, year.id, term.number)).map((one) => one.id),
    }))
    .filter((one) => one.classIds.length > 0);
}

/** Sends every sending due and not yet sent, after the store's earlier tries, and answers how it went. */
export function sendDueInsights(input: SendInsightsInput): Promise<InsightsTry> {
  const before = tries.get(input.book) ?? Promise.resolve();
  const run = before.then(
    () => sendNow(input),
    () => sendNow(input),
  );
  tries.set(input.book, run);
  return run;
}

/** Whether the term's figures read, its collection having ended; a reading that fails says it has not. */
const termEnded = (world: string, term: ReportTerm, send: Send): Promise<boolean> =>
  termPacks(world, term, send).then(
    (packs) => packs !== 'unready',
    () => false,
  );

async function sendNow(input: SendInsightsInput): Promise<InsightsTry> {
  const { world, mine, date, book, reference, send, wanted = () => true } = input;
  const year = reference.calendar.year.id;
  const chosen = JSON.stringify(insightsChoice(book.entries));
  const going = () => wanted() && JSON.stringify(insightsChoice(book.entries)) === chosen;
  let taken = 0;
  let unsent = 0;
  let late = 0;
  const known = lateSendings.get(book) ?? new Set<string>();
  lateSendings.set(book, known);
  for (const { term } of waitingSendings(mine, reference, date, book.entries)) {
    if (!going()) return { taken, unsent, late };
    for (const { classId, sending } of await termSendings({ ...input, term })) {
      if (sending === NO_PACK || wasSent(book.entries, classId, year, term.number)) continue;
      if (typeof sending === 'string') {
        unsent += 1;
        continue;
      }
      if (!going()) return { taken, unsent, late };
      const place = `${classId}/${year}/${term.number}`;
      if (known.has(place)) {
        late += 1;
        continue;
      }
      const answer = await send({ method: 'PUT', path: `/worlds/${world}/insights/sendings`, body: sending });
      if (answer.status === 409 && (await termEnded(world, { year, term: term.number }, send))) {
        known.add(place);
        late += 1;
        continue;
      }
      if (answer.status !== 201 && answer.status !== 200) throw unexpected(answer);
      await book.record(date, { kind: 'insights.sent', sent: { classId, text: JSON.stringify(sending) } });
      taken += 1;
    }
  }
  return { taken, unsent, late };
}
