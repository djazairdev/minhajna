// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Teachers' proposals to change their timetable, and the director's decision,
// from the director's device in a demo world (#578, D-TT-proposal, R-7.4-14,
// R-7.14-04, answer 606). Reading looks at the channel of every teacher of the
// staff list with a code or key issued, and lists each proposal the joined
// device signed that no decision settled yet, with the teacher's name in the
// staff list. The session it moves is looked up by its ID in the teacher's part
// at the proposal's version, as the core does, and a proposal no part of that
// version holds is gone. The session is then found in the standing version by
// its ID, among that teacher's sessions, and checked against the rest of it:
// the teacher, the class and the room free at the new time (clashesOf), the
// session's length the same, so the class's hours stay as they are, and the
// session not taught to several classes together, whose other rows would stay
// behind. A session that is no longer there, or a move that clashes, changes
// the hours or splits a joint session, can only be declined; but when the
// standing version already holds the move, published by an acceptance whose
// decision did not reach the channel, the acceptance is still to record.
// Deciding holds the school key and reads the proposals again, so one settled
// in the meantime is refused, and an acceptance to publish needs one of the
// first days offered (version-text.ts). Accepting publishes the next version,
// the standing one with that session moved, from the day chosen, to the
// teachers it affects (version-session.ts), and needs the proposing teacher
// among those it affects, checked before anything is kept, and sent their part;
// an acceptance still to record is recorded with the version of the first
// standing part above the proposal's that this device's kept key put there
// holding the move, found as the proposals are read, and publishes again only
// when there is none. Either way the decision, with the director's optional
// note cleaned of hidden characters and kept to 280, is signed by this device's
// key and put on the teacher's channel, where the first decision settles the
// proposal. As the key is kept in memory only, for the last world it sent in
// (send-session.ts), an acceptance whose decision did not reach the channel is
// finished while this device keeps its key for this world; once a reload or
// another world makes a new key, it is refused before anything is kept. Errors
// carry world-session.ts's codes, those of holding the school key,
// E_TIMETABLE_PROPOSAL for an acceptance refused, and E_TIMETABLE_DECIDED for a
// proposal no longer waiting.

