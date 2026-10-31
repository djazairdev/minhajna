// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Rejoining on a new phone and the teacher's devices once joined (#566, answer
// 588), against a made-up demo server: before any join, School-join offers the
// way for a new phone, after «Not now» in the trial card; its page, whose title
// is said, says the class is not lost, scans the school's new code, a later
// issue of the same assignment, and says that the lost phone is removed, right
// under the card, and that the code binds this phone's key, at the foot, in a
// device's words on a PC; the new issue joins while the lost phone's issue
// stays its own and is refused when used again; going back, by the button or
// Android's back, returns to School-join, its problem cleared and its title
// said; once joined, a card opens the teacher's devices and copies under the
// band, its title said, with first that this demo moves nothing, the day they
// joined, the national system's steps with only the joining checked, what
// moves, that nothing is lost, that the keys stay, and this device with its own
// key, the phone's icon on the phone alone; and its way to the school's space,
// and Android's back, return to School-join. Every world, school and key is
// made up.

import { joinCodeText, makeJoinCode, newId, type OpenedKeyring, type SchoolCalendar } from '@minhajna/core';
import { BackHandler, Platform, Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { worldDate } from '../src/demo/world-date';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { joinSchool } from '../src/school/school-join-session';
import { openRecordBook } from '../src/storage/history';
import { i18n } from '../src/text/i18n';
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
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
let os: jest.ReplaceProperty<typeof Platform.OS>;
const { rejoin } = text.demo.school;
const devices = text.demo.devices;
const ring = {
  ring: { school: 'made-up-school-of-the-rejoin' },
  keys: [nodeKit.random(32)],
} as unknown as OpenedKeyring;
const assignment = newId(nodeKit.random);

const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();

beforeEach(() => {
  os = jest.replaceProperty(Platform, 'OS', 'web');
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
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const shown = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const texts = () =>
  tree!.root
    .findAllByType(Text)
    .map((node) => [(node.props as { children: unknown }).children].flat().map(String).join(''));
const live = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string')[0]?.props
    .children as unknown;
const props = (testID: string) => tree!.root.findAllByProps({ testID })[0].props as PressableProps;

async function settled(first: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) first();
      await settle();
    });
}

const press = (testID: string) => settled(() => props(testID).onPress?.({} as never));
/** Android's back, offered to the newest handler first, as Android does. */
const back = () =>
  settled(
    () => void [...handlers].reverse().some((handler) => handler({ type: 'hardwareBackPress', timeStamp: 0 }) === true),
  );
const issue = async (world: string, number: number) =>
  joinCodeText(await makeJoinCode(ring, world, assignment, number, { mac: nodeKit.mac } as never));

/** A national world started on this PC, entered as its teacher, School-join open. */
async function opened() {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <DemoRoot
        kit={nodeKit}
        calendar={calendar}
        profile={read.ok ? read.profile : { weekStartsOn: 0 }}
        storage={teacher.asSpec()}
        world={new FakeWorld(teacher).asSpec()}
        send={server.send}
        onBack={() => undefined}
        onLeft={() => undefined}
      />,
    );
    await settle();
  });
  await press('demo-start-national');
  await press('world-role-teacher');
  await press('world-school-open');
  return worldNetworkOpen()!;
}

/** Pastes a code and agrees to join with it. */
async function joinWith(code: string) {
  const paste = tree!.root.findByProps({ testID: 'school-paste' }).props as { onChangeText: (value: string) => void };
  await settled(() => paste.onChangeText(code));
  await press('school-scan');
  await press('school-agree');
}

/** The lost phone, which joined with the code's first issue. */
async function lostPhone(world: string) {
  const lost = { world, date: '2026-12-17' as never, book: await openRecordBook(new FakeStorage().asSpec()) };
  await joinSchool(lost, await issue(world, 1), nodeKit, server.send);
}

