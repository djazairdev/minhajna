// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school exam's cut room for a subject and grade (#601, answer 632): a stream
// of the school's space whose key is derived from the school key's epoch for
// the exam, subject and grade, so every key holder finds the same room, and is
// handed to each setter on their channel, signed by a key holder's device, with
// the epoch and the decider's key, so the setters read and write the room
// directly. The decider's signing key comes from a seed derived from the same
// epoch, so every key holder signs with it and no setter can: it alone signs
// the chart and the director's decisions, so a setter can forge neither,
// whoever writes the room first. A director reads a room through the rooms
// handed on its setters' channels, so a rekey after the figures day keeps it,
// keeping one only when its key and decider are those its own school key
// derives for that epoch, since a setter writes their own channel. The room
// holds the chart (exam-chart.ts), the setters' cuts and the director's
// decision, each signed with the key its certificate names, of the room's
// world, behind a line naming the record's format, as the timetable's records
// are (timetable-record.ts). Reading keeps the room's first chart the decider
// signed, and after it the cuts a setter the chart names signed and the
// decisions the decider signed, each naming the room. A cut or a decision names
// an item of the chart, or none for no cut, the day it was signed, and its
// version, counted from 0 for each setter's cuts; the first decision once it
// falls to the director is final whatever its version.

import type { SealedBatch } from './batches.ts';
import { canonicalJson } from './canonical.ts';
import { isSigningKey, type Certificate, type KeySigner } from './certify.ts';
import { isDay, type Day } from './day.ts';
import { EXAM_CHART_FORMAT, isExamChart, isRoomName, type ExamChart, type RoomName } from './exam-chart.ts';
import { toHex } from './id.ts';
import type { Joined, JoinCode } from './school-join.ts';
import { purposeKey, type KeyCrypto, type OpenedKeyring } from './school-key.ts';
import { ascii, fromHex } from './school-key-shape.ts';
import { openRecords, placeOf, sealRecord, type Place } from './sealed-stream.ts';
import { onChannel } from './timetable-package.ts';
import { CHANNEL, onChannelShape, placeOfCode, record, signedLine, signedRecord, whole } from './timetable-record.ts';
import { signedTimetable, type OnChannel, type SignedTimetable, type TimetableCa } from './timetable-record.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

export const EXAM_ROOM_FORMAT = 'minhajna/exam-room/1';
export const EXAM_CUT_FORMAT = 'minhajna/exam-cut/1';
export const EXAM_DECISION_FORMAT = 'minhajna/exam-decision/1';
/** The most batches a room's record takes. */
export const ROOM_BATCHES = 48;
const KEY = /^[0-9a-f]{64}$/u;

/** A room handed to a setter on their channel: its name, the school key's epoch, its key and its decider's key. */
export interface ExamRoom extends OnChannel {
  readonly exam: string;
  readonly subject: string;
  readonly grade: string;
  readonly epoch: number;
  readonly key: string;
  readonly decider: string;
}

/** A setter's cut, or the director's decision: the last item the paper covers, or null for no cut. */
export interface ExamCut extends RoomName {
  readonly item: string | null;
  readonly day: Day;
  /** Counted from 0 for each setter's cuts, so an older cut put again never wins; a decision's is not read. */
  readonly version: number;
}

/** A record as the room carries it. */
export type SignedRoom<T> = SignedTimetable<T>;

export function isExamRoom(value: unknown): value is ExamRoom {
  const fields = [...CHANNEL, 'exam', 'subject', 'grade', 'epoch', 'key', 'decider'];
  if (!record(value) || !onChannelShape(value, fields)) return false;
  const { world, school, exam, subject, grade, epoch, key, decider } = value;
  const keyed = typeof key === 'string' && KEY.test(key) && isSigningKey(decider);
  return isRoomName({ world, school, exam, subject, grade }) && whole(epoch, 0, 999_999_999) && keyed;
}

