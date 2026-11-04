// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An exam committee's cut above the school (#604, #605, R-7.10-18, R-7.10-20,
// answers 33, 631 and 638): a directorate's exams go to its committee of three
// and the national exams to the Ministry's of five, a committee for each exam,
// subject and grade. Its room is a stream of the directorate's or the national
// space, its key derived from the world's sealing key, so the server reads
// nothing; every device of a demo world holds that key, so that only the
// committee and the exams office see a cut before the exam is the pages' rule,
// a known limit of a world played by whoever holds its code. Each seat signs
// with a key its seed gives, also derived from the sealing key. A seat's vote
// names a plan item, or none for no cut, the day it was signed and its version,
// counted from 0, so its highest counts, the lower text breaking a tie, and an
// older vote put again never wins; an item it names is of the plan. A vote
// counts only when dated from the figures day to the signing deadline as they
// are given, the day being its seat's own word, and the days the reader's
// calendar's, so a moved exam can change what counted and a reader on an older
// calendar can differ, known limits, as is a server withholding a seat's newer
// vote from one reader. The system never sets a cut: the first time a majority
// of the seats name the same item, that item is adopted, or, when they name
// none, no cut is, and that is final; until then the cut proposed is the item
// most seats name, the one first named at any time when they tie, and with no
// majority by the deadline no cut was adopted and the paper is set as usual.

import type { SealedBatch } from './batches.ts';
import { canonicalJson } from './canonical.ts';
import { compareDays, isDay, type Day } from './day.ts';
import { EXAM_ID } from './exam-chart.ts';
import { ITEM_ID } from './pack-fields.ts';
import { ENTRY_ID } from './reference-fields.ts';
import { ascii } from './school-key-shape.ts';
import { openRecords, placeOf, sealRecord, type Place } from './sealed-stream.ts';
import type { Verifier } from './signed-read.ts';
import { parsedText, record } from './timetable-record.ts';
import { isWorldId } from './world-code.ts';
import type { WorldCipher, WorldMac, WorldSigner } from './world-keys.ts';

export const COMMITTEE_VOTE = 'minhajna/committee-vote/1';
/** The seats of each level's committee. */
export const COMMITTEE_SEATS = { directorate: 3, national: 5 } as const;
/** The space of the national exams' committees, in a committee's name. */
export const NATIONAL_COMMITTEE = 'national';
/** How many seats a committee has, by its level. */
export const committeeSeats = (name: Pick<CommitteeName, 'scope'>): number =>
  name.scope === NATIONAL_COMMITTEE ? COMMITTEE_SEATS.national : COMMITTEE_SEATS.directorate;
/** The most batches a vote takes. */
export const VOTE_BATCHES = 2;
const SCOPE = new RegExp(`^(?:${NATIONAL_COMMITTEE}|[a-z]+-[1-9][0-9]{0,5})$`, 'u');
const NAME_FIELDS = ['world', 'scope', 'exam', 'subject', 'grade'] as const;
const VOTE_FIELDS = NAME_FIELDS.length + 4;

/** What names a committee: the world, the directorate or the nation, the exam, the subject and the grade. */
export interface CommitteeName {
  readonly world: string;
  readonly scope: string;
  readonly exam: string;
  readonly subject: string;
  readonly grade: string;
}

/** A seat's vote: the last item the paper covers, or null for no cut. */
export interface CommitteeVote extends CommitteeName {
  readonly seat: number;
  readonly item: string | null;
  readonly day: Day;
  readonly version: number;
}

/** A vote as its room carries it. */
export interface SignedVote {
  readonly text: string;
  readonly signature: string;
}

/** What reading a committee's votes needs: its name, each seat's public key, and the plan's items. */
export interface VoteRoom {
  readonly name: CommitteeName;
  readonly seats: readonly string[];
  readonly items: ReadonlySet<string>;
}

/** The days a vote counts on, from the figures day to the signing deadline. */
export interface VoteDays {
  readonly from: Day;
  readonly to: Day;
}

/** Where a committee stands: each seat's vote that counts, the cut proposed and the cut adopted. */
export interface CommitteeState {
  readonly votes: ReadonlyMap<number, CommitteeVote>;
  /** The item most seats name, with those seats, or null. */
  readonly proposed: { readonly item: string; readonly seats: readonly number[] } | null;
  /** The cut adopted, null for no cut, with its seats and the latest of their days; null while none is. */
  readonly adopted: { readonly item: string | null; readonly seats: readonly number[]; readonly day: Day } | null;
  /** How many seats adopt a cut. */
  readonly majority: number;
}

/** Whether a value names a committee. */
export function isCommitteeName(value: unknown): value is CommitteeName {
  if (!record(value)) return false;
  const { world, scope, exam, subject, grade } = value;
  return (
    isWorldId(world) &&
    typeof scope === 'string' &&
    SCOPE.test(scope) &&
    typeof exam === 'string' &&
    EXAM_ID.test(exam) &&
    typeof subject === 'string' &&
    ENTRY_ID.test(subject) &&
    typeof grade === 'string' &&
    ENTRY_ID.test(grade)
  );
}

/** A secret of a committee for a purpose, from the world's sealing key. */
export const committeeSecret = (sealing: Uint8Array, name: CommitteeName, purpose: string, mac: WorldMac) => {
  if (!isCommitteeName(name)) throw new RangeError('A committee is named in its world');
  const { scope, exam, subject, grade } = name;
  return mac(sealing, ascii(`minhajna/committee/${purpose}\n${scope}\n${exam}\n${subject}\n${grade}`));
};

