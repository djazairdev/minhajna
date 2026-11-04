// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The observatory's figures for an ended term (#627, answer 680), as the demo
// server forms them (#626, answer 678): the term's packs, by their headings in
// the server's order, and one pack's figures at a time, by its place among
// them, the nation's and each wilaya's shown, with by plan item its classes,
// the median of its sessions, and the shares that merged, skipped, split or
// re-taught it, each a band in percent. Ending a term's collection takes the
// world's starter token. The server answers 409 both while a term's collection
// is open and while its figures are being formed; its words are not read, so
// both are one answer here, `unready`, which the device holding the starter
// token answers by ending the collection, which is idempotent and forms the
// figures again if a first try failed, then reading again. A world the server
// does not know throws E_NO_SUCH_WORLD; an answer not of its shape, or for
// another term or place, throws E_WORLD_SERVER, and any other answer throws
// with world-session.ts's codes, so ending a term with a starter token the
// server refuses, or in a world with no observatory or 12 ended terms, is said
// as the server's own answer. Items and wilayas are kept as lists of pairs, in
// the server's order, so no name it sends can reach an object's own
// properties, and no name is longer than MOST_NAME.

import { failed, unexpected, type Send } from '../demo/world-session';
import { worldRequest, type WorldAnswer } from '../network/world-network';

/** A school year, written `YYYY-YYYY`, and one of its terms. */
export interface ReportTerm {
  readonly year: string;
  readonly term: 1 | 2 | 3;
}

/** A share's band in percent, from its low end up to under its high end. */
export type Band = readonly [number, number];

const COUNTS = ['classes', 'teachers', 'schools'] as const;
const LISTS = ['merged', 'skipped', 'split', 'retaught'] as const;
const REACHED = ['low', 'median', 'high'] as const;
const HEADING = ['grade', 'subject', 'pack', 'release'] as const;
const MOST_NAME = 256;

/** A plan item: its classes, the median of its sessions when shown, and the bands of its lists. */
export type ItemFigure = Readonly<Record<(typeof LISTS)[number], Band>> & {
  readonly classes: number;
  readonly sessions: number | null;
};

/** A figure the server shows, for the nation or a wilaya. */
export type Figure = Readonly<Record<(typeof COUNTS)[number], number>> & {
  /** How far the classes got by the term's end, in thousandths: the median and the quartiles, maybe fractional. */
  readonly reached: Readonly<Record<(typeof REACHED)[number], number>>;
  readonly items: readonly (readonly [string, ItemFigure | null])[];
};

/** A pack and release whose figures a term holds. */
export type PackHeading = Readonly<Record<(typeof HEADING)[number], string>>;

/** One pack's figures: the nation's, each wilaya's shown, and how many sendings were set aside, when said. */
export type PackFigures = PackHeading & {
  readonly nation: Figure | null;
  readonly wilayas: readonly (readonly [string, Figure])[];
  readonly setAside: number | null;
};

const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isShare = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000;

function readBand(value: unknown): Band | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [low, high] = value as unknown[];
  return isCount(low) && isCount(high) && low < high && high <= 100 ? [low, high] : undefined;
}

function readItem(value: unknown): ItemFigure | null | undefined {
  if (value === null) return null;
  if (!isMap(value) || !isCount(value.classes)) return undefined;
  const sessions = value.sessions;
  const spent = sessions === null || (typeof sessions === 'number' && Number.isFinite(sessions) && sessions >= 0);
  const bands = LISTS.map((list) => [list, readBand(value[list])] as const);
  if (!spent || bands.some(([, band]) => band === undefined)) return undefined;
  return { classes: value.classes, sessions, ...(Object.fromEntries(bands) as Record<(typeof LISTS)[number], Band>) };
}

/** A map's entries each read by `read`, or undefined when the map or one entry does not read. */
function readEach<T>(value: unknown, read: (one: unknown) => T | undefined) {
  if (!isMap(value)) return undefined;
  const entries = Object.entries(value).map(([key, one]) => [key, read(one)] as const);
  const odd = entries.some(([key, one]) => key.length > MOST_NAME || one === undefined);
  return odd ? undefined : (entries as (readonly [string, T])[]);
}

