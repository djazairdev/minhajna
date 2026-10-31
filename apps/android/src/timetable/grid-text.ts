// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What each class's grid and the A/B weeks' check say (#576, answer 593): a
// time as 08:00 and a row's span as 08:00–09:00, in Latin digits as the files
// write them; a session as its week, when it alternates, its group, subject and
// teacher, as the file names them; a length in hours, with its minutes when it
// has any; and the balance line: that no session alternates, that weeks A and B
// balance for every group and teacher, or each group or teacher whose weeks
// differ, with both weeks' lengths. The balance counts the sessions imported,
// never the rows left out, and the page says so when rows were left out. Under
// a class's grid, the days it has sessions in the morning only, all ending by
// the level's first afternoon hour (noon without bells), are named, as the
// design's footer names a free afternoon.

import { alternates, weekBalance, type ClassGrid, type ImportedSession, type Weekday } from '@minhajna/core';
import type { TFunction } from 'i18next';

const two = (value: number) => String(value).padStart(2, '0');

/** Minutes from midnight as 08:00. */
export const clock = (minutes: number) => `${two(Math.floor(minutes / 60))}:${two(minutes % 60)}`;

/** A grid row's span, as 08:00–09:00. */
export const spanText = (start: number, end: number) => `${clock(start)}–${clock(end)}`;

/** A session in a grid's cell: its week when it alternates, its group, subject and teacher. */
export function sessionText(t: TFunction, session: ImportedSession): string {
  const week = session.week === 'both' ? [] : [t(session.week === 'A' ? 'ttImport.weekA' : 'ttImport.weekB')];
  return [...week, session.group, session.subject, session.teacher].filter((one) => one !== '').join(' · ');
}

/** The A/B weeks' check: its line, and each group or teacher whose weeks differ. */
export function weekCheck(t: TFunction, sessions: readonly ImportedSession[]) {
  if (!alternates(sessions)) return { line: t('ttImport.weeksNone'), uneven: [] };
  const length = (minutes: number) =>
    minutes % 60 === 0
      ? t('ttImport.hours', { hours: minutes / 60 })
      : t('ttImport.length', { hours: Math.floor(minutes / 60), minutes: two(minutes % 60) });
  const uneven = weekBalance(sessions).map((one) =>
    t('ttImport.weekRow', {
      who: one.group === '' ? one.name : `${one.name} ${one.group}`,
      a: length(one.a),
      b: length(one.b),
    }),
  );
  return { line: t(uneven.length === 0 ? 'ttImport.weeksBalanced' : 'ttImport.weeksUneven'), uneven };
}

/** The days of a class's grid whose sessions all end by the afternoon's start, as the design's footer names them. */
export function freeAfternoons(grid: ClassGrid, afternoon: number): Weekday[] {
  return grid.days.filter((_, index) => {
    const held = grid.slots.filter((slot) => (slot.cells[index] ?? []).length > 0);
    return held.length > 0 && held.every((slot) => slot.end <= afternoon);
  });
}
