// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signing in on a staffroom PC (#572, §6.6, answer 602). The PC holds nothing
// of the teacher's: it makes a fresh agreement pair and a one-time secret,
// shows both in a QR code, and reads the drop space the secret names, whose
// ID, stream and sealing key the relay never sees. The teacher's phone puts
// there the session, sealed to the PC's public key, so whoever photographed
// the code reads nothing. Such a person can still seal a session of their own
// to that key, so the phone and the PC each show a short check worked out
// from the sealed answer and the secret, which the person compares before the
// PC opens anything, and two sessions that differ are refused. A security
// key's session waits in a place named by the key's PRF output and the world,
// which the key gives with its PIN on any PC it is used at, and the latest
// session there is the key's. A session names its world, the school, the
// teacher, and each joining code whose channel opens the teacher's records in
// the school's space (answer 581), all different, of its world and one school;
// the security key's carries the signing key its joined record certified as
// well. Names hold no control, format or direction characters, and readers
// keep only sessions of the world they are in.

import type { SealedBatch } from './batches.ts';
import { canonicalJson } from './canonical.ts';
import { isCertificate, type Certificate } from './certify.ts';
import { toHex } from './id.ts';
import { readJoinCode } from './school-join.ts';
import { HOLDER_SECRET } from './school-holder.ts';
import { ascii, fromHex, type KeyCrypto } from './school-key-shape.ts';
import { asciiJson, openRecords, parsedAscii, placeOf, sealRecord } from './sealed-stream.ts';
import { isWorldId } from './world-code.ts';
import { fromBase64Url, PKCS8_TEXT, toBase64Url, type WorldCipher, type WorldMac } from './world-keys.ts';

/** What a staffroom PC's QR code holds before its fields. */
export const PC_QR_PREFIX = 'minhajna-pc:1:';
/** The format of a session, as a record and inside the phone's sealed answer. */
export const PC_SESSION_FORMAT = 'minhajna/pc-session/1';
/** The format of what the phone puts in the PC's drop space: the session, sealed to the PC. */
export const PC_ANSWER_FORMAT = 'minhajna/pc-answer/1';
/** The most batches one session may take; a longer one is never sealed, and a reader stops there. */
export const PC_SESSION_BATCHES = 8;
/** The length of a security key's PRF output, in bytes. */
export const PRF_BYTES = 32;
/** The most joining codes one session carries. */
export const PC_SESSION_JOINS = 12;
/** The most answers a PC opens in its drop space; past them, what else is there is left. */
export const PC_ANSWERS_OPENED = 16;

/** The label the session is sealed to the PC under. */
const INFO = 'minhajna/pc-session-seal/1';
const NAME_MOST = 120;
const HEX = /^(?:[0-9a-f]{2})+$/u;
const HIDDEN = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;

/** What a staffroom PC shows to be signed in: its public key, in hex, and its one-time secret. */
export interface PcRequest {
  readonly publicKey: string;
  readonly secret: string;
}

/** A teacher's session on a staffroom PC. */
export interface PcSession {
  readonly world: string;
  readonly schoolName: string;
  readonly teacher: string;
  /** The joining codes' texts, as their QR codes hold them. */
  readonly joins: readonly string[];
  /**
   * A security key's signing key, its PKCS #8 in base64 as the platform
   * writes it, and the certificate its joined record carries; whether the two
   * match, and the certificate's world, is the app's to check.
   */
  readonly signing?: { readonly pkcs8: string; readonly certificate: Certificate };
}

/** A session the PC opened, with the check to compare with the phone's. */
export interface PcAnswer {
  readonly session: PcSession;
  readonly check: string;
}

/** The text of a staffroom PC's QR code. */
export function pcQr(request: PcRequest): string {
  return `${PC_QR_PREFIX}${request.publicKey}:${request.secret}`;
}

