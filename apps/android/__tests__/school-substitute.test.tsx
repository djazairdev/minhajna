// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A substitute's appointment from the director's device (#587, answer 615), on
// the made-up term of term-weeks.ts with a second teacher joined: the holder
// and their classes, the joined teachers and the days offered; appointing, its
// decision cleaned, publishes the version that gives the substitute the
// holder's sessions of the chosen classes and puts a handover the substitute's
// device reads whole, with the two signed weeks and the class with none, and a
// receipt the substitute signs shows on the list; a substitute who has not
// joined, the holder as substitute, a class not theirs, no class, an empty
// decision or a day not offered is refused; the page records an appointment,
// says so, lists it, and brings it up to date with a week corrected since, and
// says a world grants no inspector access; a handover cut short after its first
// record shows as not all there and is sent again whole; sending to a
// substitute who has not joined says so; a class's weeks go in records of at
// most 64, a class with none in one of its own; and a problem reading is shown
// and read again. Every school, class and teacher is made up.

import {
  channelHandovers,
  correctWeek,
  channelStream,
  readJoinCode,
  readJoined,
  sealHandoverReceipt,
  signHandoverReceipt,
  type DemoSchool,
  type SchoolJoined,
  type SignedWeek,
} from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { joinNew, SECOND, signedTerm } from '../jest/term-weeks';
import { BELLS, channel, school, server, STAFF } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { readRecords } from '../src/director/records-session';
import { handoverRecords } from '../src/director/substitute-channels';
import { appoint, readSubstitutes, sendHandover } from '../src/director/substitute-session';
import { SchoolSubstitute } from '../src/director/SchoolSubstitute';
import { leaveWorldNetwork } from '../src/network/world-network';
import { caKey, spaceBatches } from '../src/school/space-read';
import { openRecordBook } from '../src/storage/history';
import ar from '../src/text/ar.json';
import { putOnChannel } from '../src/timetable/send-session';
import { isolate } from '../src/week/grid-labels';
import { signTheWeek } from '../src/week/week-sign-session';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.substitute;
const STAFFED = { ...school, teachers: STAFF } as unknown as DemoSchool;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

/** The made-up term, teacher-1 holding 1م2 and 1م3 with two signed weeks, and teacher-4 joined on a new code. */
async function staffed() {
  const { id, here, joined } = await signedTerm();
  const device = async () => ({ world: id, date: here.date, book: await openRecordBook(new FakeStorage().asSpec()) });
  const substitute = await joinNew(id, here, device, 'teacher-4');
  return { world: { ...here, world: id, date: SECOND }, substitute, holder: joined };
}

/** The handovers on the substitute's channel, as their device reads them. */
async function handovers(substitute: SchoolJoined) {
  const code = readJoinCode(substitute.code)!;
  const batches = (await spaceBatches(code.world, code.school, server.send)).get(await channelStream(code, kit.mac));
  const ca = { key: await caKey(code.world, server.send), checker: kit };
  const joined = await readJoined(code, batches ?? [], ca, kit.cipher, kit.mac);
  return channelHandovers(code, batches ?? [], ca, joined, kit.cipher, kit.mac);
}

/** The substitute's receipt, signed on their device and put on their channel. */
async function receive(substitute: SchoolJoined, appointment: string, day: string) {
  const code = readJoinCode(substitute.code)!;
  const signer = {
    publicKey: substitute.certificate.publicKey,
    sign: (text: string) => kit.sign(substitute.pkcs8, text),
    verify: kit.verify,
  };
  const on = { world: code.world, school: code.school, assignment: code.assignment, issue: code.issue };
  const signed = await signHandoverReceipt({ ...on, appointment, day: day as never }, substitute.certificate, signer);
  const ca = await caKey(code.world, server.send);
  await putOnChannel(code, ca, kit, server.send, async (_read, first) => {
    return (await sealHandoverReceipt(code, signed, first, kit.cipher, kit.mac)).batches;
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 80; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const control = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && node.props.label !== undefined)[0];
const press = (testID: string) => act(() => (control(testID).props as PressableProps).onPress?.({} as never));

function render(world: Awaited<ReturnType<typeof staffed>>['world'], send = server.send) {
  return act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <SchoolSubstitute
          world={world}
          school={STAFFED}
          bells={BELLS}
          kit={kit}
          send={send}
          dayText={(day) => `day ${day}`}
        />
      </LocaleDirContext.Provider>,
    );
  });
}

