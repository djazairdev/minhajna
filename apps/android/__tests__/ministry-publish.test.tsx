// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Publishing from the Ministry's calendar page on a PC (#608, answer 624),
// against a made-up demo server, after the release of the made-up closure the
// world's start publishes (answer 626): with no change in the draft nothing is
// offered; once it holds one, publishing asks to confirm with how many entries
// it adds, changes and takes out, and cancelling publishes nothing; a draft
// changed meanwhile drops the question; every change waits while publishing;
// confirming puts the release, says it, empties the draft, keys the page over
// the new release and brings the focus to the button that adds an entry; and a
// release the relay did not keep is said as an alert, the draft kept. Every
// world and entry is made up.

import { LocaleDirContext } from '@react-navigation/native';
import * as ReactNative from 'react-native';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { calendar, exam, profile, reference } from '../jest/world-calendar';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { NATIONAL_SPACE } from '../src/demo/world-calendar-read';
import type { Send } from '../src/demo/world-session';
import NativeInterface from '../src/native/NativeMinhajnaInterface';
import { leaveWorldNetwork } from '../src/network/world-network';
import ar from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const words = ar.demo.ministryCalendar;
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
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const said = () => String(tree!.root.findByProps({ testID: 'ministry-publish-said' }).props.children);
const lead = (release: string) => words.lead.replace('{{release}}', isolate(release));
const puts = () =>
  server.seen.filter((one) => one.path.endsWith(`/spaces/${NATIONAL_SPACE}/batches`) && one.body).length;
const after = (release: string) => `${release.split('.')[0]}.${Number(release.split('.')[1]) + 1}`;
const started = after(calendar.release);

async function press(testID: string) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

/** A national world started on this PC, on the Ministry's calendar page. */
async function ministryPage(send: Send = server.send) {
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
  await press('demo-start-national');
  await press('world-role-ministry');
  await press('world-page-calendar');
}

test('a draft is published once confirmed, said, and the page keys over the new release', async () => {
  await ministryPage();
  expect(has('ministry-publish')).toBe(false);
  await press(`ministry-take-out-${exam.id}`);
  await press('ministry-publish');
  const counts = words.publish.counts.replace('{{added}}', '0').replace('{{changed}}', '0').replace('{{removed}}', '1');
  expect(texts()).toEqual(expect.arrayContaining([words.publish.title, counts, words.publish.explain]));
  await press('ministry-publish-no');
  expect([has('ministry-publish-confirm'), has('ministry-publish')]).toEqual([false, true]);
  expect(puts()).toBe(1);
  await press('ministry-publish');
  await press('ministry-publish-yes');
  const release = after(started);
  expect(texts()).toContain(lead(release));
  expect(said()).toBe(words.publish.done.replace('{{release}}', isolate(release)));
  expect([has('ministry-publish'), has(`ministry-entry-${exam.id}`)]).toEqual([false, false]);
  expect(server.seen.filter((one) => one.method === 'PUT' && one.path.endsWith('/announced-days'))).toHaveLength(2);
});

test('a release the relay did not keep is said as an alert, and the draft is kept', async () => {
  let live = false;
  const racing: Send = (request) =>
    live && request.method === 'POST' && request.path.endsWith(`/spaces/${NATIONAL_SPACE}/batches`)
      ? Promise.resolve({ status: 201, body: { added: 1 }, retryAfter: null })
      : server.send(request);
  await ministryPage(racing);
  live = true;
  await press(`ministry-take-out-${exam.id}`);
  await press('ministry-publish');
  await press('ministry-publish-yes');
  expect(texts()).toContain(words.publish.race);
  expect(texts()).toContain(lead(started));
  expect(has('ministry-publish')).toBe(true);
});

test('every change waits while publishing, and a draft changed meanwhile drops the question', async () => {
  let open: () => void = () => undefined;
  let gate: Promise<void> | null = null;
  const slow: Send = async (request) => {
    if (gate !== null && request.method === 'POST' && request.path.endsWith(`/spaces/${NATIONAL_SPACE}/batches`))
      await gate;
    return server.send(request);
  };
  await ministryPage(slow);
  gate = new Promise<void>((resolve) => (open = resolve));
  await press(`ministry-take-out-${exam.id}`);
  await press('ministry-publish');
  await press(`ministry-undo-${exam.id}`);
  expect([has('ministry-publish-confirm'), has('ministry-publish')]).toEqual([false, false]);
  await press(`ministry-take-out-${exam.id}`);
  expect([has('ministry-publish-confirm'), has('ministry-publish')]).toEqual([false, true]);
  await press('ministry-publish');
  await press('ministry-publish-yes');
  expect(texts()).toContain(words.publish.busy);
  const disabled = (testID: string) =>
    tree!.root.findAll((node) => node.props.testID === testID && 'disabled' in node.props)[0].props.disabled as unknown;
  const other = calendar.entries.find((one) => one.layer === 'national' && one.id !== exam.id)!.id;
  expect(
    [`ministry-calendar-add`, `ministry-undo-${exam.id}`, `ministry-take-out-${other}`, `ministry-change-${other}`].map(
      disabled,
    ),
  ).toEqual([true, true, true, true]);
  await ReactTestRenderer.act(async () => {
    open();
    await settle();
  });
  await press('world-page-calendar');
  expect(texts()).not.toContain(words.publish.busy);
});

test('after publishing, the focus goes to the button that adds an entry', async () => {
  const frames: ((time: number) => void)[] = [];
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback));
  jest
    .spyOn(jest.requireActual<typeof ReactNative>('react-native'), 'findNodeHandle')
    .mockImplementation((node) =>
      (node as { props?: { testID?: string } } | null)?.props?.testID === 'ministry-calendar-add' ? 29 : 71,
    );
  const focus = jest.spyOn(NativeInterface, 'focusView').mockImplementation(() => undefined);
  await ministryPage();
  await press(`ministry-take-out-${exam.id}`);
  await press('ministry-publish');
  await press('ministry-publish-yes');
  await ReactTestRenderer.act(() => frames.splice(0).forEach((callback) => callback(0)));
  expect(focus).toHaveBeenLastCalledWith(29);
});
