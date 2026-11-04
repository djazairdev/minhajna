// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How a committee's cut shaped the exam, in its own words (#606, R-7.10-21,
// answer 640), published unchanged with the cut: a stream of its own in the
// committee's space, under a key derived from the world's sealing key, as its
// votes are (cuts.ts). A seat signs the words with its key, naming the
// committee, the seat, the day and a version counted from 0 over the committee,
// so the highest counts, the lower text breaking a tie, and older words put
// again never win. Only a seat that adopted the cut has the words, and only on
// a day after the exam's last, the day being its seat's own word, as a vote's
// is; words about no cut do not count, nor when no cut was adopted. The words
// are of 1 to 600 characters, none a control character, trimmed already, in
// NFC.

import type { SealedBatch } from './batches.ts';
import { canonicalJson } from './canonical.ts';
import { committeeSecret, isCommitteeName, type CommitteeName, type CommitteeState } from './cuts.ts';
import { compareDays, isDay, type Day } from './day.ts';
import { openRecords, placeOf, sealRecord, type Place } from './sealed-stream.ts';
import type { Verifier } from './signed-read.ts';
import { HIDDEN, parsedText, record } from './timetable-record.ts';
import type { WorldCipher, WorldMac, WorldSigner } from './world-keys.ts';

export const COMMITTEE_WORDS = 'minhajna/committee-words/1';
/** The most characters a committee's words take. */
export const WORDS_LENGTH = 600;
/** The most batches a committee's words take. */
export const WORDS_BATCHES = 3;
const FIELDS = 9;

/** A seat's words on how the cut shaped the exam. */
export interface CommitteeWords extends CommitteeName {
  readonly seat: number;
  readonly words: string;
  readonly day: Day;
  readonly version: number;
}

/** Words as their stream carries them. */
export interface SignedWords {
  readonly text: string;
  readonly signature: string;
}

/** What reading a committee's words needs: its name and each seat's public key. */
export interface WordsRoom {
  readonly name: CommitteeName;
  readonly seats: readonly string[];
}

/** Whether a committee's words read: one to 600 characters, none a control or hidden one, trimmed, in NFC. */
export function wordsRead(words: unknown): words is string {
  return (
    typeof words === 'string' &&
    words.length >= 1 &&
    [...words].length <= WORDS_LENGTH &&
    !HIDDEN.test(words) &&
    words === words.trim() &&
    words === words.normalize('NFC')
  );
}

/** Whether a value is a committee's words: a name, a seat, the words, a day and a version, with those alone. */
export function isCommitteeWords(value: unknown): value is CommitteeWords {
  if (!record(value) || !isCommitteeName(value)) return false;
  const { seat, words, day, version } = value as Record<string, unknown>;
  return (
    Object.keys(value).length === FIELDS &&
    Number.isSafeInteger(seat) &&
    (seat as number) >= 0 &&
    wordsRead(words) &&
    typeof day === 'string' &&
    isDay(day) &&
    Number.isSafeInteger(version) &&
    (version as number) >= 0
  );
}

/** Where a committee's words go. */
export async function wordsPlace(sealing: Uint8Array, name: CommitteeName, mac: WorldMac): Promise<Place> {
  return placeOf(await committeeSecret(sealing, name, 'words', mac), 'committee-words', mac);
}

const signedText = (text: string) => `${COMMITTEE_WORDS}\n${text}`;

/** Words signed with their seat's key. */
export async function signWords(words: CommitteeWords, pkcs8: string, sign: WorldSigner): Promise<SignedWords> {
  if (!isCommitteeWords(words)) throw new RangeError('Not a committee’s words');
  const text = canonicalJson(words);
  return { text, signature: await sign(pkcs8, signedText(text)) };
}

/** Words' batches at their place, numbered from `first`. */
export const sealWords = (
  place: Place,
  words: SignedWords,
  first: number,
  cipher: WorldCipher,
): Promise<SealedBatch[]> => sealRecord(place, words, first, WORDS_BATCHES, cipher);

function wordsOf(text: string, room: WordsRoom): CommitteeWords | null {
  const value = parsedText(text);
  if (!isCommitteeWords(value) || canonicalJson(value) !== text) return null;
  const same = (['world', 'scope', 'exam', 'subject', 'grade'] as const).every((key) => value[key] === room.name[key]);
  return same && value.seat < room.seats.length ? value : null;
}

/** The words of a committee's batches, in order, each signed by the seat it names; the rest is left out. */
export async function readWords(
  place: Place,
  batches: readonly SealedBatch[],
  room: WordsRoom,
  verify: Verifier,
  cipher: WorldCipher,
): Promise<{ readonly words: CommitteeWords; readonly signature: string }[]> {
  const found: { readonly words: CommitteeWords; readonly signature: string }[] = [];
  for (const one of await openRecords(place, batches, WORDS_BATCHES, cipher)) {
    if (!record(one) || typeof one.text !== 'string' || typeof one.signature !== 'string') continue;
    const words = wordsOf(one.text, room);
    if (words === null) continue;
    const holds = await verify(room.seats[words.seat]!, signedText(one.text), one.signature).catch(() => false);
    if (holds) found.push({ words, signature: one.signature });
  }
  return found;
}

/** The words that count, of a seat that adopted the cut and dated after `lastDay`, or null. */
export function wordsThatCount(
  found: readonly { readonly words: CommitteeWords }[],
  state: Pick<CommitteeState, 'adopted'>,
  lastDay: Day,
): CommitteeWords | null {
  const { adopted } = state;
  if (adopted === null || adopted.item === null) return null;
  let best: CommitteeWords | null = null;
  for (const { words } of found) {
    if (!adopted.seats.includes(words.seat) || compareDays(words.day, lastDay) <= 0) continue;
    const later =
      best === null ||
      words.version > best.version ||
      (words.version === best.version && canonicalJson(words) < canonicalJson(best));
    if (later) best = words;
  }
  return best;
}
