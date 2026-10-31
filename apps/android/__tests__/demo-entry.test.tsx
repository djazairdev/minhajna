// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo worlds from a PC's first pages (#560, answers 571, 573 and 575), in
// the app as the web build runs it, against a made-up demo server: the welcome
// and the lock page lead to them only on a PC that has the cryptography for
// worlds; a national world started from the lock page opens with no passphrase,
// shows the band first, then its roles, then a director's workspace, whose
// world page shows its code, each page announced with the band; its starter
// moves the date; and leaving shuts the network and the world's store and
// brings back the lock, or the welcome on a fresh PC, the teacher's history
// shut meanwhile and untouched; Help on a PC locks behind the passphrase, and
// its entry starts worlds too. No door shows when the reference data is
// refused. Every world and passphrase is made up.

import { parseDay, worldCodeGroups } from '@minhajna/core';
import {
  AccessibilityInfo,
  Platform,
  Text,
  type PressableProps,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { TextField } from '../src/components/TextField';
import { DemoBand } from '../src/demo/DemoBand';
import { WorldHome } from '../src/demo/WorldHome';
import NativeWorld from '../src/native/NativeMinhajnaWorld';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference } from '../src/reference';
import { openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';

jest.mock('../src/lock/Unlock', () => jest.requireActual<object>('../src/lock/Unlock.web'));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const server = new DemoServer();
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeAll(() => {
  globalThis.fetch = (address, init) =>
    server.fetch(typeof address === 'string' ? address : 'url' in address ? address.url : address.href, init ?? {});
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  await NativeWorld.leaveWorld();
  jest.restoreAllMocks();
  server.reset();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
/** The world module over the app's own storage, so a world shuts the teacher's history there. */
function worldOver(storage: FakeStorage): FakeWorld {
  const fake = new FakeWorld(storage);
  const spec = fake.asSpec();
  jest.spyOn(NativeWorld, 'enterWorld').mockImplementation((id) => spec.enterWorld(id));
  jest.spyOn(NativeWorld, 'leaveWorld').mockImplementation(() => spec.leaveWorld());
  jest.spyOn(NativeWorld, 'loadHistory').mockImplementation(() => spec.loadHistory());
  jest.spyOn(NativeWorld, 'appendEntry').mockImplementation((entry) => spec.appendEntry(entry));
  jest.spyOn(NativeWorld, 'eraseContent').mockImplementation((ids) => spec.eraseContent(ids));
  jest.spyOn(NativeWorld, 'eraseWorld').mockImplementation((id) => spec.eraseWorld(id));
  return fake;
}

async function render(element: React.ReactElement) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
    await settle();
  });
}

function shown(testID: string): boolean {
  return tree!.root.findAllByProps({ testID }).length > 0;
}

/** Waits, a turn at a time, until the element shows. */
async function until(testID: string) {
  for (let turn = 0; turn < 100 && !shown(testID); turn += 1) {
    await ReactTestRenderer.act(async () => {
      await settle();
    });
  }
  expect(shown(testID)).toBe(true);
}

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

/** Waits, a turn at a time, until the page has said the words, and returns all it said. */
async function heard(words: string): Promise<string> {
  const said = () => String(tree!.root.findByProps({ testID: 'world-said' }).props.children);
  for (let turn = 0; turn < 100 && !said().includes(words); turn += 1) {
    await ReactTestRenderer.act(async () => {
      await settle();
    });
  }
  expect(said()).toContain(words);
  return said();
}

function texts(): unknown[] {
  return tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
}

/** A PC under a made-up passphrase, with whatever history it already holds. */
function lockedPc(storage = new FakeStorage()): FakeStorage {
  storage.pinRule = /^.{12,}$/u;
  storage.pin = 'chalk on the green board';
  storage.created = true;
  return storage;
}

test('only a PC with the cryptography for worlds leads to them from the welcome', async () => {
  await render(<App storage={new FakeStorage().asSpec()} worldKit={nodeKit} />);
  expect(shown('welcome-demo')).toBe(false);
  await ReactTestRenderer.act(() => tree!.unmount());
  jest.replaceProperty(Platform, 'OS', 'web');
  await render(<App storage={new FakeStorage().asSpec()} />);
  expect(shown('welcome-demo')).toBe(false);
  await ReactTestRenderer.act(() => tree!.unmount());
  await render(<App storage={new FakeStorage().asSpec()} worldKit={nodeKit} />);
  await press('welcome-demo');
  expect(texts()).toContain(text.demo.entry.title);
  await press('demo-back');
  expect(shown('welcome-start')).toBe(true);
});

