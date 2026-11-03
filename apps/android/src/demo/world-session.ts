// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Starting, joining and dating a demo world (#560, choices D2 and D3 of the
// 0.7.0 demo, answers 568 and 572), on whatever device holds the platform's
// cryptography. Starting draws a new code, works out the world's pass and
// sealing key from it, makes the world's stand-in signing key for calendars and
// plan packs, seals it with the world's kind, and sends the world's ID, the
// sealed keys, its date and its announced days to the demo server, which
// answers the starter token once; an ID already taken draws a new code. Joining
// works out the same secrets from the code typed, reads the sealed keys and the
// date, and opens them. A new world's date is the first term's end in the
// bundled calendar, and its announced days each later term's end and each exam
// window's first day (answer 36), as a published calendar's are (#608).
// Starting and joining give the world's sealing key with its keys, held in
// memory while the world is open. Only the starter token moves the date, to the
// next announced day. Starting and joining need the network shut, and refuse
// with the client's E_NO_WORLD before any slow derivation while a world is
// open; they open it to the world for the first request, and shut it again if
// they fail, unless it has been entered again since. A bundled calendar with no
// term is a fault of the build, a RangeError. The server's and the client's
// errors carry a code: E_WORLD_CODE for a code that does not read,
// E_NO_SUCH_WORLD when no world answers to the code or the world was erased,
// E_WORLD_BUSY with the seconds in retryAfter when the server asks to wait,
// E_WORLD_LEFT_DAYS when no announced day is left, E_WORLD_SERVER for any other
// answer, E_WORLD_KIT when the platform's cryptography fails, or the client's
// own.

import {
  announcedDaysOf,
  isDay,
  makeWorldCode,
  openWorldKeys,
  readWorldCode,
  sealWorldKeys,
  worldSecrets,
  type Day,
  type RandomBytes,
  type SchoolCalendar,
  type Verifier,
  type WorldCipher,
  type WorldKdf,
  type WorldKeys,
  type WorldKind,
  type WorldMac,
  type WorldSecrets,
  type WorldSigner,
} from '@minhajna/core';
import {
  enterWorldNetwork,
  leaveWorldEntry,
  worldNetworkOpen,
  worldRequest,
  type WorldAnswer,
  type WorldRequest,
} from '../network/world-network';

/** The platform's cryptography a world needs. */
export interface WorldKit {
  readonly random: RandomBytes;
  readonly kdf: WorldKdf;
  readonly mac: WorldMac;
  readonly cipher: WorldCipher;
  readonly sign: WorldSigner;
  readonly verify: Verifier;
  /**
   * A new P-256 pair: its public half as SPKI and its private half as PKCS #8, both DER in base64, with the SHA-256
   * of the SPKI in hex.
   */
  readonly newPair: () => Promise<{ readonly spki: string; readonly pkcs8: string; readonly fingerprint: string }>;
  /**
   * A new P-256 pair for key agreement (answer 595): its public half as the 65-byte uncompressed point, its private
   * half as PKCS #8 DER in base64.
   */
  readonly newAgreement: () => Promise<{ readonly publicKey: Uint8Array; readonly pkcs8: string }>;
  /** The 32-byte ECDH secret of a PKCS #8 private half and another's uncompressed point; one off the curve throws. */
  readonly agree: (pkcs8: string, publicKey: Uint8Array) => Promise<Uint8Array>;
}

export type Send = (request: WorldRequest) => Promise<WorldAnswer>;

export interface StartedWorld {
  readonly code: string;
  readonly keys: WorldKeys;
  readonly date: Day;
  readonly starter: string;
  /** The world's sealing key, held in memory while the world is open and never kept. */
  readonly sealing: Uint8Array;
}

export interface JoinedWorld {
  readonly keys: WorldKeys;
  readonly date: Day;
  /** The world's sealing key, held in memory while the world is open and never kept. */
  readonly sealing: Uint8Array;
}

/** The stand-in for the state's key, which signs a world's calendars and plan packs. */
export const WORLD_SIGNER = 'world-ministry';
const TRIES = 3;
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/u;

/** An error with its code, and the seconds to wait when the server says. */
export function failed(message: string, code: string, retryAfter: number | null = null): Error {
  return Object.assign(new Error(message), retryAfter === null ? { code } : { code, retryAfter });
}

/** The error for an answer the caller did not expect. */
export function unexpected(answer: WorldAnswer): Error {
  if (answer.status === 429) return failed('The demo server asks to wait', 'E_WORLD_BUSY', answer.retryAfter);
  return failed(`The demo server answered ${answer.status}`, 'E_WORLD_SERVER');
}

/** The platform's cryptography, its failures given a code. */
export async function kitStep<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (error) {
    throw failed(`The platform's cryptography failed: ${String(error)}`, 'E_WORLD_KIT');
  }
}

/** Refuses while a world is open, before anything slow. */
function networkShut(): void {
  if (worldNetworkOpen() !== null) throw failed('Another world is open', 'E_NO_WORLD');
}

