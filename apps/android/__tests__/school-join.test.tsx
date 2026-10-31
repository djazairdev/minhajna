// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// School-join inside a demo world (#564, answer 582), against a made-up demo
// server with the server's own relay and CA: the teacher of a national world
// opens it from the world's home, under the band, reads the notice, scans the
// school's code on the phone or pastes it on a PC, and joins only on their
// yes; the join is kept in the world's store, never the teacher's own; a code
// that is none, of another world or already used, and a camera that does not
// open, are each said; a cancelled scan says nothing; going back, by the
// button or Android's back, leads to the world's home; reopening checks every
// kept key, saying so, and shows the code that joined after a used one, and a
// check that fails is said; the title and the join are said aloud, on a PC in
// a hidden live region; two presses on agree join and announce once; and
// neither the inspector nor a teachers' world offers it. A new world opens in
// its trial term end, so its card is the trial's until a teacher joins
// (school-join-trial.test.tsx). Every world, school and key is made up.

import {
  joinCodeText,
  keptJoins,
  makeJoinCode,
  newId,
  type OpenedKeyring,
  type SchoolCalendar,
  type WorldKind,
} from '@minhajna/core';
import { AccessibilityInfo, BackHandler, Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { calendarInput as NativeInput } from '../jest/calendar-input';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { joinSchool } from '../src/school/school-join-session';
import { openRecordBook } from '../src/storage/history';
import { worldSpec } from '../src/storage/world';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const calendar: SchoolCalendar = read.calendar;
const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
let os: jest.ReplaceProperty<typeof Platform.OS>;
const SCHOOL = 'made-up-school-of-the-demo';
const ring = { ring: { school: SCHOOL }, keys: [nodeKit.random(32)] } as unknown as OpenedKeyring;

beforeEach(() => {
  os = jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
  jest.restoreAllMocks();
  NativeInput.scanQr.mockReset();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const shown = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
const count = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string').length;
const live = () => tree!.root.findAll((node) => node.props.testID === 'school-said' && typeof node.type === 'string');
const button = (testID: string) => tree!.root.findAllByProps({ testID })[0].props as PressableProps;
const codeFor = async (id: string) =>
  joinCodeText(await makeJoinCode(ring, id, newId(nodeKit.random), 1, { mac: nodeKit.mac } as never));
const kept = async (id: string) =>
  keptJoins((await openRecordBook(worldSpec(teacher.asSpec(), world.asSpec(), id))).entries);

async function settled(first: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) first();
      await settle();
    });
}

const press = (testID: string, times = 1) =>
  settled(() => {
    for (let one = 0; one < times; one += 1) button(testID).onPress?.({} as never);
  });

/** A code of the world `id` already joined by another device. */
async function usedCode(id: string) {
  const used = await codeFor(id);
  const other = { world: id, date: '2026-12-17' as never, book: await openRecordBook(new FakeStorage().asSpec()) };
  await joinSchool(other, used, nodeKit, server.send);
  return used;
}

/** A world of a kind started on this PC, entered as `role`, its home shown. */
async function entered(kind: WorldKind = 'national', role = 'teacher') {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <DemoRoot
        kit={nodeKit}
        calendar={calendar}
        profile={read.ok ? read.profile : { weekStartsOn: 0 }}
        storage={teacher.asSpec()}
        world={world.asSpec()}
        send={server.send}
        onBack={() => undefined}
        onLeft={() => undefined}
      />,
    );
    await settle();
  });
  await press(`demo-start-${kind}`);
  await press(`world-role-${role}`);
  return worldNetworkOpen()!;
}

test('on the phone, a teacher scans the school’s code, agrees, and joins in the world’s store only', async () => {
  const id = await entered();
  os.replaceValue('android');
  await press('world-school-open');
  const page = tree!.root.findByProps({ testID: 'school-join' });
  const named = page.findAll((node) => typeof node.props.testID === 'string' && node.props.testID !== 'school-join');
  expect(named[0].props.testID).toBe('demo-band');
  expect(shown('school-enters') && shown('school-never')).toBe(true);
  const code = await codeFor(id);
  NativeInput.scanQr.mockResolvedValueOnce(code);
  await press('school-scan');
  expect(NativeInput.scanQr).toHaveBeenCalledWith(
    text.demo.school.scan,
    text.demo.school.scanHint,
    text.demo.school.cancel,
    expect.any(Boolean),
  );
  expect(shown('school-confirm')).toBe(true);
  expect(texts().some((one) => String(one).includes(SCHOOL.slice(0, 8)))).toBe(true);
  expect(await kept(id)).toEqual([]);
  await press('school-agree');
  expect(shown('school-joined')).toBe(true);
  expect(await kept(id)).toHaveLength(1);
  expect(teacher.rows).toHaveLength(0);
  await press('school-back');
  expect(shown('school-join')).toBe(false);
  await press('world-school-open');
  expect(shown('school-joined')).toBe(true);
  expect(server.seen.filter((one) => one.path.endsWith('/certificates'))).toHaveLength(1);
});

