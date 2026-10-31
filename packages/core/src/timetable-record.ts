// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the timetable's signed records on a teacher's channel share (#577,
// #578, answers 605 and 606): a teacher's part, a teacher's proposal and the
// decision on it each travel as a record naming its format, its canonical JSON
// text, a signature and the certificate of the key that signed. The signature
// covers the text behind a line naming the format, the world and the
// certificate's subject, key and serial, so a text signed for one format is
// never read as another's. A record is read only when its text is canonical,
// its certificate is the world CA's and its signature checks; names hold no
// hidden characters and are at most 80 characters long.

import { canonicalJson } from './canonical.ts';
import { checkCertificate, isCertificate, type Certificate, type KeyChecker } from './certify.ts';
import { channelSealing, channelStream, type JoinCode } from './school-join.ts';
import type { Place } from './sealed-stream.ts';
import type { WorldMac } from './world-keys.ts';

/** The most characters a name may take. */
export const NAME_MOST = 80;
/** Characters a name may not hold: controls, format and direction marks, lone surrogates and line breaks. */
export const HIDDEN = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;
/** The minutes in a day. */
export const DAY_MINUTES = 24 * 60;

/** The world CA's key and what checks a signature. */
export type TimetableCa = { readonly key: string; readonly checker: KeyChecker };

/** Whether a value is a plain object. */
export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
/** Whether a value is a name: at most `most` characters, none hidden, and not blank unless `empty`. */
export const named = (value: unknown, empty = false, most = NAME_MOST): value is string =>
  typeof value === 'string' && value.length <= most && (empty || value.trim() !== '') && !HIDDEN.test(value);
/** A name as a record carries it: format marks dropped, as the timetable's name key drops them, breaks as spaces. */
export const clean = (name: string) =>
  name
    .replace(/[\p{Cf}\p{Cs}]/gu, '')
    .replace(/[\p{Zl}\p{Zp}\p{Cc}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
/** Whether a value is a whole number from `least` to `most`. */
export const whole = (value: unknown, least: number, most: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= least && (value as number) <= most;

/** The text a record's signature covers. */
export function signedLine(format: string, certificate: Certificate, text: string): string {
  const { world, subject, publicKey, serial } = certificate;
  return `${format}\n${world}\n${subject}\n${publicKey}\n${serial}\n${text}`;
}

/** A code's channel, where its teacher's records go. */
export async function placeOfCode(code: JoinCode, mac: WorldMac): Promise<Place> {
  return { stream: await channelStream(code, mac), sealing: await channelSealing(code, mac) };
}

/** A text's JSON value, or undefined when it holds none. */
function parsedText(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * A record of a format as read from a channel: its parsed, canonical text,
 * signed by a key the world's CA certified, or null; `shaped` says whether
 * the parsed text is of the format's shape.
 */
export async function signedRecord<T>(
  value: unknown,
  format: string,
  shaped: (parsed: unknown) => parsed is T,
  world: string,
  ca: TimetableCa,
): Promise<{
  readonly value: T;
  readonly text: string;
  readonly signature: string;
  readonly certificate: Certificate;
} | null> {
  if (!record(value) || value.format !== format) return null;
  const { text, signature, certificate } = value;
  if (typeof text !== 'string' || typeof signature !== 'string' || !isCertificate(certificate)) return null;
  const parsed = parsedText(text);
  if (!shaped(parsed) || canonicalJson(parsed) !== text) return null;
  if (!(await checkCertificate(certificate, world, ca.key, ca.checker))) return null;
  const holds = await ca.checker
    .verify(certificate.publicKey, signedLine(format, certificate, text), signature)
    .catch(() => false);
  return holds ? { value: parsed, text, signature, certificate } : null;
}