/** A new world's date and announced days, from the bundled calendar (answer 572). */
export function newWorldDays(calendar: SchoolCalendar): { date: Day; announcedDays: Day[] } {
  const first = calendar.year.terms[0];
  if (first === undefined) throw new RangeError('The calendar has no term');
  return { date: first.to, announcedDays: announcedDaysOf(calendar.year, calendar.entries, first.to) };
}

async function newKeys(world: string, kind: WorldKind, kit: WorldKit): Promise<WorldKeys> {
  const { spki, pkcs8, fingerprint } = await kit.newPair();
  const trusted = {
    id: WORLD_SIGNER,
    holder: {
      ar: 'الوزارة في العالم التجريبي',
      fr: 'Le ministère du monde de démonstration',
      en: 'The demo world’s ministry',
    },
    spki,
    fingerprint,
    signs: ['calendar', 'packs'] as const,
  };
  return { world, kind, trusted: [trusted], private: { [WORLD_SIGNER]: pkcs8 } };
}

function dayOf(body: unknown): Day | null {
  const date = (body as { date?: unknown } | null)?.date;
  return typeof date === 'string' && isDay(date) ? date : null;
}

/** One try at starting: the world started, or null when its ID was taken. */
async function startOnce(
  kind: WorldKind,
  days: { date: Day; announcedDays: Day[] },
  kit: WorldKit,
  send: Send,
): Promise<StartedWorld | null> {
  const code = await kitStep(() => Promise.resolve().then(() => makeWorldCode(kit.random)));
  const secrets: WorldSecrets = await kitStep(() => worldSecrets(code, kit.kdf, kit.mac));
  const keys = await kitStep(() => newKeys(secrets.world, kind, kit));
  const sealed = await kitStep(() => sealWorldKeys(keys, secrets, kit.cipher, kit));
  networkShut();
  const entry = enterWorldNetwork(secrets.world, secrets.pass);
  try {
    const body = { world: secrets.world, sealed, ...days, pass: secrets.pass };
    const answer = await send({ method: 'POST', path: '/worlds', body });
    if (answer.status === 409) {
      leaveWorldEntry(entry);
      return null;
    }
    const starter = (answer.body as { starter?: unknown } | null)?.starter;
    if (answer.status !== 201 || typeof starter !== 'string' || !TOKEN.test(starter)) throw unexpected(answer);
    return { code, keys, date: days.date, starter, sealing: secrets.sealing };
  } catch (error) {
    leaveWorldEntry(entry);
    throw error;
  }
}

/** Starts a world of a kind, with the network open to it; shut again if it fails. */
export async function startWorld(
  kind: WorldKind,
  calendar: SchoolCalendar,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<StartedWorld> {
  networkShut();
  const days = newWorldDays(calendar);
  for (let tries = 0; tries < TRIES; tries += 1) {
    const started = await startOnce(kind, days, kit, send);
    if (started !== null) return started;
  }
  throw failed('Every code drawn was taken', 'E_WORLD_SERVER');
}

/** Joins the world a code names, with the network open to it; shut again if it fails. */
export async function joinWorld(typed: string, kit: WorldKit, send: Send = worldRequest): Promise<JoinedWorld> {
  const read = readWorldCode(typed);
  if ('problem' in read) throw failed(`Not a world code: ${read.problem}`, 'E_WORLD_CODE');
  networkShut();
  const secrets = await kitStep(() => worldSecrets(read.code, kit.kdf, kit.mac));
  networkShut();
  const entry = enterWorldNetwork(secrets.world, secrets.pass);
  try {
    const answer = await send({ method: 'GET', path: `/worlds/${secrets.world}` });
    if (answer.status === 404) throw failed('No world answers to this code', 'E_NO_SUCH_WORLD');
    if (answer.status !== 200) throw unexpected(answer);
    const sealed = (answer.body as { sealed?: unknown } | null)?.sealed;
    const date = dayOf(answer.body);
    const keys = typeof sealed === 'string' ? await kitStep(() => openWorldKeys(sealed, secrets, kit.cipher)) : null;
    if (keys === null || date === null) throw unexpected(answer);
    return { keys, date, sealing: secrets.sealing };
  } catch (error) {
    leaveWorldEntry(entry);
    throw error;
  }
}

/** Moves the open world's date from `current` to its next announced day, with the starter token. */
export async function moveWorldDate(
  world: string,
  starter: string,
  current: Day,
  send: Send = worldRequest,
): Promise<Day> {
  const answer = await send({ method: 'POST', path: `/worlds/${world}/date`, starter });
  if (answer.status === 409) throw failed('No announced day is left', 'E_WORLD_LEFT_DAYS');
  if (answer.status === 404) throw failed('The world was erased', 'E_NO_SUCH_WORLD');
  const date = dayOf(answer.body);
  if (answer.status !== 200 || date === null || date <= current) throw unexpected(answer);
  return date;
}