test('appointing passes the classes in a version and hands over their weeks, then shows the receipt', async () => {
  const { world, substitute } = await staffed();
  const desk = await readSubstitutes(world, STAFFED, kit, server.send);
  expect(desk.holders.map((one) => [one.id, one.classes])).toEqual([['teacher-1', ['1م2', '1م3']]]);
  expect(desk.substitutes.map((one) => one.id)).toEqual(['teacher-1', 'teacher-4']);
  const decision = `2027${String.fromCharCode(0x200f)}/015`;
  const choice = { holder: 'teacher-1', substitute: 'teacher-4', decision, classes: ['1م2', '1م3'] };
  const { appointment, sent } = await appoint(
    world,
    STAFFED,
    { ...choice, from: desk.days[0] },
    BELLS,
    kit,
    server.send,
  );
  expect(sent.sent).toEqual(expect.arrayContaining([STAFF[3].name]));
  const part = (await channel(readJoinCode(substitute.code)!)).latest;
  expect(part?.part.sessions.map((one) => one.class).sort()).toEqual(['1م2', '1م2', '1م2', '1م3']);
  expect(appointment.decision).toBe('2027/015');
  const [read] = await handovers(substitute);
  const names = { holder: STAFF[0].name, substitute: STAFF[3].name, classes: ['1م2', '1م3'] };
  expect([read.signed.value, read.complete]).toMatchObject([names, ['1م2', '1م3']]);
  expect(read.weeks.map((one) => one.week.week)).toEqual(['2027-01-03', '2027-01-10']);
  expect(read.received).toBeNull();
  await receive(substitute, appointment.id, '2027-01-12');
  const after = await readSubstitutes(world, STAFFED, kit, server.send);
  expect(after.appointments.map((one) => [one.handedOver, one.received])).toEqual([[true, '2027-01-12']]);
});

test('refuses a substitute not joined, the holder as substitute or a class not theirs', async () => {
  const { world } = await staffed();
  const { days } = await readSubstitutes(world, STAFFED, kit, server.send);
  const base = { holder: 'teacher-1', substitute: 'teacher-4', decision: '2027/015', classes: ['1م2'], from: days[0] };
  for (const wrong of [
    { ...base, substitute: 'teacher-5' },
    { ...base, substitute: 'teacher-1' },
    { ...base, classes: ['1م4'] },
    { ...base, classes: [] },
    { ...base, decision: ' ' },
    { ...base, from: SECOND },
  ])
    await expect(appoint(world, STAFFED, wrong, BELLS, kit, server.send)).rejects.toMatchObject({
      code: 'E_SUBSTITUTE_CHOICE',
    });
});

test('the page records an appointment, lists it, brings it up to date, and says a world grants no access', async () => {
  const { world, substitute, holder } = await staffed();
  await render(world);
  expect(texts()).toEqual(expect.arrayContaining([words.lead, words.noGrant, words.grantsHere, words.stay.reason]));
  expect((control('substitute-record').props as { disabled?: boolean }).disabled).toBe(true);
  await press('substitute-holder-teacher-1');
  await press('substitute-who-teacher-4');
  await act(() =>
    (control('substitute-decision').props as { onChangeText: (v: string) => void }).onChangeText('2027/015'),
  );
  await press('substitute-classes-1م3');
  await press('substitute-record');
  expect(texts()).toEqual(
    expect.arrayContaining([
      words.recorded,
      words.handedOver,
      words.update,
      words.line
        .replace('{{substitute}}', isolate(STAFF[3].name))
        .replace('{{holder}}', isolate(STAFF[0].name))
        .replace('{{decision}}', isolate('2027/015'))
        .replace('{{from}}', 'day 2027-01-17')
        .replace('{{classes}}', words.classCount_one),
    ]),
  );
  const [latest] = (await readRecords(world, STAFFED, kit, server.send))[0].courses[0].weeks;
  await signTheWeek(world, holder, correctWeek(latest.week, latest.week.sessions[2], 'held'), kit, server.send);
  await press('substitute-resend');
  const versions = (await handovers(substitute))[0].weeks.map((one) => one.week.version);
  expect([texts().includes(words.resent), versions]).toEqual([true, [0, 1]]);
});

