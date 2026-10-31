// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's proposal to change their timetable, and the decision on it (#578,
// R-7.4-14, R-7.14-04, answer 606), as signed records on the teacher's own
// channel beside their parts (timetable-record.ts). A proposal moves one
// session of the teacher's part, named by its ID and the part's version, to
// another day, start and end, and room, with an optional note of at most 280
// characters; it counts only when signed by the device that joined on the
// channel, with the key its certificate names. A proposal is named by a MAC of
// its text keyed by the school's space, so the same proposal sent twice is one,
// and one sent again after a decision is that decision's unless its note or
// version differs. A decision names a proposal, says whether it was accepted
// and, if so, the version that publishes it, with an optional note; it counts
// when signed by a key the world's CA certified, neither the joined device's
// subject nor its key, only when it comes after the proposal it names, and,
// when accepted, only once a part signed by the same key at that version holds
// the session the proposal moves, by its class, group, subject and week, at the
// proposed day, times and room. The first decision on a proposal settles it,
// and a later one is left out. Every record names the code's world, school,
// assignment and issue, and one naming another is left out. In the demo the CA
// certifies any device a request names (answer 564), so anyone holding the
// channel's key can have a second key certified and decline a proposal, or
// accept it with a part of their own; the state's CA will bind the deciding key
// to the school.

import type { SealedBatch } from './batches.ts';
import { canonicalJson } from './canonical.ts';
import type { Certificate, KeySigner } from './certify.ts';
import { toHex } from './id.ts';
import type { Joined, JoinCode } from './school-join.ts';
import { ascii, ID, SCHOOL } from './school-key-shape.ts';
import { asciiJson, openRecords, sealRecord } from './sealed-stream.ts';
import { timetableNameKey } from './timetable-import.ts';
import { channelParts, onChannel, PART_BATCHES, type SignedPart } from './timetable-package.ts';
import { DAY_MINUTES, named, placeOfCode, record, signedLine, signedRecord, whole } from './timetable-record.ts';
import type { TimetableCa } from './timetable-record.ts';
import type { PartSession } from './timetable-sessions.ts';
import { sameLesson } from './timetable-version.ts';
import type { Weekday } from './day.ts';
import { isWorldId } from './world-code.ts';
import type { WorldCipher, WorldMac } from './world-keys.ts';

/** The format a proposal's record and signed text carry. */
export const TIMETABLE_PROPOSAL_FORMAT = 'minhajna/timetable-proposal/1';
/** The format a decision's record and signed text carry. */
export const TIMETABLE_DECISION_FORMAT = 'minhajna/timetable-decision/1';
const NOTE_MOST = 280;

interface OnChannel {
  readonly world: string;
  readonly school: string;
  readonly assignment: string;
  readonly issue: number;
}

/** A teacher's proposal to move one session of their part. */
export interface TimetableProposal extends OnChannel {
  /** The version of the part the proposal was made on. */
  readonly version: number;
  /** The ID of the session to move. */
  readonly session: string;
  readonly day: Weekday;
  readonly start: number;
  readonly end: number;
  readonly room: string;
  /** Empty when the teacher wrote none. */
  readonly note: string;
}

/** The decision on a teacher's proposal. */
export interface TimetableDecision extends OnChannel {
  /** The proposal's ID. */
  readonly proposal: string;
  readonly accepted: boolean;
  /** The version that publishes an accepted proposal, or null. */
  readonly version: number | null;
  readonly note: string;
}

/** A record as its channel carries it. */
export interface SignedTimetable<T> {
  readonly value: T;
  readonly text: string;
  readonly signature: string;
  readonly certificate: Certificate;
}

/** A proposal on its channel, with its ID and the decision that settled it, or null while it waits. */
export interface ProposalOnChannel {
  readonly id: string;
  readonly proposal: SignedTimetable<TimetableProposal>;
  readonly decision: SignedTimetable<TimetableDecision> | null;
}

const CHANNEL = ['world', 'school', 'assignment', 'issue'];
const PROPOSAL = [...CHANNEL, 'version', 'session', 'day', 'start', 'end', 'room', 'note'];
const DECISION = [...CHANNEL, 'proposal', 'accepted', 'version', 'note'];

/** Whether a record has these fields only, and names a channel by fields of their shape. */
function onChannelShape(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const { world, school, assignment, issue } = value;
  const fields = Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
  const spaced = typeof school === 'string' && SCHOOL.test(school) && typeof assignment === 'string';
  return fields && isWorldId(world) && spaced && ID.test(assignment) && whole(issue, 1, 999_999_999);
}

/** Whether a value is a teacher's proposal, its fields only, each of its shape. */
export function isTimetableProposal(value: unknown): value is TimetableProposal {
  if (!record(value) || !onChannelShape(value, PROPOSAL) || !whole(value.version, 1, 999_999_999)) return false;
  const { session, day, start, end, room, note } = value;
  if (typeof session !== 'string' || !ID.test(session) || !whole(day, 0, 6) || !named(room, true)) return false;
  return whole(start, 0, DAY_MINUTES) && whole(end, 0, DAY_MINUTES) && start < end && named(note, true, NOTE_MOST);
}

/** Whether a value is a decision on a proposal, its fields only, each of its shape. */
export function isTimetableDecision(value: unknown): value is TimetableDecision {
  if (!record(value) || !onChannelShape(value, DECISION)) return false;
  const { proposal, accepted, version, note } = value;
  const versioned = accepted === true ? whole(version, 1, 999_999_999) : accepted === false && version === null;
  return typeof proposal === 'string' && ID.test(proposal) && versioned && named(note, true, NOTE_MOST);
}

