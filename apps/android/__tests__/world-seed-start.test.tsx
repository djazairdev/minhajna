// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Starting a national world from the demo entry on a PC (#548, answer 625),
// against a made-up demo server: a seeding the server refuses says why, shows
// no world and leaves the network shut, so starting again works; and a start
// whose store does not open leaves no world and the network shut. Every world
// is made up.

import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { calendar, profile, reference } from '../jest/world-calendar';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import type { Send } from '../src/demo/world-session';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import ar from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;

async function press(testID: string) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

async function entry(send: Send) {
  jest.replaceProperty(Platform, 'OS', 'web');
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <DemoRoot
          kit={nodeKit}
          calendar={calendar}
          profile={profile}
          storage={teacher.asSpec()}
          world={world.asSpec()}
          send={send}
          reference={reference}
          onBack={() => undefined}
          onLeft={() => undefined}
        />
      </LocaleDirContext.Provider>,
    );
    await settle();
  });
}

test('a seeding the server refuses says why and shows no world, and starting again works', async () => {
  let refusing = true;
  await entry((request) =>
    refusing && request.path.endsWith('/seed/batches')
      ? Promise.resolve({ status: 429, body: null, retryAfter: 12 })
      : server.send(request),
  );
  await press('demo-start-national');
  expect(texts()).toContain(ar.demo.problem.busy);
  expect([has('world-role-ministry'), worldNetworkOpen()]).toEqual([false, null]);
  refusing = false;
  await press('demo-start-national');
  expect(has('world-role-ministry')).toBe(true);
});

test('a start whose store does not open leaves no world and the network shut', async () => {
  world.open = 'ZZZZZ';
  await entry(server.send);
  await press('demo-start-national');
  expect([has('world-role-ministry'), worldNetworkOpen()]).toEqual([false, null]);
  expect(server.seen.filter((one) => one.path.endsWith('/seed/batches'))).toHaveLength(5);
});
