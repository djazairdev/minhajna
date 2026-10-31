// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Teachers' proposals and the director's decision (#578, answer 606), against a
// made-up demo server: a proposal the joined teacher's device signed waits,
// found in the standing version and checked against the rest of it, and
// accepting it, from one of the first days offered only, publishes the next
// version with the session moved to the teacher alone and settles it, so it
// waits no more and cannot be decided again; a move that clashes or changes the
// hours can only be declined, and declining publishes nothing; a proposal
// another key signed is not listed; one whose session left the standing
// version, or that no part of its version holds, can only be declined; an
// acceptance whose decision did not reach the channel is recorded later with
// the version already published, without a new one, and is refused, keeping
// nothing, once the key that published it is gone; and a session taught to
// several classes together cannot be moved for one class alone. Every world,
// school and teacher is made up.

import {
  addDays,
  channelStream,
  keptVersions,
  sealTimetableRecord,
  signProposal,
  type JoinCode,
  type SchoolJoined,
  type TimetableProposal,
} from '@minhajna/core';
import { BELLS, channel, school, sendParts, server, session, setting } from '../jest/timetable-send';
import { codeOf, nodeKit as kit } from '../jest/world-server';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { certified } from '../src/school/school-join-session';
import { caKey } from '../src/school/space-read';
import { acceptable, decideProposal, readProposals } from '../src/timetable/proposal-session';
import { holdSchool } from '../src/director/issue-session';
import { partFrom, putOnChannel, signingKey } from '../src/timetable/send-session';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const FIRST = [session('بلعيد محمد', 1, 600), session('Salhi Zahia', 2, 540), session('نوري سليم', 0, 480)];

/** Puts a proposal on the teacher's channel, signed by a joined device's key, moving their first session. */
async function propose(code: JoinCode, by: SchoolJoined, move: Partial<TimetableProposal>) {
  const part = (await channel(code)).latest!.part;
  const proposal = {
    world: part.world,
    school: part.school,
    assignment: part.assignment,
    issue: part.issue,
    version: part.version,
    session: part.sessions[0].id,
    day: 1,
    start: 480,
    end: 540,
    room: 'ق1',
    note: 'Made-up note',
    ...move,
  } as const;
  const signer = {
    publicKey: by.certificate.publicKey,
    sign: (one: string) => kit.sign(by.pkcs8, one),
    verify: kit.verify,
  };
  const signed = await signProposal(proposal, by.certificate, signer);
  const ca = await caKey(code.world, server.send);
  await putOnChannel(code, ca, kit, server.send, async (_read, first) => {
    return (await sealTimetableRecord(code, signed, first, kit.cipher, kit.mac)).batches;
  });
}

test('accepting a proposal publishes the next version to the teacher alone, and settles it', async () => {
  const { here, code, joined } = await setting();
  await sendParts(here, school, FIRST, BELLS);
  await propose(code, joined, {});
  const read = await readProposals(here, school, kit, server.send);
  expect([read.standing?.version, read.version]).toEqual([1, 2]);
  const [one] = read.waiting;
  expect([one.teacher, one.now?.start, one.moved?.start, one.clashes, one.hours]).toEqual([
    'بلعيد محمد',
    600,
    480,
    [],
    true,
  ]);
  const from = addDays(partFrom(here.date), 7);
  const choice = { accepted: true, note: ' Made-up\u202e reply ', from };
  expect(
    await codeOf(decideProposal(here, school, one.id, { ...choice, from: here.date }, BELLS, kit, server.send)),
  ).toBe('E_TIMETABLE_PROPOSAL');
  const { version, sent } = await decideProposal(here, school, one.id, choice, BELLS, kit, server.send);
  expect([version, sent?.sent, sent?.unchanged]).toEqual([2, ['بلعيد محمد'], ['Salhi Zahia']]);
  const parts = await channel(code);
  expect(parts.all.map((part) => [part.part.version, part.part.from])).toEqual([
    [1, partFrom(here.date)],
    [2, from],
  ]);
  expect(parts.all[1].part.sessions.map((part) => part.start)).toEqual([480]);
  expect(keptVersions(here.book.entries, parts.all[1].part.school).map((kept) => kept.version)).toEqual([1, 2]);
  expect((await readProposals(here, school, kit, server.send)).waiting).toEqual([]);
  expect(await codeOf(decideProposal(here, school, one.id, choice, BELLS, kit, server.send))).toBe(
    'E_TIMETABLE_DECIDED',
  );
});

