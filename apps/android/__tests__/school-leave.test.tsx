// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Leaving the school's space with a full copy (#567, answer 589), against a
// made-up demo server: once joined, a card opens Leave under the band, its
// title said, which names no new school, since a demo world holds no assignment
// list, and says membership lasts to the year's 31 August and the next school's
// begins on 1 September; what stays with the teacher; what stays with the
// school, its copy drawn with the school, and what no longer reaches the
// device, said as such; this year's pupils' data and when erasing is offered;
// joining the next school with its code, which leads back to the code's card
// and scrolls it into view; the export, which a demo world does not make; and
// that nothing is deleted on leaving, in a device's words on a PC; opening and
// leaving it records nothing; and Android's back returns to School-join. Every
// world, school and key is made up.

import { joinCodeText, makeJoinCode, newId, type OpenedKeyring, type SchoolCalendar } from '@minhajna/core';
import { BackHandler, Platform, ScrollView, Text, type LayoutChangeEvent, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { worldDate } from '../src/demo/world-date';
import { Icon } from '../src/design/Icon';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { openRecordBook } from '../src/storage/history';
import { worldSpec } from '../src/storage/world';
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
let world = new FakeWorld(teacher);
let os: jest.ReplaceProperty<typeof Platform.OS>;
const leave = text.demo.leave;
const ring = {
  ring: { school: 'made-up-school-of-the-leave' },
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
  world = new FakeWorld(teacher);
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
        world={world.asSpec()}
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

/** Joins with the code's first issue, then opens Leave. */
async function leaving() {
  const id = await opened();
  await joinWith(await issue(id, 1));
  await press('school-leave-open');
  return id;
}

const day = (value: string) => worldDate(i18n.t.bind(i18n), value as never, 'ar', read.ok ? read.profile : {});

test('Leave says what stays and what goes, with the year’s dates, and names no new school', async () => {
  await leaving();
  expect(shown('school-leave')).toBe(true);
  expect(live('leave-said')).toBe(leave.title);
  expect(texts()).toEqual(
    expect.arrayContaining([
      leave.title,
      leave.move,
      leave.from.replace('{{date}}', day('2027-09-01')),
      leave.moveLine.replace('{{date}}', day('2027-08-31')),
      leave.kept1,
      leave.kept4,
      leave.school1,
      leave.pc.school2.replace('{{date}}', day('2027-08-31')),
      leave.pupils.replace('{{year}}', '2026-2027'),
      leave.pc.pupilsLine.replace('{{next}}', '2027-2028'),
      leave.pc.nextLine.replace('{{next}}', '2027-2028'),
      leave.exportLine,
      leave.pc.nothing,
    ]),
  );
  const said = tree!.root.findAll(
    (node) => typeof node.props.accessibilityLabel === 'string' && typeof node.type === 'string',
  );
  const labels = said.map((node): unknown => node.props.accessibilityLabel);
  expect(labels).toContain(`${leave.notAnyMore}: ${leave.pc.school2.replace('{{date}}', day('2027-08-31'))}`);
  const school = tree!.root.find((node) => node.props.accessibilityLabel === `${leave.atSchool}: ${leave.school1}`);
  expect(school.findByType(Icon).props.name).toBe('school');
  await press('leave-join');
  expect(shown('school-join') && shown('school-code') && !shown('school-leave')).toBe(true);
  const scroller = tree!.root.findByType(ScrollView).instance as { scrollTo: jest.Mock };
  const code = tree!.root.find((node) => typeof node.type === 'string' && typeof node.props.onLayout === 'function');
  const laid = (y: number) => ({ nativeEvent: { layout: { x: 0, y, width: 360, height: 200 } } }) as LayoutChangeEvent;
  await settled(() => (code.props.onLayout as (event: LayoutChangeEvent) => void)(laid(420)));
  await settled(() => (code.props.onLayout as (event: LayoutChangeEvent) => void)(laid(480)));
  expect(scroller.scrollTo.mock.calls).toEqual([[{ y: 420, animated: false }]]);
});

test('opening and leaving the page records nothing, and Android’s back returns to School-join', async () => {
  const id = await leaving();
  const entries = async () => (await openRecordBook(worldSpec(teacher.asSpec(), world.asSpec(), id))).entries.length;
  const kept = await entries();
  await press('leave-back');
  expect(shown('school-join') && !shown('school-leave')).toBe(true);
  os.replaceValue('android');
  await press('school-leave-open');
  expect(texts()).toEqual(expect.arrayContaining([leave.nothing, leave.pupilsLine.replace('{{next}}', '2027-2028')]));
  await back();
  expect(shown('school-join') && !shown('school-leave')).toBe(true);
  expect(await entries()).toBe(kept);
});