test('a handover cut short after its first record shows as not all there, and is sent again whole', async () => {
  const { world, substitute } = await staffed();
  const space = readJoinCode(substitute.code)!.school;
  const appointment = {
    school: space,
    id: 'f'.repeat(32),
    holder: 'teacher-1',
    substitute: 'teacher-4',
    decision: '2027/015',
    classes: ['1م2', '1م3'],
    from: (await readSubstitutes(world, STAFFED, kit, server.send)).days[0],
    version: 2,
    ended: null,
  };
  await world.book.record(world.date, { kind: 'school.substitution', substitution: appointment });
  let puts = 0;
  const cut: typeof server.send = (request) =>
    request.method === 'POST' && request.path.endsWith('/batches') && (puts += 1) > 1
      ? Promise.resolve({ status: 503, body: null, retryAfter: null })
      : server.send(request);
  await expect(sendHandover(world, STAFFED, appointment, kit, cut)).rejects.toBeDefined();
  expect((await handovers(substitute))[0].complete).toEqual(['1م2']);
  await render(world);
  expect(texts()).toContain(words.notHandedOver);
  await press('substitute-resend');
  expect(texts()).toEqual(expect.arrayContaining([words.resent, words.handedOver]));
  expect((await handovers(substitute))[0].complete).toEqual(['1م2', '1م3']);
});

test('sending a handover to a substitute who has not joined says so', async () => {
  const { world, substitute } = await staffed();
  const appointment = {
    school: readJoinCode(substitute.code)!.school,
    id: 'e'.repeat(32),
    holder: 'teacher-1',
    substitute: 'teacher-5',
    decision: '2027/015',
    classes: ['1م3'],
    from: (await readSubstitutes(world, STAFFED, kit, server.send)).days[0],
    version: 2,
    ended: null,
  };
  await world.book.record(world.date, { kind: 'school.substitution', substitution: appointment });
  await render(world);
  await press('substitute-resend');
  expect(texts()).toContain(words.notJoined);
});

test('a class’s weeks go in records of at most 64, and a class with none in a record of its own', () => {
  const week = { text: 'week', signature: 'signature', certificate: {} } as unknown as SignedWeek;
  const base = {
    world: 'K7QF4',
    school: 'space',
    assignment: 'a',
    issue: 1,
    appointment: 'f'.repeat(32),
    sending: 'a'.repeat(32),
  };
  const named = { holder: 'one', substitute: 'two', decision: '2027/015', from: SECOND, classes: ['1م2', '1م3'] };
  const made = handoverRecords({ ...base, ...named }, new Map([['1م2', Array.from({ length: 65 }, () => week)]]));
  expect(made.map((one) => [one.class, one.part, one.parts, one.weeks.length])).toEqual([
    ['1م2', 0, 2, 64],
    ['1م2', 1, 2, 1],
    ['1م3', 0, 1, 0],
  ]);
});

test('a problem reading is shown, said, and read again', async () => {
  const { world } = await staffed();
  let down = true;
  const send: typeof server.send = (request) =>
    down ? Promise.resolve({ status: 503, body: null, retryAfter: null }) : server.send(request);
  await render(world, send);
  expect(texts()).toContain(ar.demo.problem.other);
  down = false;
  await press('substitute-again');
  expect([texts().includes(ar.demo.problem.other), texts().includes(words.appoint)]).toEqual([false, true]);
});
