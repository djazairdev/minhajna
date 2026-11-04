// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A device offered its world's new date (#630, answer 724), against a made-up
// demo server: on a phone the page in hand keeps its date under a line naming
// the new day and what going there does, the whole announced once, and going
// there closes that page, whichever page it is, and shows the day on the
// world's home; on a PC a workspace returns to its first page; the device that
// moved the date itself is offered nothing and stays on its page, unless its
// own move went through unanswered, when going there still sends the seeded
// schools' shares; and no offer shows while a step runs. Every world is made
// up.

import type { SchoolCalendar } from '@minhajna/core';
import { AccessibilityInfo, Platform, Text, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { TextField } from '../src/components/TextField';
import { DemoRoot } from '../src/demo/DemoRoot';
import * as seeded from '../src/demo/seeded-shares';
import { worldDate } from '../src/demo/world-date';
import { DATE_READ_MS } from '../src/demo/world-date-read';
import { ROLE_PAGES } from '../src/demo/world-pages';
import { moveWorldDate, startWorld, type Send } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import ar from '../src/text/ar.json';
import { currentLanguage, i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const reference = read;
const calendar: SchoolCalendar = reference.calendar;
const words = ar.demo.dateMoved;
const server = new DemoServer();
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const settle = () => ReactTestRenderer.act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const band = () => String(tree!.root.findAllByProps({ testID: 'demo-band' })[0].props.accessibilityLabel);
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const selected = (testID: string): unknown =>
  tree!.root.findAll((node) => node.props.testID === testID && 'aria-selected' in node.props)[0].props['aria-selected'];
const dayOf = (day: Parameters<typeof worldDate>[1]) => worldDate(i18n.t, day, currentLanguage(), reference.profile);

async function settled() {
  for (let turn = 0; turn < 40; turn += 1) await settle();
}

async function press(testID: string) {
  await ReactTestRenderer.act(() =>
    (tree!.root.findAllByProps({ testID })[0].props as { onPress: () => void }).onPress(),
  );
  await settled();
}

const tick = async () => {
  jest.advanceTimersByTime(DATE_READ_MS);
  await settled();
};

async function root(send: Send = server.send) {
  jest.useFakeTimers({
    doNotFake: [
      'Date',
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'setImmediate',
      'setTimeout',
      'clearTimeout',
      'clearImmediate',
    ],
  });
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <DemoRoot
        kit={nodeKit}
        calendar={calendar}
        profile={reference.profile}
        storage={new FakeStorage().asSpec()}
        world={new FakeWorld(new FakeStorage()).asSpec()}
        send={send}
        onBack={() => undefined}
        onLeft={() => undefined}
        reference={reference}
      />,
    );
  });
  await settled();
}

/** A world started elsewhere, and this device on its home by its code, as the role. */
async function joined(kind: 'national' | 'teachers', role: string) {
  const started = await startWorld(kind, calendar, nodeKit, server.send);
  leaveWorldNetwork();
  await root();
  const field = () => tree!.root.findByType(TextField).props as { onChangeText: (text: string) => void };
  await ReactTestRenderer.act(() => field().onChangeText(started.code));
  await press('demo-join');
  await press(`world-role-${role}`);
  return () => moveWorldDate(started.keys.world, started.starter, started.date, server.send);
}

test('a phone keeps the page in hand under the offer, says it once, and going there shows the day', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const announced = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const shares = jest.spyOn(seeded, 'sendSeededShares');
  const move = await joined('national', 'teacher');
  const before = band();
  await press('world-reader-open');
  expect(has('world-reader-open')).toBe(false);
  const moved = await move();
  await tick();
  const day = dayOf(moved);
  const line = words.line.replace('{{date}}', day);
  expect(has('world-reader-open')).toBe(false);
  expect(texts()).toEqual(expect.arrayContaining([line, words.hint]));
  const offers = () => announced.mock.calls.filter(([said]) => said === `${line} ${words.hint}`).length;
  expect(offers()).toBe(1);
  await tick();
  expect(offers()).toBe(1);
  const button = tree!.root.findAllByProps({ testID: 'world-date-take' })[0].props as {
    name: string;
    accessibilityHint: string;
  };
  expect([button.name, button.accessibilityHint]).toEqual([`${words.take} · ${day}`, words.hint]);
  await press('world-date-take');
  expect([has('world-date-moved'), has('world-reader-open')]).toEqual([false, true]);
  expect(band()).not.toBe(before);
  expect(band()).toContain(day);
  expect(shares).not.toHaveBeenCalled();
});