test('a new phone joins with the school’s new code, and the lost phone’s code stays its own', async () => {
  const id = await opened();
  await lostPhone(id);
  await press('school-rejoin-open');
  expect(texts()).toEqual(
    expect.arrayContaining([rejoin.pc.title, rejoin.pc.lead, rejoin.pc.removed, rejoin.pc.binds]),
  );
  expect(live('school-said')).toBe(rejoin.pc.title);
  expect(shown('school-enters') || shown('school-trial') || shown('school-rejoin-open')).toBe(false);
  expect(texts()).toContain(rejoin.pc.scan);
  await joinWith(await issue(id, 2));
  expect(shown('school-joined')).toBe(true);
  expect(texts()).toContain(text.demo.school.title);
  expect(shown('school-rejoin-open')).toBe(false);
  await joinWith(await issue(id, 1));
  expect(texts()).toContain(text.demo.school.problem.taken);
});

test('going back from the new phone’s page returns to School-join, its problem cleared', async () => {
  await opened();
  const order = tree!.root
    .findByProps({ testID: 'school-trial' })
    .findAll((node) => typeof node.type === 'string' && typeof node.props.testID === 'string')
    .map((node) => node.props.testID as string);
  expect(order.indexOf('school-not-now')).toBeLessThan(order.indexOf('school-rejoin-open'));
  await press('school-rejoin-open');
  const paste = tree!.root.findByProps({ testID: 'school-paste' }).props as { onChangeText: (value: string) => void };
  await settled(() => paste.onChangeText('not a joining code'));
  await press('school-scan');
  expect(texts()).toContain(text.demo.school.problem.code);
  await press('school-back');
  expect(shown('school-join') && shown('school-enters') && shown('school-rejoin-open')).toBe(true);
  expect(texts()).not.toContain(text.demo.school.problem.code);
  expect(live('school-said')).toBe(text.demo.school.title);
  os.replaceValue('android');
  await press('school-rejoin-open');
  expect(texts()).toEqual(expect.arrayContaining([rejoin.title, rejoin.lead, rejoin.removed, rejoin.binds]));
  await back();
  expect(shown('school-join') && !shown('school-rejoin')).toBe(true);
});

test('once joined, the teacher’s devices and copies open under the band, and lead back', async () => {
  const id = await opened();
  await joinWith(await issue(id, 1));
  await press('school-devices');
  const page = tree!.root.findByProps({ testID: 'devices-moved' });
  expect(page.findAll((node) => node.props.testID === 'demo-band').length).toBeGreaterThan(0);
  const day = worldDate(i18n.t.bind(i18n), '2026-12-17' as never, 'ar', read.ok ? read.profile : {});
  expect(texts()).toEqual(
    expect.arrayContaining([devices.joinedLine.replace('{{date}}', day), devices.since.replace('{{date}}', day)]),
  );
  for (const words of [devices.title, devices.moved, devices.demo, devices.what1, devices.lost1, devices.keys2])
    expect(texts()).toContain(words);
  expect(texts().indexOf(devices.demo)).toBeLessThan(texts().indexOf(devices.since.replace('{{date}}', day)));
  const host = (testID: string) =>
    tree!.root.findAllByProps({ testID }).filter((node) => typeof node.type === 'string');
  expect([host('devices-step').length, host('devices-done').length]).toEqual([3, 1]);
  expect(host('devices-done')[0].props.accessibilityLabel).toBe(devices.stepDone);
  const rings = tree!.root.findAll(
    (node) => typeof node.props.accessibilityLabel === 'string' && node.props.children !== undefined,
  );
  expect(rings.map((node): unknown => node.props.accessibilityLabel)).toEqual(
    expect.arrayContaining([devices.step.replace('{{number}}', '2'), devices.step.replace('{{number}}', '3')]),
  );
  expect(texts()).toEqual(expect.arrayContaining(['2', '3', devices.pc.this, devices.ownKey]));
  expect(live('devices-said')).toBe(devices.title);
  expect(host('devices-this')[0].findAll((node) => node.props.name === 'phone')).toHaveLength(0);
  await press('devices-space');
  expect(shown('school-join') && !shown('devices-moved')).toBe(true);
  os.replaceValue('android');
  await press('school-devices');
  expect(texts()).toContain(devices.this);
  expect(host('devices-this')[0].findAll((node) => node.props.name === 'phone').length).toBeGreaterThan(0);
  await back();
  expect(shown('school-join') && !shown('devices-moved')).toBe(true);
});