async function signed<T>(
  value: T,
  shaped: (one: unknown) => one is T,
  format: string,
  certificate: Certificate,
  signer: KeySigner,
): Promise<SignedTimetable<T>> {
  if (!shaped(value)) throw new RangeError('Not a timetable record of this kind');
  if (certificate.publicKey !== signer.publicKey) throw new RangeError('The certificate is for another key');
  if (certificate.world !== (value as OnChannel).world) throw new RangeError('The certificate is of another world');
  const text = canonicalJson(value);
  return { value, text, signature: await signer.sign(signedLine(format, certificate, text)), certificate };
}

/** A proposal signed on the teacher's device with the key its joining certificate names. */
export const signProposal = (proposal: TimetableProposal, certificate: Certificate, signer: KeySigner) =>
  signed(proposal, isTimetableProposal, TIMETABLE_PROPOSAL_FORMAT, certificate, signer);

/** A decision signed on the director's device with the key its certificate names. */
export const signDecision = (decision: TimetableDecision, certificate: Certificate, signer: KeySigner) =>
  signed(decision, isTimetableDecision, TIMETABLE_DECISION_FORMAT, certificate, signer);

/** A signed proposal's or decision's batches on its code's channel, numbered from `first`. */
export async function sealTimetableRecord(
  code: JoinCode,
  signedOne: SignedTimetable<TimetableProposal | TimetableDecision>,
  first: number,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<{ readonly stream: string; readonly batches: readonly SealedBatch[] }> {
  const { value, text, signature, certificate } = signedOne;
  if (!onChannel(value, code)) throw new RangeError('A record goes on its own code’s channel');
  const format = isTimetableDecision(value) ? TIMETABLE_DECISION_FORMAT : TIMETABLE_PROPOSAL_FORMAT;
  const place = await placeOfCode(code, mac);
  const sealed = await sealRecord(place, { format, text, signature, certificate }, first, PART_BATCHES, cipher);
  return { stream: place.stream, batches: sealed };
}

/** A proposal's ID: a MAC of its text keyed by the school's space. */
export async function proposalId(school: string, text: string, mac: WorldMac): Promise<string> {
  const made = await mac(ascii(school), ascii(asciiJson(['minhajna/timetable/proposal', text])));
  return toHex(made.subarray(0, 16));
}

/**
 * Whether a part on the channel, signed by the decision's key at its version,
 * holds the proposed session at the proposed day, times and room: a session of
 * the same class, group, subject and week as the one the proposal moves, found
 * by its ID in a part of the proposal's version.
 */
function published(
  parts: readonly SignedPart[],
  decision: SignedTimetable<TimetableDecision>,
  proposal: TimetableProposal,
): boolean {
  const { day, start, end, room, version, session } = proposal;
  const moved = parts
    .filter((one) => one.part.version === version)
    .flatMap((one) => one.part.sessions)
    .find((one) => one.id === session);
  const there = (one: PartSession) =>
    moved !== undefined &&
    sameLesson(one, moved) &&
    one.day === day &&
    one.start === start &&
    one.end === end &&
    timetableNameKey(one.room) === timetableNameKey(room);
  return parts.some(
    (one) =>
      one.certificate.publicKey === decision.certificate.publicKey &&
      one.part.version === decision.value.version &&
      one.part.sessions.some(there),
  );
}

/**
 * The proposals on a code's channel, in its order, each with the first
 * decision that came after it, or null; `joined` is the device that joined on
 * the channel, whose key alone signs a proposal and never a decision, or null
 * when none has. An accepted decision counts only once the part that publishes
 * it is on the channel.
 */
export async function channelProposals(
  code: JoinCode,
  batches: readonly SealedBatch[],
  ca: TimetableCa,
  joined: Joined | null,
  cipher: WorldCipher,
  mac: WorldMac,
): Promise<ProposalOnChannel[]> {
  const found = new Map<
    string,
    { proposal: SignedTimetable<TimetableProposal>; decision: SignedTimetable<TimetableDecision> | null }
  >();
  const parts = await channelParts(code, batches, ca, joined?.device ?? null, cipher, mac);
  for (const value of await openRecords(await placeOfCode(code, mac), batches, PART_BATCHES, cipher)) {
    const proposal = await signedRecord(value, TIMETABLE_PROPOSAL_FORMAT, isTimetableProposal, code.world, ca);
    if (proposal !== null && joined !== null && onChannel(proposal.value, code)) {
      const ours = proposal.certificate.subject === joined.device;
      const id = await proposalId(code.school, proposal.text, mac);
      if (ours && proposal.certificate.publicKey === joined.certificate.publicKey && !found.has(id)) {
        found.set(id, { proposal, decision: null });
      }
      continue;
    }
    const decision = await signedRecord(value, TIMETABLE_DECISION_FORMAT, isTimetableDecision, code.world, ca);
    const settles = decision === null ? undefined : found.get(decision.value.proposal);
    if (decision === null || settles === undefined || settles.decision !== null || !onChannel(decision.value, code))
      continue;
    const { subject, publicKey } = decision.certificate;
    const theirs = subject === joined?.device || publicKey === joined?.certificate.publicKey;
    const holds = !decision.value.accepted || published(parts, decision, settles.proposal.value);
    if (!theirs && holds) settles.decision = decision;
  }
  return [...found].map(([id, one]) => ({ id, ...one }));
}
