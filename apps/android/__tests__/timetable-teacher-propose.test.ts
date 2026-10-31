// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's proposals from their phone (#579, answer 607), against a made-up
// demo server: the free times of a day keep the session's length, meet none of
// the teacher's other sessions, never its own place, end where a bell ends with
// the bells between following one another, and say when they make the day
// longer or add a day, which moving a day's only session does not; a proposal
// is put on the channel with its room cleaned and kept to a name's length,
// waits on the director's page, and reads back declined with the school's note,
// or accepted with the version that publishes it, which then becomes the part
// proposals are made on; a session taught to several classes together is joint,
// and a session of week A meets no session of week B. Every world, school and
// teacher is made up.

import { addDays, type PartSession, type TimetablePart } from '@minhajna/core';
import { BELLS, school, sendParts, server, session, setting } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { leaveWorldNetwork } from '../src/network/world-network';
import { decideProposal, readProposals } from '../src/timetable/proposal-session';
import { partFrom } from '../src/timetable/send-session';
import { freeSlots, jointIn, propose, proposedOn } from '../src/timetable/teacher-propose';
import { readTeacherChannel } from '../src/timetable/teacher-session';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
});

const FIRST = [session('بلعيد محمد', 1, 600), session('بلعيد محمد', 2, 540), session('Salhi Zahia', 0, 480)];

test('a proposal waits for the director, and reads back declined or accepted', async () => {
  const { id, here, joined } = await setting();
  const world = { world: id, date: here.date };
  await sendParts(here, school, FIRST, BELLS);
  const read = await readTeacherChannel(world, joined, kit, server.send);
  const part = proposedOn(read)!;
  const [moving] = part.sessions;
  expect([part.version, read.proposals]).toEqual([1, []]);
  expect(freeSlots(part, moving, 1)).toEqual([
    { start: 480, end: 540, longer: false, newDay: false },
    { start: 540, end: 600, longer: false, newDay: false },
  ]);
  expect(freeSlots(part, moving, 2)).toEqual([{ start: 480, end: 540, longer: true, newDay: false }]);
  expect(freeSlots(part, moving, 0).map((one) => one.newDay)).toEqual([false, false]);
  const room = ` ق2\u202e${'م'.repeat(90)}`;
  await propose(world, joined, part, moving, { day: 2, start: 480, end: 540, room, note: 'Made-up' }, kit, server.send);
  const [sent] = (await readTeacherChannel(world, joined, kit, server.send)).proposals;
  expect([sent.proposal.value.room, sent.proposal.value.note, sent.decision]).toEqual([
    `ق2${'م'.repeat(78)}`,
    'Made-up',
    null,
  ]);
  const [waiting] = (await readProposals(here, school, kit, server.send)).waiting;
  expect([waiting.now?.start, waiting.moved?.day, waiting.moved?.start]).toEqual([600, 2, 480]);
  const from = addDays(partFrom(here.date), 7);
  await decideProposal(
    here,
    school,
    waiting.id,
    { accepted: false, note: 'Made-up reply', from },
    BELLS,
    kit,
    server.send,
  );
  const declined = (await readTeacherChannel(world, joined, kit, server.send)).proposals[0].decision?.value;
  expect([declined?.accepted, declined?.note]).toEqual([false, 'Made-up reply']);
  await propose(world, joined, part, moving, { day: 1, start: 480, end: 540, room: 'ق1', note: '' }, kit, server.send);
  const [next] = (await readProposals(here, school, kit, server.send)).waiting;
  await decideProposal(here, school, next.id, { accepted: true, note: '', from }, BELLS, kit, server.send);
  const after = await readTeacherChannel(world, joined, kit, server.send);
  expect(after.proposals.map((one) => [one.decision?.value.accepted, one.decision?.value.version])).toEqual([
    [false, null],
    [true, 2],
  ]);
  expect(proposedOn(after)?.version).toBe(2);
});

test('a session taught to several classes together is joint, and week A meets no week B', () => {
  const one = { class: '1م1', group: '', subject: 'رياضيات', room: 'ق1', day: 0, start: 480, end: 540 } as const;
  const sessions: PartSession[] = [
    { ...one, id: 'a'.repeat(32), week: 'A' },
    { ...one, id: 'b'.repeat(32), week: 'B', class: '1م2', start: 540, end: 600 },
    { ...one, id: 'c'.repeat(32), week: 'both', class: '1م3', start: 600, end: 660 },
    { ...one, id: 'd'.repeat(32), week: 'both', class: '1م4', start: 600, end: 660 },
  ];
  const part = {
    bells: [
      [480, 540],
      [540, 600],
      [600, 660],
    ],
    sessions,
  } as unknown as TimetablePart;
  expect(sessions.map((session) => jointIn(part, session))).toEqual([false, false, true, true]);
  expect(freeSlots(part, sessions[0], 0).map((slot) => slot.start)).toEqual([540]);
});

test('a free time ends where a bell ends, the bells between following one another, and may add a day', () => {
  const one = { class: '1م1', group: '', subject: 'رياضيات', room: 'ق1', week: 'both' } as const;
  const sessions: PartSession[] = [
    { ...one, id: 'a'.repeat(32), day: 1, start: 480, end: 600 },
    { ...one, id: 'b'.repeat(32), day: 1, start: 720, end: 780 },
  ];
  const bells = [
    [720, 780],
    [480, 540],
    [540, 600],
    [600, 660],
  ];
  const part = { bells, sessions } as unknown as TimetablePart;
  expect(freeSlots(part, sessions[0], 2)).toEqual([
    { start: 480, end: 600, longer: false, newDay: true },
    { start: 540, end: 660, longer: false, newDay: true },
  ]);
  expect(freeSlots(part, sessions[0], 1).map((slot) => slot.start)).toEqual([540]);
});
