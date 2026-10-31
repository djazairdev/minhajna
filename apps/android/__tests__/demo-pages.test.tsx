// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo worlds' pages on a PC (#560, answers 572 and 573), against a
// made-up demo server: a code that does not read, a world nobody started and
// a busy server each say so; a teachers' world holds a teacher alone, its
// page announced once on the phone; a world joined from another device shows
// its code but cannot move its date; the starting device finds its starter
// token again when it enters the code once more; the world's store keeps its
// kind and code, apart from the teacher's, and goes once the server no longer
// knows the code, unless it holds another code, or at once when kept without
// its key; a store that does not open, or will not close, says so with the
// network shut; a second press starts no second world; and the last announced
// day says so. Every world is made up.

import { keptWorld, makeWorldCode, type SchoolCalendar } from '@minhajna/core';
import { AccessibilityInfo, Text, type PressableProps, type TextInputProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { TextField } from '../src/components/TextField';
import { DemoRoot } from '../src/demo/DemoRoot';
import { forgetWorld, leaveWorld, openWorld } from '../src/demo/world-mode';
import { startWorld } from '../src/demo/world-session';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
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
const left = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
  left.mockClear();
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function render() {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <DemoRoot
        kit={nodeKit}
        calendar={calendar}
        profile={read.ok ? read.profile : {}}
        storage={teacher.asSpec()}
        world={world.asSpec()}
        send={server.send}
        onBack={() => undefined}
        onLeft={left}
      />,
    );
    await settle();
  });
}

const shown = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);

async function turns() {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      await settle();
    });
}

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
    await settle();
  });
  await turns();
}

async function join(code: string) {
  const [input] = tree!.root.findAll((node) => node.type === TextField && node.props.testID === 'demo-code');
  await ReactTestRenderer.act(async () => {
    (input.props as TextInputProps).onChangeText?.(code);
    await settle();
  });
  await press('demo-join');
}

/** A world started on another device, its network left there. */
async function startedElsewhere(kind: 'national' | 'teachers' = 'national') {
  const started = await startWorld(kind, calendar, nodeKit, server.send);
  leaveWorldNetwork();
  return started;
}

test('a code that does not read, a world nobody started and a busy server each say so', async () => {
  await render();
  await join('not a code');
  expect(texts()).toContain(text.demo.problem.code);
  const gone = await startedElsewhere();
  server.worlds.delete(gone.keys.world);
  await join(gone.code);
  expect(texts()).toContain(text.demo.problem.none);
  server.busy = true;
  await press('demo-start-national');
  expect(texts()).toContain(text.demo.problem.busy);
  expect(worldNetworkOpen()).toBeNull();
  expect(world.open).toBeNull();
});

test('a teachers’ world holds a teacher alone, and the phone hears its page once', async () => {
  const announced = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  announced.mockClear();
  await render();
  await press('demo-start-teachers');
  expect(shown('world-role-teacher')).toBe(true);
  expect(shown('world-role-ministry')).toBe(false);
  expect(shown('world-said')).toBe(false);
  expect(announced).toHaveBeenCalledTimes(1);
  expect(announced).toHaveBeenCalledWith(expect.stringContaining(text.demo.roles.title));
});

test('a world joined from elsewhere shows its code, keeps its kind, and cannot move its date', async () => {
  const started = await startedElsewhere('teachers');
  await render();
  await join(started.code.toLowerCase());
  expect(shown('world-role-teacher')).toBe(true);
  expect(shown('world-move-date')).toBe(false);
  expect(tree!.root.findByProps({ testID: 'world-code' }).props.children).toBe(started.code.match(/.{5}/gu)!.join(' '));
  const book = await openRecordBook(worldSpec(teacher.asSpec(), world.asSpec(), started.keys.world));
  expect(keptWorld(book.entries)).toEqual({ kind: 'teachers', code: started.code, starter: null });
  expect(teacher.rows).toHaveLength(0);
});

test('the starting device finds its token again by the code, until the last announced day', async () => {
  await render();
  await press('demo-start-national');
  const code = String(tree!.root.findByProps({ testID: 'world-code' }).props.children).replaceAll(' ', '');
  await press('world-leave');
  expect(left).toHaveBeenCalledTimes(1);
  expect(worldNetworkOpen()).toBeNull();
  expect(world.open).toBeNull();
  await join(code);
  expect(shown('world-move-date')).toBe(true);
  server.worlds.get(code.slice(0, 5))!.announced.length = 0;
  await press('world-move-date');
  expect(texts()).toContain(text.demo.problem.lastDay);
});

test('a store that does not open, or will not close, says so with the network shut', async () => {
  await render();
  const refused = Object.assign(new Error('Made-up refusal'), { code: 'E_WORLD' });
  jest.spyOn(world, 'enterWorld').mockRejectedValueOnce(refused);
  await press('demo-start-national');
  expect(texts()).toContain(text.demo.problem.store);
  expect(worldNetworkOpen()).toBeNull();
  await press('demo-start-national');
  jest.spyOn(world, 'leaveWorld').mockRejectedValueOnce(refused);
  await press('world-leave');
  expect(texts()).toContain(text.demo.problem.store);
  expect(shown('world-leave')).toBe(true);
  expect(worldNetworkOpen()).toBeNull();
  expect(left).not.toHaveBeenCalled();
});

test('a second press while the first works starts no second world', async () => {
  await render();
  await ReactTestRenderer.act(async () => {
    const start = tree!.root.findAllByProps({ testID: 'demo-start-national' })[0].props as PressableProps;
    start.onPress?.({} as never);
    start.onPress?.({} as never);
    await settle();
  });
  await turns();
  expect(server.worlds.size).toBe(1);
  expect(shown('world-role-ministry')).toBe(true);
});

test('a code the server no longer knows erases its store, unless the store holds another code', async () => {
  const started = await startedElsewhere();
  await render();
  await join(started.code);
  await press('world-leave');
  expect(world.worlds.has(started.keys.world)).toBe(true);
  server.worlds.delete(started.keys.world);
  await join(started.code);
  expect(texts()).toContain(text.demo.problem.none);
  expect(world.worlds.has(started.keys.world)).toBe(false);

  const other = makeWorldCode(nodeKit.random);
  const found = {
    world: started.keys.world,
    kind: 'national' as const,
    code: other,
    date: started.date,
    starter: null,
  };
  await leaveWorld(world.asSpec());
  await openWorld(found, teacher.asSpec(), world.asSpec());
  await leaveWorld(world.asSpec());
  await forgetWorld(started.code, teacher.asSpec(), world.asSpec());
  expect(world.worlds.has(started.keys.world)).toBe(true);
  expect(world.open).toBeNull();

  world.worlds.get(started.keys.world)!.keyLost = true;
  await expect(forgetWorld(started.code, teacher.asSpec(), world.asSpec())).rejects.toMatchObject({
    code: 'E_KEY_LOST',
  });
  expect(world.worlds.has(started.keys.world)).toBe(false);
  expect(world.open).toBeNull();
});