import {
  channelParts,
  channelProposals,
  channelStream,
  clashesOf,
  cleanRecordText,
  keptIssues,
  keptVersions,
  nextVersion,
  readJoined,
  sameLesson,
  sealTimetableRecord,
  sessionId,
  signDecision,
  standingVersion,
  jointRows,
  timetableNameKey,
  type BellTimes,
  type Day,
  type DemoSchool,
  type ImportedSession,
  type KeptIssue,
  type PartSession,
  type SignedPart,
  type TimetableProposal,
  type TimetablePublished,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { assignmentsOf, holdSchool, joinCode, type IssueDesk } from '../director/issue-session';
import { worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';
import { keptSigning, putOnChannel, signingKey } from './send-session';
import { affected, draftVersion, publishVersion, type SentParts } from './version-session';
import { startDays } from './version-text';

type ProposalWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;
type Staff = Pick<DemoSchool, 'name' | 'teachers'>;

/** How long a decision's note may be, in UTF-16 units, as the core counts it. */
const NOTE_MOST = 280;

/** What a move meets at its new time: the teacher, the class or the room already taken. */
export type Clash = 'teacher' | 'class' | 'room';

/** A proposal no decision settled yet, checked against the standing version. */
export interface WaitingProposal {
  readonly id: string;
  /** The teacher's name in the staff list. */
  readonly teacher: string;
  readonly issue: KeptIssue;
  readonly proposal: TimetableProposal;
  /** The session the proposal moves, as the teacher's part at its version holds it, or null when none does. */
  readonly original: PartSession | null;
  /** The parts the teacher's channel holds. */
  readonly held: readonly SignedPart[];
  /** The session's place among the standing version's sessions, or -1 when it is not there. */
  readonly at: number;
  /** The session as the standing version keeps it, and as the proposal moves it, or null. */
  readonly now: ImportedSession | null;
  readonly moved: ImportedSession | null;
  readonly clashes: readonly Clash[];
  /** Whether the session keeps its length, so the class's hours stay the same. */
  readonly hours: boolean;
  /** Whether the session is taught to several classes together, so moving its row alone would split it. */
  readonly joint: boolean;
  /** Whether the standing version already holds the move, an acceptance whose decision is still to record. */
  readonly published: boolean;
  /** The version an acceptance still to record is recorded with, when this device's kept key put the move there. */
  readonly recordable: number | null;
}

/** The proposals waiting, with the standing version they are checked against and the next version's number. */
export interface Proposals {
  readonly standing: TimetablePublished | null;
  readonly version: number;
  readonly waiting: readonly WaitingProposal[];
}

/** What a decision did: the version that publishes an acceptance, and who was sent a version, or null. */
export interface Decided {
  readonly version: number | null;
  readonly sent: SentParts | null;
}

/** Whether a proposal may be accepted: still to record, or its session found, no clash, hours kept, not joint. */
export const acceptable = (one: WaitingProposal) =>
  one.published || (one.moved !== null && one.clashes.length === 0 && one.hours && !one.joint);

/** Whether a session sits at the proposal's day, times and room. */
const atSlot = (one: { day: number; start: number; end: number; room: string }, proposal: TimetableProposal) =>
  one.day === proposal.day &&
  one.start === proposal.start &&
  one.end === proposal.end &&
  timetableNameKey(one.room) === timetableNameKey(proposal.room);

/** A note cleaned of hidden characters and kept to the most a decision carries, whole characters only. */
function noteOf(text: string): string {
  const points = [...cleanRecordText(text)];
  while (points.join('').length > NOTE_MOST) points.pop();
  return points.join('');
}

/** The proposals waiting on the channels of the school's teachers. */
export async function readProposals(
  world: ProposalWorld,
  school: Staff,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<Proposals> {
  return readWith(world, await holdSchool(world, kit, send, false), school, kit, send);
}

async function readWith(world: ProposalWorld, desk: IssueDesk, school: Staff, kit: WorldKit, send: Send) {
  const kept = await (keptSigning(world.world, desk) ?? Promise.resolve(null)).catch(() => null);
  const space = desk.held.school;
  const versions = keptVersions(world.book.entries, space);
  const standing = standingVersion(versions);
  const sessions = (standing?.sessions ?? []).map((one, at) => ({ ...one, row: at + 1 }));
  const ids = await kitStep(() => Promise.all(sessions.map((one) => sessionId(space, one, kit.mac))));
  const assigned = await assignmentsOf(desk, school.teachers, kit);
  const teacherOf = new Map([...assigned].map(([id, assignment]) => [assignment, id]));
  const [ca, batches] = [await caKey(world.world, send), await spaceBatches(world.world, space, send)];
  const checker = { key: ca, checker: kit };
  const waiting: WaitingProposal[] = [];
  for (const issue of keptIssues(world.book.entries, space).values()) {
    const person = school.teachers.find((one) => one.id === teacherOf.get(issue.assignment));
    if (person === undefined) continue;
    const code = await joinCode(world.world, desk, issue);
    const theirs = batches.get(await kitStep(() => channelStream(code, kit.mac))) ?? [];
    const joined = await kitStep(() => readJoined(code, theirs, checker, kit.cipher, kit.mac));
    const found = await kitStep(() => channelProposals(code, theirs, checker, joined, kit.cipher, kit.mac));
    const device = joined?.device ?? null;
    const held = await kitStep(() => channelParts(code, theirs, checker, device, kit.cipher, kit.mac));
    const names = new Set([person.name, person.latinName].map(timetableNameKey).filter((one) => one !== ''));
    const mine = (one: ImportedSession) => names.has(timetableNameKey(one.teacher));
    for (const { id, proposal, decision } of found) {
      if (decision !== null) continue;
      const { session, version, day, start, end, room } = proposal.value;
      const parts = held.filter((one) => one.part.version === version).flatMap((one) => one.part.sessions);
      const original = parts.find((one) => one.id === session) ?? null;
      const at = original === null ? -1 : sessions.findIndex((one, place) => ids[place] === session && mine(one));
      const now = at < 0 ? null : sessions[at];
      const moved = now === null ? null : { ...now, day, start, end, room, row: 0 };
      const others = sessions.filter((_, place) => place !== at);
      const clashes = (moved === null ? [] : clashesOf(others, moved)).flatMap((one) =>
        one.kind === 'teacher' || one.kind === 'class' || one.kind === 'room' ? [one.kind] : [],
      );
      const hours = now !== null && now.end - now.start === end - start;
      const joint = now !== null && others.some((one) => jointRows(one, now));
      const lesson = (one: ImportedSession) => original !== null && sameLesson({ ...one, id: original.id }, original);
      const published = now === null && sessions.some((one) => mine(one) && lesson(one) && atSlot(one, proposal.value));
      const holding = (one: PartSession) =>
        original !== null && sameLesson(one, original) && atSlot(one, proposal.value);
      const ours = held.filter((one) => one.certificate.publicKey === kept?.certificate.publicKey && !one.part.once);
      const above = ours.filter((one) => one.part.version > version && one.part.sessions.some(holding));
      const recordable = published ? (above[0]?.part.version ?? null) : null;
      const teacher = person.name;
      waiting.push({
        id,
        teacher,
        issue,
        proposal: proposal.value,
        original,
        held,
        at,
        now,
        moved,
        clashes,
        hours,
        joint,
        published,
        recordable,
      });
    }
  }
  return { standing, version: nextVersion(versions), waiting };
}

/**
 * Decides a proposal: when accepted, publishes the next version from `from`
 * with its session moved, or records an acceptance still to record, then puts
 * the decision, signed by this device, on the teacher's channel.
 */
export async function decideProposal(
  world: ProposalWorld,
  school: Staff,
  id: string,
  choice: { readonly accepted: boolean; readonly note: string; readonly from: Day },
  bells: BellTimes,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<Decided> {
  const desk = await holdSchool(world, kit, send, false);
  const fresh = await readWith(world, desk, school, kit, send);
  const one = fresh.waiting.find((waiting) => waiting.id === id);
  if (one === undefined) throw failed('The proposal is no longer waiting', 'E_TIMETABLE_DECIDED');
  const ca = await caKey(world.world, send);
  const key = await signingKey(world.world, desk, ca, kit, send);
  let sent: SentParts | null = null;
  let version: number | null = null;
  if (choice.accepted) {
    const { standing } = fresh;
    const offered = standing === null ? [] : startDays(world.date, standing.from);
    if (!acceptable(one) || standing === null || (!one.published && !offered.includes(choice.from))) {
      throw failed('The move cannot be accepted', 'E_TIMETABLE_PROPOSAL');
    }
    version = one.recordable;
    if (version === null) {
      const sessions = standing.sessions.map((kept, at) => ({
        ...(at === one.at && one.moved !== null ? one.moved : kept),
        row: at + 1,
      }));
      const draft = await draftVersion(world, school, sessions, bells, kit, send);
      const theirs = draft.teachers.find((teacher) => teacher.issue.assignment === one.issue.assignment);
      if (theirs === undefined || !affected(theirs))
        throw failed('The teacher would not be sent', 'E_TIMETABLE_PROPOSAL');
      sent = await publishVersion(world, draft, { from: choice.from, once: false }, kit, send);
      if (!sent.sent.includes(theirs.teacher)) {
        if (sent.problem instanceof Error) throw sent.problem;
        throw failed('The version did not reach the teacher', 'E_TIMETABLE_PROPOSAL');
      }
      version = draft.version;
    }
  }
  const code = await joinCode(world.world, desk, one.issue);
  const { assignment, issue } = one.issue;
  const value = { world: world.world, school: desk.held.school, assignment, issue, proposal: id, version };
  const decision = { ...value, accepted: choice.accepted, note: noteOf(choice.note) };
  const signed = await kitStep(() => signDecision(decision, key.certificate, key.signer));
  await putOnChannel(code, ca, kit, send, async (_read, first) => {
    return (await kitStep(() => sealTimetableRecord(code, signed, first, kit.cipher, kit.mac))).batches;
  });
  return { version, sent };
}
