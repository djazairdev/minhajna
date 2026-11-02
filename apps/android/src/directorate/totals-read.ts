// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directorate's own totals for an announced day (#598, answer 629), as the
// demo server adds them up from the schools' shares (answer 628), every figure
// under the directorate floor already hidden there: by subject and over every
// subject, each figure's teachers, schools and counts, and by plan item what
// the classes did, a hidden figure or item null. A day the server does not
// answer yet, not announced or not reached on its side, or for which no share
// of the directorate's schools came in, gives null; an answer not of that
// shape, or for another directorate, throws E_WORLD_SERVER, and any other
// answer throws with world-session.ts's codes. Subjects and items are kept as
// lists of pairs, in the server's order, so no name it sends can reach an
// object's own properties.

import type { Day } from '@minhajna/core';
import { failed, unexpected, type Send } from '../demo/world-session';

const COUNTS = ['teachers', 'schools', 'vacantPosts', 'hoursWithoutTeacher', 'classes', 'cover', 'closed'] as const;
const MORE = ['reached', 'runLong'] as const;
const ITEM = ['sessions', 'merged', 'skipped', 'retaught'] as const;

/** A plan item: its sessions, and the classes that merged, skipped or re-taught it. */
export type ItemFigure = Readonly<Record<(typeof ITEM)[number], number>>;

/** A figure the server shows, with its plan items for a subject. */
export type Figure = Readonly<Record<(typeof COUNTS)[number] | (typeof MORE)[number], number>> & {
  readonly items: readonly (readonly [string, ItemFigure | null])[];
};

/** A directorate's figures for a day: by subject, and over every subject; null when hidden. */
export interface DirectorateFigures {
  readonly subjects: readonly (readonly [string, Figure | null])[];
  readonly all: Figure | null;
}

const isCount = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readItem(value: unknown): ItemFigure | null | undefined {
  if (value === null) return null;
  if (!isMap(value) || !ITEM.every((field) => isCount(value[field]))) return undefined;
  return Object.fromEntries(ITEM.map((field) => [field, value[field]])) as ItemFigure;
}

function readFigure(value: unknown): Figure | null | undefined {
  if (value === null) return null;
  if (!isMap(value) || ![...COUNTS, ...MORE].every((field) => isCount(value[field]))) return undefined;
  const items = value.items === undefined ? {} : value.items;
  if (!isMap(items)) return undefined;
  const read = Object.entries(items).map(([item, one]) => [item, readItem(one)] as const);
  if (read.some(([, one]) => one === undefined)) return undefined;
  const counts = Object.fromEntries([...COUNTS, ...MORE].map((field) => [field, value[field]]));
  return { ...counts, items: read as Figure['items'] } as Figure;
}

/** The directorate's figures for an announced day, or null when the server does not answer that day yet. */
export async function readTotals(world: string, day: Day, directorate: string, send: Send) {
  const path = `/worlds/${world}/totals/${day}?directorate=${encodeURIComponent(directorate)}`;
  const answer = await send({ method: 'GET', path });
  if (answer.status === 422) return null;
  if (answer.status !== 200) throw unexpected(answer);
  const body = answer.body;
  const one = isMap(body) && Array.isArray(body.directorates) ? (body.directorates as unknown[]) : [];
  const own = one.length === 1 && isMap(one[0]) && one[0].id === directorate ? one[0] : null;
  const all = own === null ? undefined : readFigure(own.all);
  const subjects = own !== null && isMap(own.subjects) ? Object.entries(own.subjects) : null;
  const read = subjects?.map(([subject, figure]) => [subject, readFigure(figure)] as const) ?? null;
  if (all === undefined || read === null || read.some(([, figure]) => figure === undefined)) {
    throw failed('The demo server’s totals do not read', 'E_WORLD_SERVER');
  }
  return read.length === 0 ? null : ({ subjects: read, all } as DirectorateFigures);
}
