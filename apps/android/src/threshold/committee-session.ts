// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A committee's room above the school on the workspace's PC (#604, #605,
// answers 638 and 639): its stream is of the directorate's space, or for a
// national exam of the world's national space, and its key and each seat's seed
// come from the world's sealing key (cuts.ts), so whoever holds the world reads
// it. A seat's public key is worked out once for each seed (decider-key.ts). A
// committee's plan is the pack most of the grade's classes pin for the subject
// among the schools it covers, of those the reference holds, the first pinned
// at a tie, and its subjects those a class of the grade pins a pack the
// reference holds for, as the classes first name them. A room is read from its
// stream, a space not open yet holding no vote. A seat's vote is dated the
// world's date and numbered above the seat's every vote, and goes on the stream
// once: a seat that names the cut already puts nothing; it is refused
// (E_CUT_CLOSED) outside the room's days or once a cut is adopted, read afresh
// as it is put. Other errors carry world-session.ts's codes.

import {
  committeePlace,
  committeeSeats,
  committeeState,
  compareDays,
  directorateSpace,
  NATIONAL_COMMITTEE,
  packKey,
  readVotes,
  sealVote,
  seatSeed,
  signVote,
  type CommitteeName,
  type CommitteeState,
  type CommitteeVote,
  type Day,
  type DemoSchool,
  type PlanPack,
  type VoteDays,
} from '@minhajna/core';
import { NATIONAL_SPACE, type HeldWorld } from '../demo/world-calendar-read';
import { seededPair } from '../demo/recovery-device';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { spaceBatches } from '../school/space-read';
import { putOnce, readingMissing } from '../school/stream-put';
import { deciderKey } from './decider-key';

/** A committee's room: its name, its plan's items in order, and the days a vote counts on. */
export interface CommitteeRoom {
  readonly name: CommitteeName;
  readonly items: readonly string[];
  readonly days: VoteDays;
}

/** The subjects a class of the grade pins a pack the reference holds for, as the classes first name them. */
export function committeeSubjects(
  schools: readonly Pick<DemoSchool, 'classes'>[],
  packs: readonly PlanPack[],
  grade: string,
): string[] {
  const held = new Set(packs.map((pack) => packKey(pack.id, pack.release)));
  const subjects = schools
    .flatMap((school) => school.classes)
    .filter((one) => one.grade === grade)
    .flatMap((one) => Object.entries(one.packs))
    .filter(([, pinned]) => held.has(packKey(pinned.id, pinned.release)))
    .map(([subject]) => subject);
  return [...new Set(subjects)];
}

