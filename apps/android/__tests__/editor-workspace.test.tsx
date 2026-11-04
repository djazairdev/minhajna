// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// #611 opens from the national world's curator role, using its supplied
// reference catalogue, never the teacher's store. The old release stays
// beside the fix, examples keep their status, filtering writes nothing,
// leaving the page forgets its filter, and another role sees no pack page.
// The world, server, files and people in this test are all made up.

import { Platform, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The made-up bundled reference must read');
const reference = read;
const server = new DemoServer();
let teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const shown = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  teacher = new FakeStorage();
  world = new FakeWorld(teacher);
  jest.restoreAllMocks();
});

async function press(testID: string) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

async function curator() {
  jest.replaceProperty(Platform, 'OS', 'web');
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <DemoRoot
        kit={nodeKit}
        calendar={reference.calendar}
        profile={reference.profile}
        storage={teacher.asSpec()}
        world={world.asSpec()}
        send={server.send}
        reference={reference}
        onBack={() => undefined}
        onLeft={() => undefined}
      />,
    );
    await settle();
  });
  await press('demo-start-national');
  await press('world-role-curator');
}

test('the curator opens on the source pack list, including every bundled example release', async () => {
  await curator();
  expect(shown('editor-packs')).toBe(true);
  expect(shown('demo-band')).toBe(true);
  for (const pack of reference.packs) expect(shown(`editor-pack-${pack.id}@${pack.release}`)).toBe(true);
  const schoolPacks = reference.packs.filter((pack) => pack.id.includes('.4am.'));
  expect(schoolPacks.map((pack) => pack.release)).toEqual(['2026.1', '2026.2']);
  expect(reference.packs.every((pack) => pack.status === 'example')).toBe(true);
  const before = JSON.stringify(world.worlds.get(world.open!)!.rows);
  await press('editor-status-stale');
  expect(shown('editor-packs-empty')).toBe(true);
  expect(JSON.stringify(world.worlds.get(world.open!)!.rows)).toBe(before);
  expect(teacher.rows).toEqual([]);
  expect(teacher.worldOpen).toBe(true);
  await press('world-page-releases');
  expect(shown('editor-packs')).toBe(false);
  await press('world-page-packs');
  for (const pack of reference.packs) expect(shown(`editor-pack-${pack.id}@${pack.release}`)).toBe(true);
});

test('changing role removes the editor and the Ministry offers no packs page', async () => {
  await curator();
  await press('world-change-role');
  expect(shown('editor-packs')).toBe(false);
  await press('world-role-ministry');
  expect(shown('world-page-packs')).toBe(false);
  expect(shown('editor-packs')).toBe(false);
  expect(shown('world-page-calendar')).toBe(true);
});
