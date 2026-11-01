// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The spot-check sheet on the inspector's phone in a demo world (#594, I-Grant,
// R-7.2-06, answer 622). Opening it opens every class of the grant in the order
// the grant first names them (grant-read.ts), each posting its uses before its
// archive is read; then the sheet kept for the grant in the world's store is
// read, or, the first time, three days are drawn among the days with a held
// session in the weeks read (spot-sheet.ts) and kept, with no notes, unless
// none is, two openings at once on one store drawing once; a sheet kept with
// fewer than three days is topped up the same way from the days read now, its
// days and notes staying. Its rows are the drawn days' held sessions as read
// now. Saving keeps the sheet again, with the notes typed, the latest counting.
// Nothing is sent: the sheet stays in the world's store on the phone. Errors
// carry grant-read.ts's codes, E_SHEET_FULL when the notes are on more rows
// than a sheet keeps, and E_WORLD when the sheet does not read or the store
// does not keep it. Opening the sheet again on another day posts that day's
// uses again.

import {
  heldDays,
  keptSpotSheet,
  readSpotSheet,
  spotRows,
  SPOT_BOOKS_MOST,
  SPOT_DAYS,
  topUpSpotDays,
  type DeliveryReading,
  type Grant,
  type SpotRow,
  type SpotSheet,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { openGrantClass, type GrantClassRead } from './grant-read';

type SheetWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** The sheet as opened: as kept, its rows, and each class of the grant as read on the way. */
export interface OpenedSheet {
  readonly sheet: SpotSheet;
  readonly rows: readonly SpotRow[];
  readonly classes: ReadonlyMap<string, GrantClassRead | null>;
}

/** The draws under way on each world's store, by grant, so two openings at once draw once. */
const drawing = new WeakMap<SheetWorld['book'], Map<string, Promise<SpotSheet>>>();

async function keep(world: SheetWorld, sheet: SpotSheet): Promise<SpotSheet> {
  if (sheet.books.length > SPOT_BOOKS_MOST) throw failed('The sheet holds more notes than it keeps', 'E_SHEET_FULL');
  if (readSpotSheet(sheet) === null) throw failed('The sheet does not read', 'E_WORLD');
  await world.book.record(world.date, { kind: 'inspector.sheet', sheet });
  const kept = keptSpotSheet(world.book.entries, sheet.grant);
  if (kept === null) throw failed('The world’s store did not keep the sheet', 'E_WORLD');
  return kept;
}

function drawn(world: SheetWorld, grant: string, candidates: () => SpotSheet['days'], kit: WorldKit) {
  const kept = keptSpotSheet(world.book.entries, grant);
  if (kept !== null && kept.days.length >= SPOT_DAYS) return Promise.resolve(kept);
  const under = drawing.get(world.book) ?? new Map<string, Promise<SpotSheet>>();
  drawing.set(world.book, under);
  const draw = () => {
    const before = kept ?? { grant, days: [], notes: '', books: [] };
    const days = topUpSpotDays(before.days, candidates(), kit.random);
    return days.length === before.days.length ? Promise.resolve(before) : keep(world, { ...before, days });
  };
  const pending = under.get(grant) ?? draw().finally(() => under.delete(grant));
  under.set(grant, pending);
  return pending;
}

/** Opens a grant's sheet: every class opened, its uses posted first, and the days kept or drawn. */
export async function openSpotSheet(
  world: SheetWorld,
  grant: Grant,
  reading: DeliveryReading,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<OpenedSheet> {
  const classes = new Map<string, GrantClassRead | null>();
  for (const course of new Set(grant.weeks.map((one) => one.course))) {
    classes.set(course, await openGrantClass(world, grant, course, reading, kit, send));
  }
  const weeks = [...classes.values()].flatMap((one) => one?.weeks ?? []);
  const sheet = await drawn(world, grant.id, () => heldDays(weeks), kit);
  return { sheet, rows: spotRows(weeks, sheet.days), classes };
}

/** Keeps the sheet with the notes typed, the latest counting, and answers it as kept. */
export const saveSpotSheet = (world: SheetWorld, sheet: SpotSheet): Promise<SpotSheet> => keep(world, sheet);