/** Of the packs held, the one most of the grade's classes pin for the subject, the first at a tie, or null. */
export function committeePlan(
  schools: readonly Pick<DemoSchool, 'classes'>[],
  packs: readonly PlanPack[],
  grade: string,
  subject: string,
): PlanPack | null {
  const byKey = new Map(packs.map((pack) => [packKey(pack.id, pack.release), pack]));
  const counts = new Map<string, number>();
  for (const one of schools.flatMap((school) => school.classes)) {
    const pinned = one.grade === grade ? one.packs[subject] : undefined;
    const key = pinned && packKey(pinned.id, pinned.release);
    if (key !== undefined && byKey.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let most: string | null = null;
  for (const [key, count] of counts) if (most === null || count > (counts.get(most) ?? 0)) most = key;
  return most === null ? null : (byKey.get(most) ?? null);
}

const spaceOf = async ({ world, scope }: CommitteeName, kit: Pick<WorldKit, 'mac'>) =>
  scope === NATIONAL_COMMITTEE
    ? { space: NATIONAL_SPACE, kind: 'national' as const }
    : { space: await directorateSpace(world, scope, kit.mac), kind: 'directorate' as const };

const seatKeys = async (held: HeldWorld, name: CommitteeName, kit: Pick<WorldKit, 'mac'>) => {
  const seats = Array.from({ length: committeeSeats(name) }, (_, seat) => seatSeed(held.sealing, name, seat, kit.mac));
  return (await Promise.all(seats)).map(deciderKey);
};

const read = async (held: HeldWorld, room: CommitteeRoom, kit: WorldKit) => {
  const { name, items } = room;
  const place = await committeePlace(held.sealing, name, kit.mac);
  const reading = { name, seats: await seatKeys(held, name, kit), items: new Set(items) };
  return { place, reading };
};

/** Where each of a level's committees stands, in their order, from one reading of their space. */
export async function readCommittees(
  held: HeldWorld,
  rooms: readonly CommitteeRoom[],
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<CommitteeState[]> {
  const [first] = rooms;
  if (first === undefined) return [];
  if (rooms.some(({ name }) => name.world !== held.world || name.scope !== first.name.scope))
    throw new RangeError('The committees read together are of the level of the world held');
  const { space } = await kitStep(() => spaceOf(first.name, kit));
  const empty = () => ({ status: 200, body: { batches: [], more: false }, retryAfter: null });
  const batches = await spaceBatches(held.world, space, readingMissing(held.world, send, empty));
  return kitStep(() =>
    Promise.all(
      rooms.map(async (room) => {
        const { place, reading } = await read(held, room, kit);
        const there = batches.get(place.stream) ?? [];
        const found = await readVotes(place, there, reading, kit.verify, kit.cipher);
        return committeeState(found, committeeSeats(room.name), room.days);
      }),
    ),
  );
}

/** Where a committee stands, from its stream. */
export async function readCommittee(
  held: HeldWorld,
  room: CommitteeRoom,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<CommitteeState> {
  const [state] = await readCommittees(held, [room], kit, send);
  return state;
}

/** Signs a seat's vote, an item of the plan or null for no cut, on the world's date, and puts it there once. */
export async function castVote(
  held: HeldWorld,
  room: CommitteeRoom,
  seat: number,
  item: string | null,
  date: Day,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<void> {
  const { name, items, days } = room;
  if (name.world !== held.world) throw new RangeError('A committee is of the world held');
  if (item !== null && !items.includes(item)) throw new RangeError('A vote names an item of the plan');
  if (!Number.isSafeInteger(seat) || seat < 0 || seat >= committeeSeats(name)) throw new RangeError('Not a seat');
  const closed = () => failed('The cut can no longer be signed', 'E_CUT_CLOSED');
  if (compareDays(date, days.from) < 0 || compareDays(date, days.to) > 0) throw closed();
  const { space, kind } = await kitStep(() => spaceOf(name, kit));
  const { place, reading } = await kitStep(() => read(held, room, kit));
  type Found = { readonly vote: CommitteeVote; readonly signature: string };
  const out: { made: string | null; shut: boolean; found: readonly Found[] } = { made: null, shut: false, found: [] };
  await putOnce(
    {
      world: held.world,
      space,
      kind,
      stream: place.stream,
      open: async (batches) => {
        out.found = await readVotes(place, batches, reading, kit.verify, kit.cipher);
        return out.found;
      },
      there: () => {
        if (out.made !== null && out.found.some((one) => one.signature === out.made)) return true;
        const state = committeeState(out.found, committeeSeats(name), days);
        out.shut = state.adopted !== null;
        const own = state.votes.get(seat);
        return out.shut || (own !== undefined && own.item === item);
      },
      seal: async (first) => {
        const mine = out.found.filter(({ vote }) => vote.seat === seat).map(({ vote }) => vote.version);
        const vote = { ...name, seat, item, day: date, version: Math.max(-1, ...mine) + 1 };
        const { pkcs8 } = seededPair(await seatSeed(held.sealing, name, seat, kit.mac));
        const signed = await signVote(vote, pkcs8, kit.sign);
        out.made = signed.signature;
        return sealVote(place, signed, first, kit.cipher);
      },
    },
    send,
  );
  if (out.shut) throw closed();
}
