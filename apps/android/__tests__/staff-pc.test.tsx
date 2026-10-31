// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signing in on a staffroom PC in a national demo world (#572, answer 602),
// against a made-up demo server: the PC shows a one-time code; the teacher's
// phone, joined on the director's code, scans it, asks with the school and what
// opens, and approving shows a check; the PC shows the same check with the
// teacher and school, opens the session only once they are said the same, and
// reads the day the channel was joined; locking and five minutes unused erase
// the session and show a new code; "different" makes a new code; a phone that
// joined no school, and a code that is not a PC's, say so; nothing of the
// session is kept in the world's store. Every world, school, teacher and device
// is made up.

import { directorSchool, seedNationalWorld, type SchoolCalendar } from '@minhajna/core';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { calendarInput } from '../jest/calendar-input';
import { FakeStorage } from '../jest/fake-storage';
import { DemoServer, nodeKit } from '../jest/world-server';
import { startWorld } from '../src/demo/world-session';
import { assignmentsOf, codeText, holdSchool, issueFor } from '../src/director/issue-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { joinSchool } from '../src/school/school-join-session';
import { PcApprove } from '../src/staff/PcApprove';
import { StaffPc } from '../src/staff/StaffPc';
import * as staff from '../src/staff/staff-session';
import { openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const reference = read;
const calendar: SchoolCalendar = reference.calendar;
const server = new DemoServer();
const words = text.demo.staff;
let pcTree: ReactTestRenderer.ReactTestRenderer | undefined;
let phoneTree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    pcTree?.unmount();
    phoneTree?.unmount();
  });
  pcTree = undefined;
  phoneTree = undefined;
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
  calendarInput.scanQr.mockReset();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const textsOf = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const hasIn = (tree: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID }).length > 0;

const askAt = (spy: jest.SpiedFunction<typeof staff.askPc>, at: number) =>
  spy.mock.results[at].value as Promise<staff.PcAsk>;

async function turns() {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      await settle();
    });
}

async function press(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  await ReactTestRenderer.act(async () => {
    (tree.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
    await settle();
  });
  await turns();
}

/** A world whose director issued a phone code that the teacher's phone joined on, and a staffroom PC. */
async function world(joined = true) {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const id = started.keys.world;
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const device = async () => ({
    world: id,
    date: started.date,
    book: await openRecordBook(new FakeStorage().asSpec()),
  });
  const [director, phone, pc] = [await device(), await device(), await device()];
  const desk = await holdSchool(director, nodeKit, server.send);
  const teacher = school.teachers[0];
  const assignment = (await assignmentsOf(desk, school.teachers, nodeKit)).get(teacher.id)!;
  const { kept } = await issueFor(director, desk, assignment, 'phone', nodeKit, server.send);
  if (joined) await joinSchool(phone, await codeText(id, desk, kept), nodeKit, server.send);
  return { school, phone, pc, teacher };
}

type World = Awaited<ReturnType<typeof world>>;

async function render(element: React.ReactElement) {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
    await settle();
  });
  await turns();
  return tree!;
}

const staffPc = ({ school, pc }: World) =>
  render(
    <StaffPc
      world={pc}
      school={school}
      profile={reference.profile}
      date="made-up"
      dayText={String}
      kit={nodeKit}
      send={server.send}
      onClose={() => undefined}
    />,
  );
const approver = ({ school, phone }: World) =>
  render(
    <PcApprove
      world={phone}
      school={school}
      date="made-up"
      kit={nodeKit}
      send={server.send}
      onClose={() => undefined}
    />,
  );

test('the phone approves a PC’s code, both show the check, and the PC opens once it is the same', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const made = await world();
  const asked = jest.spyOn(staff, 'askPc');
  pcTree = await staffPc(made);
  expect(hasIn(pcTree, 'staff-qr')).toBe(true);
  const { code } = await askAt(asked, 0);
  jest.replaceProperty(Platform, 'OS', 'android');
  phoneTree = await approver(made);
  calendarInput.scanQr.mockResolvedValueOnce(code);
  await press(phoneTree, 'pc-scan');
  expect(textsOf(phoneTree)).toContain(words.phone.ask);
  expect(textsOf(phoneTree)).toContain(words.phone.pcValue);
  await press(phoneTree, 'pc-approve-yes');
  const shown = textsOf(phoneTree).find((one) => one.startsWith(words.phone.check.split('{{check}}')[0]))!;
  const check = /([0-9a-f]{8})/u.exec(shown)![1];
  jest.replaceProperty(Platform, 'OS', 'web');
  await press(pcTree, 'staff-check');
  expect(textsOf(pcTree)).toContain(words.signIn.compare.replace('{{check}}', isolate(check)));
  expect(hasIn(pcTree, 'staff-session')).toBe(false);
  await press(pcTree, 'staff-same');
  expect(hasIn(pcTree, 'staff-session')).toBe(true);
  expect(textsOf(pcTree).some((one) => one.startsWith(words.session.joined.split('{{day}}')[0]))).toBe(true);
  expect(made.pc.book.entries).toHaveLength(0);
  await press(pcTree, 'staff-lock');
  expect(hasIn(pcTree, 'staff-session')).toBe(false);
  expect(textsOf(pcTree)).toContain(words.erased.locked);
  expect(hasIn(pcTree, 'staff-qr')).toBe(true);
});

test('a session left unused is erased and says so', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const made = await world();
  const asked = jest.spyOn(staff, 'askPc');
  pcTree = await staffPc(made);
  const { request } = await askAt(asked, 0);
  const session = await staff.phoneSession(made.phone, made.school, nodeKit);
  await staff.putAnswer(made.phone, await staff.sealAnswer(request, session, nodeKit), nodeKit, server.send);
  await press(pcTree, 'staff-check');
  const timers = jest.spyOn(global, 'setTimeout');
  await press(pcTree, 'staff-same');
  expect(hasIn(pcTree, 'staff-session')).toBe(true);
  const idle = timers.mock.calls.filter(([, delay]) => delay === staff.STAFF_IDLE).at(-1)![0] as () => void;
  await ReactTestRenderer.act(async () => {
    idle();
    await settle();
  });
  await turns();
  expect(hasIn(pcTree, 'staff-session')).toBe(false);
  expect(textsOf(pcTree)).toContain(words.erased.idle);
});

test('“different” makes a new code, and the phone says it joined no school or the code is wrong', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const made = await world(false);
  const asked = jest.spyOn(staff, 'askPc');
  pcTree = await staffPc(made);
  const first = (await askAt(asked, 0)).request.secret;
  await press(pcTree, 'staff-again');
  expect((await askAt(asked, 1)).request.secret).not.toBe(first);
  jest.replaceProperty(Platform, 'OS', 'android');
  phoneTree = await approver(made);
  calendarInput.scanQr.mockResolvedValueOnce('minhajna-join:1:nothing');
  await press(phoneTree, 'pc-scan');
  expect(textsOf(phoneTree)).toContain(words.phone.notCode);
  calendarInput.scanQr.mockResolvedValueOnce((await askAt(asked, 1)).code);
  await press(phoneTree, 'pc-scan');
  expect(textsOf(phoneTree)).toContain(words.phone.notJoined);
  expect(hasIn(phoneTree, 'pc-ask')).toBe(false);
});
