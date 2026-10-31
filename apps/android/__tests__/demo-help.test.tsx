// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo worlds from Help on the phone (#561, answer 575), in the whole app,
// against a made-up demo server: Help leads to them only where the app has
// the cryptography for worlds; going there locks the teacher's history first,
// and going back shows the lock, whose PIN opens Help again as it was; a
// world started on a PC is entered by its code, as a teacher or an inspector
// alone; Android's back button goes back from the entry and from a role, and
// stays on the roles; a phone that cannot work out a world's keys says so in a
// phone's words; and leaving it shuts the network and the world's store, and
// brings the lock back, then Help, with the teacher's history untouched. Every
// world, record and PIN is made up.

import { makeWorldCode, parseDay, type RecordEvent, type SchoolCalendar } from '@minhajna/core';
import { BackHandler, Text, type PressableProps, type TextInputProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { typePin } from '../jest/unlock';
import { DemoServer, nodeKit } from '../jest/world-server';
import { TextField } from '../src/components/TextField';
import { startWorld } from '../src/demo/world-session';
import NativeWorld from '../src/native/NativeMinhajnaWorld';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const calendar: SchoolCalendar = read.calendar;
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
const shown = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;

/** A phone set up under a made-up PIN, with the world module over its own storage. */
async function setUpPhone(): Promise<FakeStorage> {
  const storage = new FakeStorage();
  const school: RecordEvent = {
    kind: 'school.set',
    school: { id: 'school-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['arabic'], zone: '16' },
  };
  const book = await openRecordBook(storage.asSpec());
  await book.recordAll(parseDay('2026-10-15'), [school, { kind: 'setup.finished' }]);
  storage.pin = '1234';
  const spec = new FakeWorld(storage).asSpec();
  jest.spyOn(NativeWorld, 'enterWorld').mockImplementation((id) => spec.enterWorld(id));
  jest.spyOn(NativeWorld, 'leaveWorld').mockImplementation(() => spec.leaveWorld());
  jest.spyOn(NativeWorld, 'loadHistory').mockImplementation(() => spec.loadHistory());
  jest.spyOn(NativeWorld, 'appendEntry').mockImplementation((entry) => spec.appendEntry(entry));
  jest.spyOn(NativeWorld, 'eraseContent').mockImplementation((ids) => spec.eraseContent(ids));
  jest.spyOn(NativeWorld, 'eraseWorld').mockImplementation((id) => spec.eraseWorld(id));
  return storage;
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

/** Android's back button, as the app's own handlers hear it, the latest first. */
function backButton() {
  const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.add(handler);
    return { remove: () => void handlers.delete(handler) };
  });
  return () =>
    ReactTestRenderer.act(async () => {
      [...handlers].reverse().some((handler) => handler({ type: 'hardwareBackPress', timeStamp: 0 }) === true);
      await settle();
    });
}

async function enter(code: string) {
  await press('help-worlds');
  await until('demo-code');
  const [input] = tree!.root.findAll((node) => node.type === TextField && node.props.testID === 'demo-code');
  await ReactTestRenderer.act(async () => {
    (input.props as TextInputProps).onChangeText?.(code);
    await settle();
  });
  await press('demo-join');
}

/** The app opened past its lock and on Help. */
async function onHelp(storage: FakeStorage, worldKit: typeof nodeKit | null) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App storage={storage.asSpec()} worldKit={worldKit} />);
    await settle();
  });
  await typePin(tree!);
  await press('today-help');
  await until('help-problem');
}

test('Help leads to the demo worlds only where the app has their cryptography', async () => {
  await onHelp(await setUpPhone(), null);
  expect(shown('help-worlds')).toBe(false);
  await ReactTestRenderer.act(() => tree!.unmount());
  await onHelp(await setUpPhone(), nodeKit);
  expect(shown('help-worlds')).toBe(true);
});

test('going there locks the history first, and going back shows the lock, then Help as it was', async () => {
  const storage = await setUpPhone();
  await onHelp(storage, nodeKit);
  await press('help-worlds');
  await until('demo-code');
  expect(storage.opened).toBe(false);
  expect(shown('demo-start-national')).toBe(false);
  expect(shown('tab-Today')).toBe(false);
  await press('demo-back');
  await until('pin-1');
  await typePin(tree!);
  await until('help-worlds');
  expect(storage.opened).toBe(true);
});

test('a PC’s world is entered by its code as a teacher, and leaving brings the lock, then Help', async () => {
  const storage = await setUpPhone();
  const started = await startWorld('national', calendar, nodeKit, server.send);
  leaveWorldNetwork();
  await onHelp(storage, nodeKit);
  const before = JSON.stringify(storage.rows);
  await enter(started.code);
  await until('world-role-teacher');
  expect(shown('world-role-inspector')).toBe(true);
  expect(shown('world-role-director')).toBe(false);
  expect(worldNetworkOpen()).toBe(started.keys.world);
  expect(storage.worldOpen).toBe(true);
  await press('world-role-teacher');
  expect(shown('world-move-date')).toBe(false);
  await press('world-leave');
  await until('pin-1');
  expect(worldNetworkOpen()).toBeNull();
  expect(storage.worldOpen).toBe(false);
  expect(JSON.stringify(storage.rows)).toBe(before);
  await typePin(tree!);
  await until('help-worlds');
});

test('the back button leaves the entry for the lock, and a role for the roles, but not the world', async () => {
  const storage = await setUpPhone();
  const started = await startWorld('national', calendar, nodeKit, server.send);
  leaveWorldNetwork();
  const back = backButton();
  await onHelp(storage, nodeKit);
  await press('help-worlds');
  await until('demo-code');
  await back();
  await until('pin-1');
  await typePin(tree!);
  await until('help-worlds');
  await enter(started.code);
  await until('world-role-teacher');
  await press('world-role-teacher');
  await until('world-change-role');
  await back();
  await until('world-role-inspector');
  await back();
  expect(shown('world-role-inspector')).toBe(true);
  expect(storage.worldOpen).toBe(true);
});

test('a phone that cannot work out a world’s keys says so in a phone’s words', async () => {
  const storage = await setUpPhone();
  const broken = { ...nodeKit, kdf: () => Promise.reject(new Error('Made-up failure')) };
  await onHelp(storage, broken);
  await enter(makeWorldCode(nodeKit.random));
  const words = tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
  for (let turn = 0; turn < 100 && !words.includes(text.demo.problem.device); turn += 1) {
    await ReactTestRenderer.act(async () => {
      await settle();
    });
    words.splice(0, words.length, ...tree!.root.findAllByType(Text).map((node) => (node.props as TextProps).children));
  }
  expect(words).toContain(text.demo.problem.device);
  expect(words).not.toContain(text.demo.problem.pc.device);
});
