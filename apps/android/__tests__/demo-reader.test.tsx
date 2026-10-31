// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode inside a demo world (#563, answer 577), against a made-up demo
// server, on the phone and on a PC: the teacher and the inspector open it from
// the world's home, the band first, each page said as it opens; a statement
// signed in the world is checked, kept in the world's store on the world's date
// and placed in its picture, never in the teacher's own; a real statement, or
// one of another world, is refused in the world's words; the picture's list and
// a statement follow one another, and going back, by the button or Android's
// back, leads to the page before, then to the world's home; leaving the world
// from there forgets it; a world without reference data offers no reader; and a
// store whose kept world is not this one opens nothing. Every world, key and
// statement is made up.

import {
  makeWorldCode,
  parseDay,
  receivedStatements,
  signStatement,
  type SchoolCalendar,
  type WorldKind,
} from '@minhajna/core';
import { AccessibilityInfo, BackHandler, Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { calendarInput as NativeInput } from '../jest/calendar-input';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { madeUpStatement } from '../jest/reader-statements';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { WorldReader } from '../src/demo/WorldReader';
import signature from '../src/native/NativeMinhajnaSignature';
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
const reference = read;
const calendar: SchoolCalendar = read.calendar;
const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
let os: jest.ReplaceProperty<typeof Platform.OS>;

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
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const shown = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
const said = () => String(tree!.root.findByProps({ testID: 'world-reader-said' }).props.children);
const heading = () =>
  tree!.root
    .findByProps({ testID: 'world-reader' })
    .findAll((node) => node.type === Text && node.props.accessibilityRole === 'header')
    .map((node) => (node.props as TextProps).children)[0];

async function press(testID: string) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

/** A world of the kind started on this PC, entered as `role`, its reader open. */
async function reading(kind: WorldKind = 'national', role = 'teacher', given = true) {
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
        {...(given && { reference })}
      />,
    );
    await settle();
  });
  await press(`demo-start-${kind}`);
  await press(`world-role-${role}`);
  if (given) await press('world-reader-open');
  return worldNetworkOpen()!;
}

/** A statement signed with the teacher's made-up key, in a world or none, read from a file. */
async function openFile(named: string | null, section = '4M2') {
  const statement = madeUpStatement('2026-10-01', section);
  const file = await signStatement(statement, await signature.teacherKey(), (one) => signature.sign(one), named);
  NativeInput.readStatement.mockResolvedValueOnce(file);
  await press('reader-file');
}

test('a teacher opens the world’s reader from its home, under the band, and keeps its statements', async () => {
  const id = await reading();
  const shell = tree!.root.findByProps({ testID: 'world-reader' });
  const named = shell.findAll((node) => typeof node.props.testID === 'string' && node.props.testID !== 'world-reader');
  expect(named[0].props.testID).toBe('demo-band');
  expect(heading()).toBe(text.reader.picture.title);
  expect(said()).toBe(text.reader.picture.title);
  await press('reader-picture-open');
  expect(heading()).toBe(text.reader.open);
  expect(said()).toBe(text.reader.open);
  await openFile(id);
  expect(shown('reader-checked')).toBe(true);
  const book = await openRecordBook(worldSpec(teacher.asSpec(), world.asSpec(), id));
  const kept = receivedStatements(book.entries);
  expect(kept.map((one) => one.statement.class.section)).toEqual(['4M2']);
  expect(book.entries.at(-1)?.day).toBe(server.worlds.get(id)!.date);
  expect(teacher.rows).toHaveLength(0);
  await press('world-reader-back');
  expect(heading()).toBe(text.reader.picture.title);
  expect(shown('reader-grade')).toBe(true);
});

test('a real statement, or one of another world, is refused in the world’s words and never kept', async () => {
  const id = await reading('national', 'inspector');
  await press('reader-picture-open');
  await openFile(null);
  expect(texts()).toContain(text.reader.problems.otherWorld);
  expect(texts()).not.toContain(text.reader.problems.world);
  await openFile(makeWorldCode(nodeKit.random).slice(0, 5));
  expect(texts()).toContain(text.reader.problems.otherWorld);
  const book = await openRecordBook(worldSpec(teacher.asSpec(), world.asSpec(), id));
  expect(receivedStatements(book.entries)).toEqual([]);
});

test('the list and a statement follow one another, and back leads to the page before, then home', async () => {
  const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.add(handler);
    return { remove: () => void handlers.delete(handler) };
  });
  const back = () =>
    ReactTestRenderer.act(async () => {
      [...handlers].reverse().some((handler) => handler({ type: 'hardwareBackPress', timeStamp: 0 }) === true);
      await settle();
    });
  await reading();
  os.replaceValue('android');
  const announced = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  announced.mockClear();
  await press('reader-picture-list');
  expect(heading()).toBe(text.reader.title);
  expect(announced).toHaveBeenLastCalledWith(text.reader.title);
  await press('reader-open');
  expect(heading()).toBe(text.reader.open);
  await back();
  expect(heading()).toBe(text.reader.title);
  await press('reader-picture');
  expect(heading()).toBe(text.reader.picture.title);
  await back();
  expect(shown('world-reader')).toBe(false);
  expect(shown('world-reader-open')).toBe(true);
  await press('world-leave');
  expect(worldNetworkOpen()).toBeNull();
  expect(world.open).toBeNull();
});

test('a world without reference data offers no reader, and a workspace role has none', async () => {
  await reading('national', 'teacher', false);
  expect(shown('world-reader-open')).toBe(false);
  await press('world-leave');
  await ReactTestRenderer.act(() => tree!.unmount());
  await reading('teachers', 'observatory', false);
  expect(shown('world-reader-open')).toBe(false);
});

test('a store whose kept world is not this one opens nothing', async () => {
  const book = await openRecordBook(new FakeStorage().asSpec());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <WorldReader
        world={{ book, code: makeWorldCode(nodeKit.random), date: parseDay('2026-12-17') }}
        date="made-up"
        reference={reference}
        random={nodeKit.random}
        onClose={jest.fn()}
      />,
    );
  });
  expect(texts()).toContain(text.demo.problem.pc.store);
  expect(shown('reader-picture-open')).toBe(false);
});
