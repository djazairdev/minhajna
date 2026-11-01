// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The world's calendar in the pages of a demo world (#608, answer 624), against
// a made-up demo server: a PC joining a world keys the Ministry's calendar over
// the release that world holds, and another world over its own, while a reading
// that fails says so on the world's home and leaves the bundled calendar; over
// a new release the Ministry's page sets aside a kept draft that no longer
// fits; and a problem of the world's own is said before the calendar's. Every
// world and entry is made up.

import { draftUpdate, EMPTY_DRAFT, takeOutDraftEntry, worldSecrets, type CalendarUpdate } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Platform, Text, type PressableProps, type TextInputProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { calendar, exam, flakySend, moving, profile, publish, reference } from '../jest/world-calendar';
import { DemoServer, nodeKit } from '../jest/world-server';
import { TextField } from '../src/components/TextField';
import { DemoRoot } from '../src/demo/DemoRoot';
import { startWorld } from '../src/demo/world-session';
import { enterWorldNetwork, leaveWorldNetwork } from '../src/network/world-network';
import { isolate } from '../src/week/grid-labels';
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
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
const lead = (release: string) => ar.demo.ministryCalendar.lead.replace('{{release}}', isolate(release));
let failing = false;
const flaky = flakySend(server, () => failing);

async function press(testID: string) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

/** Opens the demo's entry on this PC. */
async function render() {
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
          send={flaky}
          reference={reference}
          onBack={() => undefined}
          onLeft={() => undefined}
        />
      </LocaleDirContext.Provider>,
    );
    await settle();
  });
}

/** Joins on this PC the world a code names, then opens the Ministry's calendar page. */
async function join(code: string) {
  await render();
  const [input] = tree!.root.findAll((node) => node.type === TextField && node.props.testID === 'demo-code');
  await ReactTestRenderer.act(async () => {
    (input.props as TextInputProps).onChangeText?.(code);
    await settle();
  });
  await press('demo-join');
}

/** Opens the Ministry's calendar page from the roles. */
async function ministryCalendar() {
  await press('world-role-ministry');
  await press('world-page-calendar');
}

/** Leaves the world from the Ministry's workspace. */
async function leave() {
  await press('world-change-role');
  await press('world-leave');
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
}

/** A world started elsewhere, the network left there, with a release published first when asked. */
async function startedElsewhere(update: CalendarUpdate | null = null) {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  if (update !== null)
    await publish(server, { id: started.keys.world, keys: started.keys, sealing: started.sealing }, update);
  leaveWorldNetwork();
  return started;
}

test('each world keys over the release it holds, and a reading that fails says so', async () => {
  const update = moving();
  const first = await startedElsewhere(update);
  const second = await startedElsewhere();
  await join(first.code);
  await ministryCalendar();
  expect(texts()).toContain(lead(update.release));
  expect(texts()).not.toContain(ar.demo.problem.calendar);
  await leave();
  await join(second.code);
  await ministryCalendar();
  expect(texts()).toContain(lead(calendar.release));
  await leave();
  failing = true;
  try {
    await join(first.code);
    expect(texts()).toContain(ar.demo.problem.calendar);
    await ministryCalendar();
    expect(texts()).toContain(lead(calendar.release));
  } finally {
    failing = false;
  }
});

test('the Ministry’s page keys over a new release, setting aside a draft that no longer fits', async () => {
  const started = await startedElsewhere();
  await join(started.code);
  await ministryCalendar();
  await press(`ministry-take-out-${exam.id}`);
  expect(tree!.root.findAllByProps({ testID: 'ministry-calendar-set-aside' })).toHaveLength(0);
  await leave();
  const removing = draftUpdate(
    takeOutDraftEntry(calendar.entries, EMPTY_DRAFT, exam.id),
    profile,
    calendar.year,
    calendar.release,
    started.date,
  );
  const { pass } = await worldSecrets(started.code, nodeKit.kdf, nodeKit.mac);
  enterWorldNetwork(started.keys.world, pass);
  await publish(server, { id: started.keys.world, keys: started.keys, sealing: started.sealing }, removing);
  leaveWorldNetwork();
  await join(started.code);
  await ministryCalendar();
  expect(texts()).toContain(lead(removing.release));
  expect(tree!.root.findAllByProps({ testID: 'ministry-calendar-set-aside' }).length).toBeGreaterThan(0);
});

test('a problem of the world’s own comes before the calendar’s', async () => {
  failing = true;
  try {
    await render();
    await press('demo-start-national');
    expect(texts()).toContain(ar.demo.problem.calendar);
    for (let move = 0; move < 12 && !texts().includes(ar.demo.problem.lastDay); move += 1) {
      await press('world-role-ministry');
      await press('world-page-world');
      await press('world-move-date');
      await press('world-change-role');
    }
    expect(texts()).toContain(ar.demo.problem.lastDay);
    expect(texts()).not.toContain(ar.demo.problem.calendar);
  } finally {
    failing = false;
  }
});