function readFigure(value: unknown): Figure | undefined {
  if (!isMap(value) || !COUNTS.every((field) => isCount(value[field])) || !isMap(value.reached)) return undefined;
  const reached = value.reached;
  if (!REACHED.every((field) => isShare(reached[field]))) return undefined;
  const { low, median, high } = reached as Record<(typeof REACHED)[number], number>;
  const items = readEach(value.items, readItem);
  if (low > median || median > high || items === undefined) return undefined;
  if (items.some(([, item]) => item !== null && item.classes > (value.classes as number))) return undefined;
  const counts = Object.fromEntries(COUNTS.map((field) => [field, value[field]])) as Record<
    (typeof COUNTS)[number],
    number
  >;
  return { ...counts, reached: { low, median, high }, items };
}

function readHeading(value: unknown): PackHeading | undefined {
  const named = (one: unknown) => typeof one === 'string' && one !== '' && one.length <= MOST_NAME;
  if (!isMap(value) || !HEADING.every((field) => named(value[field]))) return undefined;
  return Object.fromEntries(HEADING.map((field) => [field, value[field]])) as PackHeading;
}

function readPack(value: unknown): PackFigures | undefined {
  const heading = readHeading(value);
  if (heading === undefined || !isMap(value)) return undefined;
  const nation = value.nation === null ? null : readFigure(value.nation);
  const wilayas = readEach(value.wilayas, readFigure);
  const setAside = value.setAside ?? null;
  if (nation === undefined || wilayas === undefined || (setAside !== null && !isCount(setAside))) return undefined;
  return { ...heading, nation, wilayas, setAside };
}

const notRead = () => failed('The demo server’s figures do not read', 'E_WORLD_SERVER');

const figuresPath = (world: string, { year, term }: ReportTerm) =>
  `/worlds/${world}/insights/figures?year=${encodeURIComponent(year)}&term=${term}`;

/** The answer's body when it is 200 and for the term asked, else the error it throws. */
function termAnswer(answer: WorldAnswer, asked: ReportTerm): Record<string, unknown> {
  if (answer.status === 404) throw failed('The world was erased', 'E_NO_SUCH_WORLD');
  if (answer.status !== 200) throw unexpected(answer);
  const body = answer.body;
  if (!isMap(body) || body.year !== asked.year || body.term !== asked.term) throw notRead();
  return body;
}

/** The term's packs in the server's order, or `unready` while its collection is open or its figures are formed. */
export async function termPacks(
  world: string,
  asked: ReportTerm,
  send: Send = worldRequest,
): Promise<readonly PackHeading[] | 'unready'> {
  const answer = await send({ method: 'GET', path: figuresPath(world, asked) });
  if (answer.status === 409) return 'unready';
  const body = termAnswer(answer, asked);
  const packs = Array.isArray(body.packs) ? (body.packs as unknown[]).map(readHeading) : [undefined];
  if (packs.some((pack) => pack === undefined)) throw notRead();
  return packs as PackHeading[];
}

/** The figures of the pack at place `at` among the term's packs. */
export async function packFigures(
  world: string,
  asked: ReportTerm,
  at: number,
  send: Send = worldRequest,
): Promise<PackFigures> {
  if (!isCount(at)) throw new RangeError('Not a pack’s place');
  const answer = await send({ method: 'GET', path: `${figuresPath(world, asked)}&at=${at}` });
  const body = termAnswer(answer, asked);
  const figures = body.at === at ? readPack(body.figures) : undefined;
  if (figures === undefined) throw notRead();
  return figures;
}

/** Ends the term's collection with the world's starter token; ending it again changes nothing. */
export async function closeTerm(
  world: string,
  starter: string,
  asked: ReportTerm,
  send: Send = worldRequest,
): Promise<void> {
  const body = { year: asked.year, term: asked.term };
  const answer = await send({ method: 'POST', path: `/worlds/${world}/insights/closed`, body, starter });
  termAnswer(answer, asked);
}