test('a move that clashes or changes the hours can only be declined, and declining publishes nothing', async () => {
  const { here, code, joined } = await setting();
  await sendParts(here, school, FIRST, BELLS);
  await propose(code, joined, { day: 2, start: 540, end: 600 });
  await propose(code, joined, { start: 480, end: 600 });
  const [clash, longer] = (await readProposals(here, school, kit, server.send)).waiting;
  expect([clash.clashes, clash.hours, acceptable(clash)]).toEqual([['class', 'room'], true, false]);
  expect([longer.clashes, longer.hours, acceptable(longer)]).toEqual([[], false, false]);
  const choice = { accepted: true, note: '', from: partFrom(here.date) };
  expect(await codeOf(decideProposal(here, school, clash.id, choice, BELLS, kit, server.send))).toBe(
    'E_TIMETABLE_PROPOSAL',
  );
  const declined = { ...choice, accepted: false, note: 'Made-up reason' };
  expect(await decideProposal(here, school, clash.id, declined, BELLS, kit, server.send)).toEqual({
    version: null,
    sent: null,
  });
  expect((await channel(code)).all).toHaveLength(1);
  expect((await readProposals(here, school, kit, server.send)).waiting.map((one) => one.id)).toEqual([longer.id]);
});

test('another key’s proposal is not listed, and one whose session left the standing version is stale', async () => {
  const { here, code, joined } = await setting();
  await sendParts(here, school, FIRST, BELLS);
  const ca = await caKey(code.world, server.send);
  const stranger = await certified(code, joined.code, ca, kit, server.send);
  await propose(code, stranger, {});
  expect((await readProposals(here, school, kit, server.send)).waiting).toEqual([]);
  await propose(code, joined, {});
  await sendParts(here, school, [session('بلعيد محمد', 1, 660), ...FIRST.slice(1)], BELLS);
  const [stale] = (await readProposals(here, school, kit, server.send)).waiting;
  expect([stale.at, stale.now, stale.published, acceptable(stale)]).toEqual([-1, null, false, false]);
  await propose(code, joined, { version: 9 });
  const unheld = (await readProposals(here, school, kit, server.send)).waiting.find((one) => one.id !== stale.id)!;
  expect([unheld.original, unheld.at, acceptable(unheld)]).toEqual([null, -1, false]);
});

test('an acceptance whose decision did not reach the channel is recorded later, without a new version', async () => {
  const { here, code, joined } = await setting();
  await sendParts(here, school, FIRST, BELLS);
  await propose(code, joined, {});
  const [one] = (await readProposals(here, school, kit, server.send)).waiting;
  const stream = await channelStream(code, kit.mac);
  let writes = 0;
  const losing: Send = async (request) => {
    const body = request.body as { stream?: unknown } | undefined;
    if (request.method === 'POST' && body?.stream === stream && (writes += 1) === 2) {
      return { status: 503, body: null, retryAfter: null };
    }
    return server.send(request);
  };
  const choice = { accepted: true, note: '', from: partFrom(here.date) };
  expect(await codeOf(decideProposal(here, school, one.id, choice, BELLS, kit, losing))).toBe('E_WORLD_SERVER');
  const [still] = (await readProposals(here, school, kit, server.send)).waiting;
  expect([still.id, still.at, still.published, still.recordable, acceptable(still)]).toEqual([
    one.id,
    -1,
    true,
    2,
    true,
  ]);
  expect(await decideProposal(here, school, one.id, choice, BELLS, kit, server.send)).toEqual({
    version: 2,
    sent: null,
  });
  expect((await readProposals(here, school, kit, server.send)).waiting).toEqual([]);
  expect(keptVersions(here.book.entries, one.proposal.school).map((kept) => kept.version)).toEqual([1, 2]);
});

test('an acceptance still to record is refused, keeping nothing, once the key that published it is gone', async () => {
  const { here, code, joined } = await setting();
  await sendParts(here, school, FIRST, BELLS);
  await propose(code, joined, {});
  const [one] = (await readProposals(here, school, kit, server.send)).waiting;
  const stream = await channelStream(code, kit.mac);
  let writes = 0;
  const losing: Send = async (request) => {
    const body = request.body as { stream?: unknown } | undefined;
    if (request.method === 'POST' && body?.stream === stream && (writes += 1) === 2) {
      return { status: 503, body: null, retryAfter: null };
    }
    return server.send(request);
  };
  const choice = { accepted: true, note: '', from: partFrom(here.date) };
  await codeOf(decideProposal(here, school, one.id, choice, BELLS, kit, losing));
  const desk = await holdSchool(here, kit, server.send);
  await signingKey('made-up-world', desk, await caKey(code.world, server.send), kit, server.send).catch(() => null);
  const [lost] = (await readProposals(here, school, kit, server.send)).waiting;
  expect([lost.published, lost.recordable]).toEqual([true, null]);
  expect(await codeOf(decideProposal(here, school, one.id, choice, BELLS, kit, server.send))).toBe(
    'E_TIMETABLE_PROPOSAL',
  );
  expect(keptVersions(here.book.entries, one.proposal.school).map((kept) => kept.version)).toEqual([1, 2]);
});

test('a session taught to several classes together cannot be moved for one class alone', async () => {
  const { here, code, joined } = await setting();
  await sendParts(here, school, [...FIRST, session('بلعيد محمد', 1, 600, '1م3')], BELLS);
  await propose(code, joined, {});
  const [one] = (await readProposals(here, school, kit, server.send)).waiting;
  expect([one.joint, one.clashes, one.hours, acceptable(one)]).toEqual([true, [], true, false]);
});
