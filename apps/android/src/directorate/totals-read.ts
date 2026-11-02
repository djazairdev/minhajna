// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The directorate's own totals for an announced day (#598, answer 629), and the
// Ministry's, every directorate's and the nation's (#599, answer 630), as the
// demo server adds them up from the schools' shares (answer 628), every figure
// under its floor already hidden there: by subject and over every subject, each
// figure's teachers, schools and counts, and by plan item what the classes did,
// a hidden figure or item null. A day the server does not answer yet, not
// announced or not reached on its side, or for which no share of the
// directorate's schools, or of any school for the Ministry, came in, gives
// null; an answer not of that shape, for another directorate, or naming a
// directorate with no ID or twice, throws E_WORLD_SERVER, and any other answer
// throws with world-session.ts's codes. Subjects and items are kept as lists of
// pairs, in the server's order, so no name it sends can reach an object's own
// properties.

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

/** One directorate's figures as the server gives them, or undefined when they do not read. */
function readFigures(value: unknown): DirectorateFigures | undefined {
  const all = isMap(value) ? readFigure(value.all) : undefined;
  const subjects = isMap(value) && isMap(value.subjects) ? Object.entries(value.subjects) : null;
  const read = subjects?.map(([subject, figure]) => [subject, readFigure(figure)] as const) ?? null;
  if (all === undefined || read === null || read.some(([, figure]) => figure === undefined)) return undefined;
  return { subjects: read as DirectorateFigures['subjects'], all };
}

/** The day's answer, or null when the server does not answer that day yet. */
async function dayAnswer(world: string, day: Day, query: string, send: Send) {
  const answer = await send({ method: 'GET', path: `/worlds/${world}/totals/${day}${query}` });
  if (answer.status === 422) return null;
  if (answer.status !== 200) throw unexpected(answer);
  return isMap(answer.body) ? answer.body : {};
}

const notRead = () => failed('The demo server’s totals do not read', 'E_WORLD_SERVER');

/** The directorate's figures for an announced day, or null when the server does not answer that day yet. */
export async function readTotals(world: string, day: Day, directorate: string, send: Send) {
  const body = await dayAnswer(world, day, `?directorate=${encodeURIComponent(directorate)}`, send);
  if (body === null) return null;
  const one = Array.isArray(body.directorates) ? (body.directorates as unknown[]) : [];
  const own = one.length === 1 && isMap(one[0]) && one[0].id === directorate ? readFigures(one[0]) : undefined;
  if (own === undefined) throw notRead();
  return own.subjects.length === 0 ? null : own;
}

/** The Ministry's figures for a day: every directorate's, by its ID, and the nation's. */
export interface MinistryFigures {
  readonly directorates: readonly (readonly [string, DirectorateFigures])[];
  readonly national: DirectorateFigures;
}

/** The Ministry's figures for an announced day, or null when the server does not answer that day yet. */
export async function readMinistryTotals(world: string, day: Day, send: Send): Promise<MinistryFigures | null> {
  const body = await dayAnswer(world, day, '', send);
  if (body === null) return null;
  const rows = Array.isArray(body.directorates) ? (body.directorates as unknown[]) : [];
  const directorates = rows.map((one) => [isMap(one) ? one.id : null, readFigures(one)] as const);
  const national = readFigures(body.national);
  const ids = directorates.map(([id]) => id);
  const named = directorates.every(([id, figures]) => typeof id === 'string' && id !== '' && figures !== undefined);
  const once = new Set(ids).size === ids.length;
  if (!Array.isArray(body.directorates) || !named || !once || national === undefined) throw notRead();
  if (directorates.length === 0) return null;
  return { directorates: directorates as MinistryFigures['directorates'], national };
}