/** The request a scanned QR code holds, with a public key of the platform's length, or null. */
export function readPcQr(text: string, publicKeyBytes: number): PcRequest | null {
  if (!text.startsWith(PC_QR_PREFIX)) return null;
  const [publicKey = '', secret = '', ...rest] = text.slice(PC_QR_PREFIX.length).split(':');
  const key = HEX.test(publicKey) && publicKey.length === publicKeyBytes * 2;
  return rest.length === 0 && key && HOLDER_SECRET.test(secret) ? { publicKey, secret } : null;
}

const named = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && value.length <= NAME_MOST && !HIDDEN.test(value);

function signingKey(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const { pkcs8, certificate, ...rest } = value as Record<string, unknown>;
  const key = typeof pkcs8 === 'string' && PKCS8_TEXT.test(pkcs8);
  return Object.keys(rest).length === 0 && key && isCertificate(certificate);
}

/** Whether a value is a session: its fields only, named, with different joining codes of its world and one school. */
export function isPcSession(value: unknown): value is PcSession {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const { world, schoolName, teacher, joins, signing, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || !isWorldId(world) || !named(schoolName) || !named(teacher)) return false;
  if (signing !== undefined && !signingKey(signing)) return false;
  if (!Array.isArray(joins) || joins.length === 0 || joins.length > PC_SESSION_JOINS) return false;
  if (new Set(joins).size !== joins.length) return false;
  const codes = joins.map((one) => (typeof one === 'string' ? readJoinCode(one) : null));
  const school = codes[0]?.school;
  return codes.every((code) => code !== null && code.world === world && code.school === school);
}

function sessionOf(record: unknown, world: string): PcSession | null {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) return null;
  const { format, ...session } = record as Record<string, unknown>;
  return format === PC_SESSION_FORMAT && isPcSession(session) && session.world === world ? session : null;
}

function sessionBytes(session: PcSession): Uint8Array {
  if (!isPcSession(session)) throw new RangeError('Not a session');
  return ascii(asciiJson({ format: PC_SESSION_FORMAT, ...session }));
}

function dropKey(secret: string): Uint8Array {
  if (!HOLDER_SECRET.test(secret)) throw new RangeError('Not a one-time secret');
  return fromHex(secret);
}

/** The drop space a staffroom PC opens, as its one-time secret names it, and the stream there. */
export async function pcDrop(
  secret: string,
  mac: WorldMac,
): Promise<{ readonly space: string; readonly stream: string }> {
  const key = dropKey(secret);
  const space = toBase64Url((await mac(key, ascii('minhajna/pc-drop/space'))).subarray(0, 16));
  return { space, stream: (await placeOf(key, 'pc-drop', mac)).stream };
}

/** The check the phone and the PC both show for an answer: 8 hex digits of a MAC over it under the secret. */
async function checkOf(secret: string, sealed: string, mac: WorldMac): Promise<string> {
  return toHex((await mac(dropKey(secret), ascii(`minhajna/pc-drop/check\n${sealed}`))).subarray(0, 4));
}

/** The phone's answer to a PC, the session sealed to the PC's key once, with the check both show. */
export interface SealedAnswer {
  readonly secret: string;
  readonly sealed: string;
  readonly check: string;
}

/**
 * Seals a session to the PC that asked, once: a retry puts the same answer
 * again with pcAnswerBatches, so the check the phone shows stays the one the
 * PC works out. The check is 32 bits, and a session sealed alone by whoever
 * photographed the code would have to match it before the phone showed it.
 */
export async function sealPcAnswer(
  request: PcRequest,
  session: PcSession,
  crypto: KeyCrypto,
  mac: WorldMac,
): Promise<SealedAnswer> {
  if (!HEX.test(request.publicKey) || request.publicKey.length !== crypto.publicKeyBytes * 2) {
    throw new RangeError('Not a PC’s public key');
  }
  const sealed = toBase64Url(await crypto.seal(sessionBytes(session), fromHex(request.publicKey), INFO));
  return { secret: request.secret, sealed, check: await checkOf(request.secret, sealed, mac) };
}