export function isExamCut(value: unknown): value is ExamCut {
  if (!isRoomName(value, ['item', 'day', 'version'])) return false;
  const { item, day, version } = value as unknown as ExamCut;
  return (item === null || typeof item === 'string') && isDay(day) && whole(version, 0, 999_999_999);
}

/** The room's key, from the school key's epoch, for its exam, subject and grade. */
export async function roomKey(
  opened: OpenedKeyring,
  epoch: number,
  name: Pick<RoomName, 'exam' | 'subject' | 'grade'>,
  crypto: KeyCrypto,
): Promise<Uint8Array> {
  const cuts = await purposeKey(opened, epoch, 'exam-cut', crypto);
  return crypto.mac(cuts, ascii(`minhajna/exam-cut/room\n${name.exam}\n${name.subject}\n${name.grade}`));
}

/** The seed of the room's decider's signing key, from the school key's epoch: no setter can make it. */
export async function deciderSeed(
  opened: OpenedKeyring,
  epoch: number,
  name: Pick<RoomName, 'exam' | 'subject' | 'grade'>,
  crypto: KeyCrypto,
): Promise<Uint8Array> {
  const cuts = await purposeKey(opened, epoch, 'exam-cut', crypto);
  return crypto.mac(cuts, ascii(`minhajna/exam-cut/decider\n${name.exam}\n${name.subject}\n${name.grade}`));
}

/** Where a room's records go. */
export const roomPlace = (key: Uint8Array, mac: WorldMac): Promise<Place> => placeOf(key, 'exam-cut', mac);

/** The room handed to a setter, signed on a key holder's device. */
export const signRoom = (room: ExamRoom, certificate: Certificate, signer: KeySigner) =>
  signedTimetable(room, isExamRoom, EXAM_ROOM_FORMAT, certificate, signer);

/** A signed room's batches on its own code's channel, numbered from `first`. */
export async function sealRoom(
  code: JoinCode,
  signed: SignedRoom<ExamRoom>,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  const { value, text, signature, certificate } = signed;
  if (!onChannel(value, code)) throw new RangeError('A room goes on its own code’s channel');
  const place = await placeOfCode(code, mac);
  const sealed = { format: EXAM_ROOM_FORMAT, text, signature, certificate };
  return { stream: place.stream, batches: await sealRecord(place, sealed, first, ROOM_BATCHES, cipher) };
}

