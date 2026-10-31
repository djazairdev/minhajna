// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A staffroom PC's sign-in at its edges in a national demo world (#572, answer
// 602), against a made-up demo server: ending a session erases it and says so;
// two answers at one code make a new code; a check that finds nothing says so;
// an approval put again keeps the check the PC shows; the phone refuses a PC,
// says a refused camera, and goes back on Android's back button; and the
// world's home offers the teacher the staffroom PC on a PC and the sign-in on a
// PC on a phone, to no other role; a key on the PC's page keeps a session open,
// a comparison left unanswered makes a new code, and the phone offers the PC
// only the codes of the teacher its first code names. Every world, school,
// teacher and device is made up.

import { directorSchool, seedNationalWorld, type SchoolCalendar } from '@minhajna/core';
import { BackHandler, Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { calendarInput } from '../jest/calendar-input';
import { FakeStorage } from '../jest/fake-storage';
import { DemoServer, nodeKit } from '../jest/world-server';
import { WorldHome } from '../src/demo/WorldHome';
import { failed, startWorld } from '../src/demo/world-session';
import { assignmentsOf, codeText, holdSchool, issueFor } from '../src/director/issue-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { joinSchool } from '../src/school/school-join-session';
import { PcApprove } from '../src/staff/PcApprove';
import { StaffPc } from '../src/staff/StaffPc';
import * as staff from '../src/staff/staff-session';
import { openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';

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
const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.add(handler);
    return { remove: () => void handlers.delete(handler) };
  });
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
  calendarInput.scanQr.mockReset();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const askAt = (spy: jest.SpiedFunction<typeof staff.askPc>, at: number) =>
  spy.mock.results[at].value as Promise<staff.PcAsk>;

async function turns(first: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) first();
      await settle();
    });
}

const press = (testID: string) =>
  turns(() => (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never));

async function render(element: React.ReactElement) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
    await settle();
  });
  await turns();
}

/** A world whose teacher's phone joined on the director's code, and a staffroom PC. */
async function world() {
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
  const assignments = await assignmentsOf(desk, school.teachers, nodeKit);
  const join = async (index: number) => {
    const assignment = assignments.get(school.teachers[index].id)!;
    const { kept } = await issueFor(director, desk, assignment, 'phone', nodeKit, server.send);
    await joinSchool(phone, await codeText(id, desk, kept), nodeKit, server.send);
  };
  await join(0);
  return { school, phone, pc, join };
}

const staffPc = ({ school, pc }: Awaited<ReturnType<typeof world>>) =>
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

test('ending erases the session, two answers make a new code, and an empty check says so', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const made = await world();
  const asked = jest.spyOn(staff, 'askPc');
  await staffPc(made);
  await press('staff-check');
  expect(texts()).toContain(words.signIn.nothing);
  const { request } = await askAt(asked, 0);
  const session = await staff.phoneSession(made.phone, made.school, nodeKit);
  const sealed = await staff.sealAnswer(request, session, nodeKit);
  const check = await staff.putAnswer(made.phone, sealed, nodeKit, server.send);
  expect(await staff.putAnswer(made.phone, sealed, nodeKit, server.send)).toBe(check);
  await press('staff-check');
  expect(texts().some((one) => one.includes(check))).toBe(true);
  await press('staff-same');
  await press('staff-end');
  expect(has('staff-session')).toBe(false);
  expect(texts()).toContain(words.erased.ended);
  jest.spyOn(staff, 'readPc').mockResolvedValueOnce('contested');
  await press('staff-check');
  expect(texts()).toContain(words.signIn.contested);
  expect(asked).toHaveBeenCalledTimes(3);
});

test('the phone refuses a PC, says a refused camera, and goes back on Android’s back button', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const made = await world();
  const { code } = await staff.askPc(made.pc, nodeKit, server.send);
  const closed = jest.fn();
  await render(
    <PcApprove
      world={made.phone}
      school={made.school}
      date="made-up"
      kit={nodeKit}
      send={server.send}
      onClose={closed}
    />,
  );
  calendarInput.scanQr.mockRejectedValueOnce(failed('Made up', 'E_CALENDAR_CAMERA'));
  await press('pc-scan');
  expect(texts()).toContain(text.demo.school.problem.camera);
  calendarInput.scanQr.mockResolvedValueOnce(code);
  await press('pc-scan');
  expect(has('pc-ask')).toBe(true);
  await press('pc-refuse');
  expect(has('pc-ask')).toBe(false);
  expect(has('pc-scan')).toBe(true);
  await turns(() => void [...handlers].reverse().some((one) => one({ type: 'hardwareBackPress', timeStamp: 0 })));
  expect(closed).toHaveBeenCalledTimes(1);
});

test('the world’s home offers the teacher the staffroom PC on a PC and the sign-in on a PC on a phone', async () => {
  const home = (role: 'teacher' | 'inspector') =>
    render(
      <WorldHome
        world={{ kind: 'national', code: 'K7QF4-MADE-UP', starter: null } as never}
        date="made-up"
        role={role}
        moving={false}
        problem={null}
        onRole={() => undefined}
        onMove={() => undefined}
        onLeave={() => undefined}
        onStaff={() => undefined}
      />,
    );
  jest.replaceProperty(Platform, 'OS', 'web');
  await home('teacher');
  expect(texts()).toContain(text.demo.home.staffPc);
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.replaceProperty(Platform, 'OS', 'android');
  await home('teacher');
  expect(texts()).toContain(text.demo.home.pcApprove);
  await ReactTestRenderer.act(() => tree?.unmount());
  await home('inspector');
  expect(has('world-staff-open')).toBe(false);
});

test('a key on the page keeps the session, the comparison times out, and the phone offers one teacher', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const made = await world();
  await made.join(1);
  const session = await staff.phoneSession(made.phone, made.school, nodeKit);
  expect(session.joins).toHaveLength(1);
  const heard = new Map<string, () => void>();
  const page = {
    addEventListener: (kind: string, listener: () => void) => void heard.set(kind, listener),
    removeEventListener: (kind: string) => void heard.delete(kind),
  };
  Object.assign(globalThis, { document: page });
  try {
    const asked = jest.spyOn(staff, 'askPc');
    const timers = jest.spyOn(global, 'setTimeout');
    const idle = () => timers.mock.calls.filter(([, delay]) => delay === staff.STAFF_IDLE);
    await staffPc(made);
    const first = await staff.sealAnswer((await askAt(asked, 0)).request, session, nodeKit);
    await staff.putAnswer(made.phone, first, nodeKit, server.send);
    await press('staff-check');
    expect(has('staff-compare')).toBe(true);
    await turns(() => (idle().at(-1)![0] as () => void)());
    expect(has('staff-compare')).toBe(false);
    expect(asked).toHaveBeenCalledTimes(2);
    const second = await staff.sealAnswer((await askAt(asked, 1)).request, session, nodeKit);
    await staff.putAnswer(made.phone, second, nodeKit, server.send);
    await press('staff-check');
    await press('staff-same');
    const before = idle().length;
    await turns(() => heard.get('keydown')?.());
    expect(idle().length).toBe(before + 1);
    await ReactTestRenderer.act(() => tree?.unmount());
    tree = undefined;
    expect(heard.size).toBe(0);
  } finally {
    Reflect.deleteProperty(globalThis, 'document');
  }
});