test('no door shows on refused reference data, and leaving on a fresh PC brings the welcome back', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const refused = { ...bundledReference, profile: {} as never };
  await render(<App storage={new FakeStorage().asSpec()} files={refused} worldKit={nodeKit} />);
  expect(shown('welcome-demo')).toBe(false);
  await ReactTestRenderer.act(() => tree!.unmount());
  const storage = new FakeStorage();
  worldOver(storage);
  await render(<App storage={storage.asSpec()} worldKit={nodeKit} />);
  await press('welcome-demo');
  await press('demo-start-teachers');
  await until('world-role-teacher');
  expect(storage.worldOpen).toBe(true);
  await press('world-leave');
  await until('welcome-start');
  expect(storage.worldOpen).toBe(false);
});

test('a world started from the lock page opens with no passphrase, and leaving brings the lock back', async () => {
  const storage = lockedPc();
  const before = JSON.stringify(storage.rows);
  const fake = worldOver(storage);
  const announced = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  announced.mockClear();
  jest.replaceProperty(Platform, 'OS', 'web');
  await render(<App storage={storage.asSpec()} worldKit={nodeKit} />);
  await press('passphrase-demo');
  await press('demo-start-national');
  await until('world-role-ministry');
  const world = worldNetworkOpen()!;
  expect(server.worlds.has(world)).toBe(true);
  expect(fake.open).toBe(world);
  expect(storage.worldOpen).toBe(true);
  expect(await heard(text.demo.roles.title)).toContain(`${text.demo.band}. `);
  for (const role of ['directorate', 'director', 'inspector', 'teacher'])
    expect(shown(`world-role-${role}`)).toBe(true);

  const home = tree!.root.findByType(WorldHome);
  const named = home.findAll((node) => typeof node.props.testID === 'string');
  expect(named[0].props.testID).toBe('demo-band');
  expect(home.findAllByType(DemoBand)).toHaveLength(1);
  const band = () => String(tree!.root.findByProps({ testID: 'demo-band' }).props.accessibilityLabel);
  const dated = band();

  await press('world-role-director');
  const heading = text.demo.home.role.replace('{{role}}', text.demo.roles.director);
  expect(texts()).toContain(text.demo.pages.dashboard);
  expect(await heard(heading)).toContain(`${text.demo.band}. `);
  expect(announced).not.toHaveBeenCalled();
  await press('world-page-world');
  const code = String(tree!.root.findByProps({ testID: 'world-code' }).props.children);
  expect(code.split(' ')).toHaveLength(4);
  expect(worldCodeGroups(code.replaceAll(' ', '')).join(' ')).toBe(code);

  await press('world-move-date');
  await until('world-move-date');
  expect(band()).not.toBe(dated);
  expect(server.worlds.get(world)!.date).toBe(server.worlds.get(world)!.announced[0]);

  await press('world-leave');
  await until('passphrase');
  expect(worldNetworkOpen()).toBeNull();
  expect(JSON.stringify(storage.rows)).toBe(before);
  expect(storage.opened).toBe(false);
});

test('Help on a PC locks behind the passphrase, and its entry starts worlds too', async () => {
  const setUp = new FakeStorage();
  const book = await openRecordBook(setUp.asSpec());
  await book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'school.set',
      school: { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
    },
    { kind: 'setup.finished' },
  ]);
  const storage = lockedPc(setUp);
  jest.replaceProperty(Platform, 'OS', 'web');
  await render(<App storage={storage.asSpec()} worldKit={nodeKit} />);
  const [input] = tree!.root.findAll((node) => node.type === TextField && node.props.testID === 'passphrase');
  await ReactTestRenderer.act(async () => {
    (input.props as TextInputProps).onChangeText?.(storage.pin!);
    await settle();
  });
  await press('passphrase-open');
  await until('today-help');
  await press('today-help');
  await until('help-worlds');
  await press('help-worlds');
  await until('demo-start-national');
  expect(shown('demo-start-teachers')).toBe(true);
  expect(storage.opened).toBe(false);
  await press('demo-back');
  await until('passphrase');
});
