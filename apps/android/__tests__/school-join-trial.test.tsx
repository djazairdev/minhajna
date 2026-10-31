// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// School-join during the trial term end (#565, R-7.5-05, answer 587), against a
// made-up demo server: a new national world opens in its trial, so the page
// names the trial under its title, opens the notice with it and keeps only who
// reads the space, and its card says that taking part is voluntary, from the
// trial's first day to its last, that paper stays official, and offers joining
// and «Not now» with the note that the choice goes at the launch; «Not now»
// goes back to the world's home, sends nothing and records nothing; joining in
// the trial works as ever, and the teacher stays joined, with the plain card
// below; and once the world's date moves past the trial, the plain School-join
// returns, by the world's date and never the device's clock. Every world,
// school and key is made up.

import { joinCodeText, makeJoinCode, newId, type OpenedKeyring, type SchoolCalendar } from '@minhajna/core';
import { Platform, Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { worldDate } from '../src/demo/world-date';
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
const trial = text.demo.school.trial;
const ring = {
  ring: { school: 'made-up-school-of-the-trial' },
  keys: [nodeKit.random(32)],
} as unknown as OpenedKeyring;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const shown = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const texts = () =>
  tree!.root
    .findAllByType(Text)
    .map((node) => [(node.props as { children: unknown }).children].flat().map(String).join(''));
const has = (words: string) => texts().some((one) => one.includes(words));
const props = (testID: string) => tree!.root.findAllByProps({ testID })[0].props as PressableProps;

async function settled(first: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) first();
      await settle();
    });
}

const press = (testID: string) => settled(() => props(testID).onPress?.({} as never));

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

test('a new world opens in its trial: named, voluntary, with paper still official', async () => {
  await opened();
  expect(has(trial.badge.replace('{{year}}', '2026-2027'))).toBe(true);
  const day = worldDate(i18n.t.bind(i18n), '2026-12-17' as never, 'ar', read.ok ? read.profile : {});
  expect(texts()).toContain(trial.lead.replace('{{date}}', day).replace('{{term}}', '1'));
  expect(has(text.demo.school.notice)).toBe(false);
  expect(has(text.demo.school.read1) && !has(text.demo.school.read2)).toBe(true);
  expect(shown('school-trial') && !shown('school-code')).toBe(true);
  for (const words of [trial.title, trial.paper, trial.note]) expect(has(words)).toBe(true);
  const window = texts().find((one) => one.includes(trial.window.slice(trial.window.indexOf('.'), 40)));
  expect(window).toMatch(/22 .* 2026/u);
  expect(window).toMatch(/17 .* 2026/u);
  expect(props('school-scan')).toMatchObject({ disabled: true });
  expect(
    tree!.root
      .findByProps({ testID: 'school-not-now' })
      .findAllByType(Text)
      .map((one): unknown => one.props.children),
  ).toEqual([trial.notNow]);
});

test('«Not now» goes back to the world’s home, sends nothing and records nothing', async () => {
  const id = await opened();
  const entries = async () => (await openRecordBook(worldSpec(teacher.asSpec(), world.asSpec(), id))).entries.length;
  const [sent, kept] = [server.seen.length, await entries()];
  await press('school-not-now');
  expect(shown('school-join')).toBe(false);
  expect(shown('world-school-open')).toBe(true);
  expect(server.seen).toHaveLength(sent);
  expect(await entries()).toBe(kept);
});

test('joining in the trial works as ever, and the teacher stays joined', async () => {
  const id = await opened();
  const code = joinCodeText(await makeJoinCode(ring, id, newId(nodeKit.random), 1, { mac: nodeKit.mac } as never));
  const paste = tree!.root.findByProps({ testID: 'school-paste' }).props as { onChangeText: (value: string) => void };
  await settled(() => paste.onChangeText(code));
  await press('school-scan');
  await press('school-agree');
  expect(shown('school-joined')).toBe(true);
  expect(shown('school-code') && !shown('school-trial') && !shown('school-not-now')).toBe(true);
});

test('past the trial, by the world’s date, the plain School-join returns', async () => {
  jest.useFakeTimers({
    doNotFake: ['setTimeout', 'setImmediate', 'queueMicrotask', 'nextTick'],
    now: new Date('2026-12-01'),
  });
  await opened();
  await press('school-back');
  await press('world-move-date');
  await press('world-school-open');
  expect(shown('school-code') && !shown('school-trial') && !shown('school-not-now')).toBe(true);
  expect(has(text.demo.school.notice) && has(text.demo.school.read2)).toBe(true);
  expect(has(trial.badge.replace(' · {{year}}', ''))).toBe(false);
});
