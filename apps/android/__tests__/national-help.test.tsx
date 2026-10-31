// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Help in the national system (#568, answer 604), against a made-up demo
// server: once joined, a card opens who reads what, and by which key, under the
// band, its title said, with first that the list is the national system's and
// that this demo connects only to the demo server, by its address; then the
// problem report and crash reports, off unless turned on; then the updates, the
// Ministry's server, the state's certifier and reports, each with who reads it
// and by which key; nothing else; the day the sync moved, the day the teacher
// joined; and where the privacy notice is. Each joined card opens the page for
// its own school, and also opens Week-sign, the weekly digest and the teacher's
// classes in the school's space under the band and the school's timetable, each
// with its title said, Week-sign, the digest and the classes leading back; and
// the page's hidden live region is the PC's alone. Going back, by the button or
// Android's back, returns to School-join. Every world, school and key is made
// up.

import { joinCodeText, makeJoinCode, newId, type OpenedKeyring, type SchoolCalendar } from '@minhajna/core';
import { BackHandler, Platform, Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { Button } from '../src/components/Button';
import { DemoRoot } from '../src/demo/DemoRoot';
import { worldDate } from '../src/demo/world-date';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { DEMO_SERVER } from '../src/network/world-network';
import { shortSchool } from '../src/school/SchoolJoined';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

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
const help = text.demo.help;
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
const other = { ...ring, ring: { school: 'made-up-school-of-the-second' } } as unknown as OpenedKeyring;
const issue = async (world: string, number: number, keyring = ring) =>
  joinCodeText(await makeJoinCode(keyring, world, assignment, number, { mac: nodeKit.mac } as never));

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

test('once joined, who reads what opens under the band, says the demo first, and leads back', async () => {
  const id = await opened();
  await joinWith(await issue(id, 1));
  await press('school-help');
  const page = tree!.root.findByProps({ testID: 'national-help' });
  expect(page.findAll((node) => node.props.testID === 'demo-band').length).toBeGreaterThan(0);
  expect(live('help-said')).toBe(help.title);
  const day = worldDate(i18n.t.bind(i18n), '2026-12-17' as never, 'ar', read.ok ? read.profile : {});
  const words = [
    help.demo.replace('{{address}}', isolate(DEMO_SERVER.replace('https://', ''))),
    help.reportsHead,
    help.problem.line,
    help.crashes.line,
    help.connectionsHead,
    ...(['updates', 'ministry', 'certifier', 'sent'] as const).flatMap((key) => [
      help[key].title,
      help[key].line,
      help[key].key,
    ]),
    help.nothingElse,
    help.moved.replace('{{date}}', day),
    help.privacy,
  ];
  const all = texts();
  for (const one of words) expect(all).toContain(one);
  expect(all.indexOf(words[0])).toBeLessThan(all.indexOf(help.reportsHead));
  expect(all.indexOf(help.reportsHead)).toBeLessThan(all.indexOf(help.connectionsHead));
  await press('help-back');
  expect(shown('school-join') && !shown('national-help')).toBe(true);
  expect(live('school-said')).toBe(text.demo.school.title);
  os.replaceValue('android');
  await press('school-help');
  expect(shown('national-help') && !shown('help-said')).toBe(true);
  await back();
  expect(shown('school-join') && !shown('national-help')).toBe(true);
});

test('each joined card opens the page for its own school', async () => {
  const id = await opened();
  await joinWith(await issue(id, 1));
  await joinWith(await issue(id, 1, other));
  const card = (at: number) =>
    settled(() => {
      const buttons = tree!.root.findAllByType(Button).filter((node) => node.props.testID === 'school-help');
      expect(buttons).toHaveLength(2);
      (buttons[at].props as PressableProps).onPress?.({} as never);
    });
  const bar = (school: string) => text.demo.devices.school.replace('{{school}}', shortSchool(school));
  await card(0);
  expect(texts()).toContain(bar('made-up-school-of-the-second'));
  await press('help-back');
  await card(1);
  expect(texts()).toContain(bar('made-up-school-of-the-rejoin'));
});

test('a joined card also opens Week-sign under the band, its title said, and leads back', async () => {
  const id = await opened();
  await joinWith(await issue(id, 1));
  await press('school-week');
  const page = tree!.root.findByProps({ testID: 'week-sign' });
  expect(page.findAll((node) => node.props.testID === 'demo-band').length).toBeGreaterThan(0);
  expect(live('week-sign-said')).toBe(text.demo.weekSign.title);
  await press('week-sign-back');
  expect(shown('school-join') && !shown('week-sign')).toBe(true);
});

test('a joined card opens the timetable from the school, its title said', async () => {
  const id = await opened();
  await joinWith(await issue(id, 1));
  await press('school-timetable');
  expect(live('teacher-said')).toBe(text.demo.timetable.title);
});

test('a joined card opens the weekly digest under the band, its title said, and leads back', async () => {
  const id = await opened();
  await joinWith(await issue(id, 1));
  await press('school-digest');
  const page = tree!.root.findByProps({ testID: 'digest' });
  expect(page.findAll((node) => node.props.testID === 'demo-band').length).toBeGreaterThan(0);
  expect(live('digest-said')).toBe(text.demo.digest.title);
  await press('digest-back');
  expect(shown('school-join') && !shown('digest')).toBe(true);
});

test('a joined card opens the teacher’s classes in the school’s space, its title said, and leads back', async () => {
  const id = await opened();
  await joinWith(await issue(id, 1));
  await press('school-mine');
  const page = tree!.root.findByProps({ testID: 'mine' });
  expect(page.findAll((node) => node.props.testID === 'demo-band').length).toBeGreaterThan(0);
  expect(live('mine-said')).toBe(text.demo.mine.title);
  await press('mine-back');
  expect(shown('school-join') && !shown('mine')).toBe(true);
});