test.each([['world-school-open'], ['world-staff-open']])('going there closes the page %s opened', async (opener) => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const move = await joined('national', 'teacher');
  await press(opener);
  expect(has(opener)).toBe(false);
  await move();
  await tick();
  await press('world-date-take');
  expect(has(opener)).toBe(true);
});

test.each([
  ['android', 'pc-close'],
  ['web', 'staff-close'],
])('the staffroom page on %s closes by its own button', async (os, close) => {
  jest.replaceProperty(Platform, 'OS', os as never);
  await joined('national', 'teacher');
  await press('world-staff-open');
  expect(has('world-staff-open')).toBe(false);
  await press(close);
  expect(has('world-staff-open')).toBe(true);
});

test('going there closes the insights’ page', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const move = await joined('teachers', 'teacher');
  await press('world-insights-open');
  expect(has('world-insights-open')).toBe(false);
  await move();
  await tick();
  await press('world-date-take');
  expect(has('world-insights-open')).toBe(true);
});

test('on a PC a workspace page stays under the offer, and going there returns to the first page', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const move = await joined('national', 'director');
  const [first, second] = ROLE_PAGES.director;
  await press(`world-page-${second}`);
  expect(selected(`world-page-${second}`)).toBe(true);
  await move();
  await tick();
  expect(selected(`world-page-${second}`)).toBe(true);
  await press('world-date-take');
  expect(selected(`world-page-${first}`)).toBe(true);
});

test('the device that moves the date stays on its page, with nothing offered', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  await root();
  await press('demo-start-national');
  await press('world-role-director');
  await press('world-page-world');
  await press('world-move-date');
  const moved = band();
  expect(selected('world-page-world')).toBe(true);
  await tick();
  expect([has('world-date-moved'), band(), selected('world-page-world')]).toEqual([false, moved, true]);
});

test('a starting device whose own move went unanswered sends the shares on going there', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const shares = jest.spyOn(seeded, 'sendSeededShares');
  let lose = false;
  const send: Send = async (request) => {
    const answer = await server.send(request);
    if (lose && request.method === 'POST' && request.path.endsWith('/date')) throw new Error('Made-up lost answer');
    return answer;
  };
  await root(send);
  await press('demo-start-national');
  await press('world-role-director');
  await press('world-page-world');
  const before = band();
  const sent = shares.mock.calls.length;
  lose = true;
  await press('world-move-date');
  lose = false;
  expect(band()).toBe(before);
  expect(shares).toHaveBeenCalledTimes(sent);
  await tick();
  await press('world-date-take');
  expect(band()).not.toBe(before);
  expect(shares).toHaveBeenCalledTimes(sent + 1);
  expect(band()).toContain(dayOf(shares.mock.calls.at(-1)![1]));
});

test('no offer shows while a step runs', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  let release = () => undefined as void;
  const send: Send = async (request) => {
    const answer = await server.send(request);
    if (request.method === 'POST' && request.path.endsWith('/date')) await new Promise<void>((go) => (release = go));
    return answer;
  };
  await root(send);
  await press('demo-start-national');
  await press('world-role-director');
  await press('world-page-world');
  await ReactTestRenderer.act(() =>
    (tree!.root.findAllByProps({ testID: 'world-move-date' })[0].props as { onPress: () => void }).onPress(),
  );
  await settled();
  await tick();
  expect(has('world-date-moved')).toBe(false);
  await ReactTestRenderer.act(() => release());
  await settled();
  expect(has('world-date-moved')).toBe(false);
});