test('a code that is none, of another world or already used, and a camera that fails, are each said', async () => {
  const id = await entered();
  os.replaceValue('android');
  await press('world-school-open');
  NativeInput.scanQr.mockResolvedValueOnce(null);
  await press('school-scan');
  expect(texts()).not.toContain(text.demo.school.problem.code);
  for (const [scanned, words] of [
    ['not a joining code', text.demo.school.problem.code],
    [await codeFor(id === 'ABCDE' ? 'FGHJK' : 'ABCDE'), text.demo.school.problem.world],
  ] as const) {
    NativeInput.scanQr.mockResolvedValueOnce(scanned);
    await press('school-scan');
    expect(texts()).toContain(words);
  }
  NativeInput.scanQr.mockRejectedValueOnce(Object.assign(new Error('no camera'), { code: 'E_CALENDAR_CAMERA' }));
  await press('school-scan');
  expect(texts()).toContain(text.demo.school.problem.camera);
  NativeInput.scanQr.mockRejectedValueOnce(new Error('made-up failure'));
  await press('school-scan');
  expect(texts()).toContain(text.demo.school.problem.scan);
  const used = await usedCode(id);
  NativeInput.scanQr.mockResolvedValueOnce(used);
  await press('school-scan');
  await press('school-cancel');
  expect(shown('school-trial')).toBe(true);
  NativeInput.scanQr.mockResolvedValueOnce(used);
  await press('school-scan');
  await press('school-agree');
  expect(texts()).toContain(text.demo.school.problem.taken);
  expect(shown('school-joined')).toBe(false);
});

test('on a PC the code is pasted, and Android’s back leads home', async () => {
  const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.add(handler);
    return { remove: () => void handlers.delete(handler) };
  });
  const id = await entered();
  await press('world-school-open');
  expect(live()[0].props.children).toBe(text.demo.school.title);
  expect(button('school-scan').disabled).toBe(true);
  const field = tree!.root.findAllByProps({ testID: 'school-paste' })[0];
  await ReactTestRenderer.act(() => (field.props as { onChangeText: (one: string) => void }).onChangeText(' x '));
  await press('school-scan');
  expect(texts()).toContain(text.demo.school.problem.code);
  const code = await codeFor(id);
  await ReactTestRenderer.act(() => (field.props as { onChangeText: (one: string) => void }).onChangeText(`${code}\n`));
  await ReactTestRenderer.act(() => (field.props as { onSubmitEditing: () => void }).onSubmitEditing());
  await press('school-agree');
  expect(shown('school-joined')).toBe(true);
  expect(live()[0].props.children).toBe(text.demo.school.joined);
  expect(NativeInput.scanQr).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => {
    [...handlers].reverse().some((handler) => handler({ type: 'hardwareBackPress', timeStamp: 0 }) === true);
    await settle();
  });
  expect(shown('school-join')).toBe(false);
  expect(shown('world-school-open')).toBe(true);
});

test('reopening shows the code that joined after a used one, and a check that fails is said', async () => {
  const id = await entered();
  os.replaceValue('android');
  const used = await usedCode(id);
  await press('world-school-open');
  NativeInput.scanQr.mockResolvedValueOnce(used);
  await press('school-scan');
  await press('school-agree');
  expect(texts()).toContain(text.demo.school.problem.taken);
  NativeInput.scanQr.mockResolvedValueOnce(await codeFor(id));
  await press('school-scan');
  await press('school-agree');
  expect([count('school-joined'), count('school-code')]).toEqual([1, 1]);
  expect(await kept(id)).toHaveLength(2);
  await press('school-back');
  const said = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  const fetch = server.fetch.bind(server);
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  jest.spyOn(server, 'fetch').mockImplementation((address, init) => held.then(() => fetch(address, init)));
  await press('world-school-open');
  expect([count('school-checking'), count('school-code')]).toEqual([1, 0]);
  expect(said).toHaveBeenLastCalledWith(`${text.demo.school.title}. ${text.demo.school.checking}`);
  await settled(release);
  expect(count('school-joined')).toBe(1);
  expect(texts()).not.toContain(text.demo.school.problem.taken);
  await press('school-back');
  server.busy = true;
  await press('world-school-open');
  expect([count('school-joined'), count('school-trial')]).toEqual([0, 1]);
  expect(texts()).toContain(text.demo.problem.busy);
});

test('on the phone the title and the join are said, and two presses on agree join once', async () => {
  const said = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  said.mockClear();
  const id = await entered();
  os.replaceValue('android');
  await press('world-school-open');
  expect(said).toHaveBeenLastCalledWith(text.demo.school.title);
  NativeInput.scanQr.mockResolvedValueOnce(await codeFor(id));
  await press('school-scan');
  await press('school-agree', 2);
  expect(count('school-joined')).toBe(1);
  expect(said.mock.calls.filter(([words]) => words === text.demo.school.joined)).toHaveLength(1);
  expect(await kept(id)).toHaveLength(1);
  expect(server.seen.filter((one) => one.path.endsWith('/certificates'))).toHaveLength(1);
  expect(said).toHaveBeenLastCalledWith(text.demo.school.joined);
});

test('neither the inspector nor a teachers’ world offers the school’s space', async () => {
  await entered('national', 'inspector');
  expect(shown('world-school-open')).toBe(false);
  await press('world-leave');
  await ReactTestRenderer.act(() => tree!.unmount());
  await entered('teachers', 'teacher');
  expect(shown('world-school-open')).toBe(false);
});