/** The batches of a sealed answer in the PC's drop space, numbered from `first`. */
export async function pcAnswerBatches(
  answer: SealedAnswer,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly space: string; readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  const { space, stream } = await pcDrop(answer.secret, mac);
  const place = await placeOf(dropKey(answer.secret), 'pc-drop', mac);
  const record = { format: PC_ANSWER_FORMAT, sealed: answer.sealed };
  return { space, stream, batches: await sealRecord(place, record, first, PC_SESSION_BATCHES, cipher) };
}

/**
 * The session of the world `world` the PC's drop space holds for it, opened
 * with the PC's own key, with its check; null before one, and 'contested' for
 * two that differ, or when the first PC_ANSWERS_OPENED answers, all that are
 * opened, hold none: either way the PC shows a new code.
 */
export async function readPcAnswer(
  secret: string,
  world: string,
  batches: readonly SealedBatch[],
  crypto: KeyCrypto,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<PcAnswer | null | 'contested'> {
  let found: PcAnswer | null = null;
  let tried = 0;
  const place = await placeOf(dropKey(secret), 'pc-drop', mac);
  for (const one of await openRecords(place, batches, PC_SESSION_BATCHES, cipher)) {
    if (typeof one !== 'object' || one === null || Array.isArray(one)) continue;
    const { format, sealed, ...rest } = one as Record<string, unknown>;
    if (format !== PC_ANSWER_FORMAT || typeof sealed !== 'string' || Object.keys(rest).length > 0) continue;
    if (++tried > PC_ANSWERS_OPENED) return found ?? 'contested';
    const bytes = fromBase64Url(sealed);
    const opened = bytes === null ? null : await crypto.open(bytes, INFO);
    const session = opened === null ? null : sessionOf(parsedAscii(opened), world);
    if (session === null) continue;
    if (found !== null && canonicalJson(found.session) !== canonicalJson(session)) return 'contested';
    found ??= { session, check: await checkOf(secret, sealed, mac) };
  }
  return found;
}

function keyName(prf: Uint8Array, world: string): string {
  if (prf.length !== PRF_BYTES) throw new RangeError('Not a security key’s PRF output');
  if (!isWorldId(world)) throw new RangeError('Not a world');
  return `staff-key/${world}`;
}

/** The space and stream where a security key's session in a world waits, named by the key's PRF output. */
export async function keyPlace(
  prf: Uint8Array,
  world: string,
  mac: WorldMac,
): Promise<{ readonly space: string; readonly stream: string }> {
  const name = keyName(prf, world);
  const space = toBase64Url((await mac(prf, ascii(`minhajna/${name}/space`))).subarray(0, 16));
  return { space, stream: (await placeOf(prf, name, mac)).stream };
}

/** A security key's session at its place in the session's world, numbered from `first`. */
export async function sealKeySession(
  prf: Uint8Array,
  session: PcSession,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly space: string; readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  if (!isPcSession(session)) throw new RangeError('Not a session');
  const { space, stream } = await keyPlace(prf, session.world, mac);
  const place = await placeOf(prf, keyName(prf, session.world), mac);
  const record = { format: PC_SESSION_FORMAT, ...session };
  return { space, stream, batches: await sealRecord(place, record, first, PC_SESSION_BATCHES, cipher) };
}

/** The latest session of the world `world` a security key's place holds, or null when none reads there. */
export async function readKeySession(
  prf: Uint8Array,
  world: string,
  batches: readonly SealedBatch[],
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<PcSession | null> {
  const place = await placeOf(prf, keyName(prf, world), mac);
  const sessions = (await openRecords(place, batches, PC_SESSION_BATCHES, cipher)).map((one) => sessionOf(one, world));
  return sessions.filter((one) => one !== null).at(-1) ?? null;
}