/** The rooms handed on a code's channel, in its order, each signed by a key other than the joined device's. */
export async function channelRooms(
  code: JoinCode,
  batches: readonly SealedBatch[],
  ca: TimetableCa,
  joined: Joined | null,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<ExamRoom[]> {
  const rooms: ExamRoom[] = [];
  for (const value of await openRecords(await placeOfCode(code, mac), batches, ROOM_BATCHES, cipher)) {
    const read = await signedRecord(value, EXAM_ROOM_FORMAT, isExamRoom, code.world, ca);
    if (read === null || !onChannel(read.value, code)) continue;
    if (joined !== null && read.certificate.publicKey === joined.certificate.publicKey) continue;
    rooms.push(read.value);
  }
  return rooms;
}

/** A room's key in hex, as a handed room carries it. */
export const keyText = (key: Uint8Array): string => toHex(key);

/**
 * Whether a handed room is the one the school key derives: its key the room's
 * for its epoch and its decider the public key `publicOf` gives the decider's
 * seed, so a key holder never trusts a room a setter put on their own channel.
 */
export async function isHeldRoom(
  room: ExamRoom,
  opened: OpenedKeyring,
  crypto: KeyCrypto,
  publicOf: (seed: Uint8Array) => string | Promise<string>,
): Promise<boolean> {
  if (opened.keys[room.epoch] === undefined) return false;
  const key = await roomKey(opened, room.epoch, room, crypto);
  return (
    keyText(key) === room.key && (await publicOf(await deciderSeed(opened, room.epoch, room, crypto))) === room.decider
  );
}

/** A room's key as its handed room gives it. */
export const handedKey = (room: ExamRoom): Uint8Array => fromHex(room.key);

const FORMATS = { chart: EXAM_CHART_FORMAT, cut: EXAM_CUT_FORMAT, decision: EXAM_DECISION_FORMAT } as const;

/** A room record of a kind: the holder's chart, a setter's cut or the director's decision. */
export type RoomKind = keyof typeof FORMATS;

/** A chart, cut or decision signed with the key its certificate names, of the record's world. */
export async function signRoomRecord<T extends ExamChart | ExamCut>(
  kind: RoomKind,
  value: T,
  certificate: Certificate,
  signer: KeySigner,
): Promise<{ readonly format: string; readonly signed: SignedRoom<T> }> {
  if (!(kind === 'chart' ? isExamChart(value) : isExamCut(value))) throw new RangeError(`Not a room's ${kind}`);
  if (certificate.publicKey !== signer.publicKey) throw new RangeError('The certificate is for another key');
  if (certificate.world !== value.world) throw new RangeError('The certificate is of another world');
  const text = canonicalJson(value);
  const signature = await signer.sign(signedLine(FORMATS[kind], certificate, text));
  return { format: FORMATS[kind], signed: { value, text, signature, certificate } };
}

/** A signed record's batches in its room, numbered from `first`. */
export async function sealRoomRecord(
  place: Place,
  one: { readonly format: string; readonly signed: SignedRoom<RoomName> },
  first: number,
  cipher: WorldCipher,
): Promise<SealedBatch[]> {
  const { text, signature, certificate } = one.signed;
  return sealRecord(place, { format: one.format, text, signature, certificate }, first, ROOM_BATCHES, cipher);
}

/** A room's records as read: its first chart, then in order the setters' cuts and the director's decisions. */
export interface RoomRecords {
  readonly chart: SignedRoom<ExamChart> | null;
  readonly cuts: readonly { readonly kind: 'cut' | 'decision'; readonly record: SignedRoom<ExamCut> }[];
}

const sameRoom = (a: RoomName, b: RoomName) =>
  a.world === b.world && a.school === b.school && a.exam === b.exam && a.subject === b.subject && a.grade === b.grade;

/**
 * The room's records of its batches that check and name the room: its first
 * chart signed by the decider's key, none of its setters', then the cuts its
 * setters signed and the decisions the decider signed; nothing before the
 * chart counts.
 */
export async function roomRecords(
  place: Place,
  batches: readonly SealedBatch[],
  ca: TimetableCa,
  room: { readonly name: RoomName; readonly decider: string },
  cipher: WorldCipher,
): Promise<RoomRecords> {
  const { name, decider } = room;
  let chart: SignedRoom<ExamChart> | null = null;
  const cuts: { kind: 'cut' | 'decision'; record: SignedRoom<ExamCut> }[] = [];
  for (const value of await openRecords(place, batches, ROOM_BATCHES, cipher)) {
    if (chart === null) {
      const read = await signedRecord(value, EXAM_CHART_FORMAT, isExamChart, name.world, ca);
      const setter = read?.value.setters.some((one) => one.key === decider);
      if (read?.certificate.publicKey === decider && sameRoom(read.value, name) && setter === false) chart = read;
      continue;
    }
    const keys = new Set(chart.value.setters.map((one) => one.key));
    const items = new Set(chart.value.items);
    const named = (cut: ExamCut) => sameRoom(cut, name) && (cut.item === null || items.has(cut.item));
    const cut = await signedRecord(value, EXAM_CUT_FORMAT, isExamCut, name.world, ca);
    if (cut !== null && named(cut.value) && keys.has(cut.certificate.publicKey)) {
      cuts.push({ kind: 'cut', record: cut });
      continue;
    }
    const decision = await signedRecord(value, EXAM_DECISION_FORMAT, isExamCut, name.world, ca);
    if (decision?.certificate.publicKey === decider && named(decision.value)) {
      cuts.push({ kind: 'decision', record: decision });
    }
  }
  return { chart, cuts };
}