/** Where a committee's votes go. */
export async function committeePlace(sealing: Uint8Array, name: CommitteeName, mac: WorldMac): Promise<Place> {
  return placeOf(await committeeSecret(sealing, name, 'room', mac), 'committee-room', mac);
}

/** The seed of a seat's signing key. */
export async function seatSeed(
  sealing: Uint8Array,
  name: CommitteeName,
  seat: number,
  mac: WorldMac,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(seat) || seat < 0) throw new RangeError('A seat is counted from 0');
  return committeeSecret(sealing, name, `seat-${seat}`, mac);
}

const signedText = (text: string) => `${COMMITTEE_VOTE}\n${text}`;

/** A vote signed with its seat's key. */
export async function signVote(vote: CommitteeVote, pkcs8: string, sign: WorldSigner): Promise<SignedVote> {
  if (!isCommitteeVote(vote)) throw new RangeError('Not a committee vote');
  const text = canonicalJson(vote);
  return { text, signature: await sign(pkcs8, signedText(text)) };
}

/** A vote's batches at its committee's place, numbered from `first`. */
export const sealVote = (place: Place, vote: SignedVote, first: number, cipher: WorldCipher): Promise<SealedBatch[]> =>
  sealRecord(place, vote, first, VOTE_BATCHES, cipher);

/** Whether a value is a vote: a committee's name, a seat, an item or none, a day and a version, with those alone. */
export function isCommitteeVote(value: unknown): value is CommitteeVote {
  if (!record(value) || !isCommitteeName(value)) return false;
  const { seat, item, day, version } = value as Record<string, unknown>;
  return (
    Object.keys(value).length === VOTE_FIELDS &&
    Number.isSafeInteger(seat) &&
    (seat as number) >= 0 &&
    (item === null || (typeof item === 'string' && ITEM_ID.test(item))) &&
    typeof day === 'string' &&
    isDay(day) &&
    Number.isSafeInteger(version) &&
    (version as number) >= 0
  );
}

function voteOf(text: string, room: VoteRoom): CommitteeVote | null {
  const value = parsedText(text);
  if (!isCommitteeVote(value) || canonicalJson(value) !== text) return null;
  const same = NAME_FIELDS.every((key) => value[key] === room.name[key]);
  const seated = value.seat < room.seats.length;
  return same && seated && (value.item === null || room.items.has(value.item)) ? value : null;
}

/** The votes of a committee's batches, in order, each signed by the seat it names; the rest is left out. */
export async function readVotes(
  place: Place,
  batches: readonly SealedBatch[],
  room: VoteRoom,
  verify: Verifier,
  cipher: WorldCipher,
): Promise<{ readonly vote: CommitteeVote; readonly signature: string }[]> {
  const found: { readonly vote: CommitteeVote; readonly signature: string }[] = [];
  for (const one of await openRecords(place, batches, VOTE_BATCHES, cipher)) {
    if (!record(one) || typeof one.text !== 'string' || typeof one.signature !== 'string') continue;
    const vote = voteOf(one.text, room);
    if (vote === null) continue;
    const holds = await verify(room.seats[vote.seat]!, signedText(one.text), one.signature).catch(() => false);
    if (holds) found.push({ vote, signature: one.signature });
  }
  return found;
}

/** Each cut with the seats that name it, in the order each was first named. */
function named(votes: ReadonlyMap<number, CommitteeVote>, first: readonly (string | null)[]) {
  return first.map((item) => ({
    item,
    seats: [...votes.values()].filter((one) => one.item === item).map((one) => one.seat),
  }));
}

/** Where a committee of `seats` seats stands, from its votes in their order; a seat beyond them does not count. */
export function committeeState(
  found: readonly { readonly vote: CommitteeVote }[],
  seats: number,
  days: VoteDays,
): CommitteeState {
  const majority = Math.floor(seats / 2) + 1;
  const votes = new Map<number, CommitteeVote>();
  const order: (string | null)[] = [];
  for (const { vote } of found) {
    if (vote.seat >= seats || compareDays(vote.day, days.from) < 0 || compareDays(vote.day, days.to) > 0) continue;
    const held = votes.get(vote.seat);
    const later =
      held === undefined ||
      vote.version > held.version ||
      (vote.version === held.version && canonicalJson(vote) < canonicalJson(held));
    if (!later) continue;
    votes.set(vote.seat, vote);
    if (!order.includes(vote.item)) order.push(vote.item);
    const won = named(votes, order).find((one) => one.seats.length >= majority);
    if (won !== undefined) {
      const day = won.seats
        .map((seat) => votes.get(seat)?.day ?? vote.day)
        .reduce((latest, one) => (compareDays(one, latest) > 0 ? one : latest));
      return { votes, proposed: null, majority, adopted: { item: won.item, seats: won.seats, day } };
    }
  }
  const items = named(votes, order).filter((one): one is { item: string; seats: number[] } => one.item !== null);
  const most = items.reduce<(typeof items)[number] | null>(
    (best, one) => (one.seats.length > (best?.seats.length ?? 0) ? one : best),
    null,
  );
  return { votes, proposed: most, adopted: null, majority };
}
