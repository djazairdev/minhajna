// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Taking part in a teachers' world's insights and sending them (#622, answer
// 697), against a made-up demo server: a teachers' world's start opens its
// observatory under the starter token; taking part is off and nothing is sent
// until the teacher turns it on; then the term just ended goes, one sending for
// the class with a pack, byte for byte the text the page showed, the server
// keeping it without the school-and-term code, and the page and the world's
// home say it is on and sent; each later term goes as the world's date ends
// it, page open or not, each sending once and with no starter token; turned
// off, nothing more goes; a refusal says so and keeps nothing, and trying again
// sends what is left. Every world is made up.

import { readSending, sentSendings, worldTeacher, type InsightsSending } from '@minhajna/core';
import { Platform, Text, useWindowDimensions, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { calendar, reference } from '../jest/world-calendar';
import { MARK } from '../jest/world-observatory';
import { DemoServer, nodeKit } from '../jest/world-server';
import type { SwitchProps } from '../src/components/Switch';
import { DemoRoot } from '../src/demo/DemoRoot';
import { seededWorld } from '../src/director/director-world';
import { leaveWorldNetwork } from '../src/network/world-network';
import { openRecordBook } from '../src/storage/history';
import { worldSpec } from '../src/storage/world';
import { catalogues, i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const words = catalogues.ar.demo.insights;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  world = new FakeWorld(teacher);
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const turns = async (count = 60) => {
  for (let turn = 0; turn < count; turn += 1)
    await ReactTestRenderer.act(async () => {
      await settle();
    });
};
const host = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && typeof node.type === 'string');
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
const puts = () => server.seen.filter((one) => one.method === 'PUT' && one.path.endsWith('/insights/sendings'));

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
    await settle();
  });
  await turns();
}

/** Turns taking part on or off, as the switch does. */
async function toggle() {
  const control = tree!.root.findByProps({ testID: 'insights-take-part' }).props as SwitchProps;
  await ReactTestRenderer.act(async () => {
    control.onValueChange(!control.value);
    await settle();
  });
  await turns();
}

/** Starts a teachers' world as its teacher, and answers its ID. */
async function teachersWorld(): Promise<string> {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <DemoRoot
        kit={nodeKit}
        calendar={calendar}
        profile={reference.profile}
        storage={teacher.asSpec()}
        world={world.asSpec()}
        send={server.send}
        onBack={() => undefined}
        onLeft={() => undefined}
        reference={reference}
      />,
    );
    await settle();
  });
  await press('demo-start-teachers');
  const id = String(tree!.root.findByProps({ testID: 'world-code' }).props.children).slice(0, 5);
  await press('world-role-teacher');
  return id;
}

/** Moves the world's date until the latest term ended is `term`. */
async function moveTo(id: string, term: 2 | 3) {
  const end = calendar.year.terms[term - 1].to;
  for (let move = 0; move < 40 && server.worlds.get(id)!.date < end; move += 1) await press('world-move-date');
}

test('turned on, each term’s sending goes once, exactly as shown, until turned off', async () => {
  const id = await teachersWorld();
  const opening = server.seen.find((one) => one.path === `/worlds/${id}/insights`)!;
  expect([opening.method, typeof opening.headers.Authorization]).toEqual(['POST', 'string']);
  const seeded = (await server.observatory.store.sendings(id)).length;
  expect(seeded).toBeGreaterThan(0);
  await press('world-insights-open');
  expect(host('insights-off')).toHaveLength(1);
  expect(host('insights-take-part')[0].props.accessibilityState).toMatchObject({ checked: false });
  const mine = worldTeacher(seededWorld(id, reference))!;
  const packed = mine.school.classes.find((one) => one.packs[mine.teacher.subject] !== undefined)!;
  await press(`insights-class-${packed.id}`);
  const shown = String(host('insights-payload-text')[0].props.children);
  expect(puts()).toEqual([]);
  await toggle();
  expect(host('insights-on')).toHaveLength(1);
  expect(puts().map((one) => [one.body, one.headers.Authorization])).toEqual([[shown, undefined]]);
  expect(texts()).toContain(words.sending.done_one);
  const sending = readSending(JSON.parse(shown)) as InsightsSending;
  const held = await server.observatory.store.sendings(id);
  expect(held).toHaveLength(seeded + 1);
  expect(held.filter((one) => one.id === sending.id)).toEqual([
    { ...Object.fromEntries(Object.entries(sending).filter(([name]) => name !== 'schoolTerm')), mark: MARK },
  ]);
  await press('insights-back');
  expect(texts()).toContain(words.row.on);
  await moveTo(id, 2);
  expect(puts()).toHaveLength(2);
  expect((JSON.parse(puts()[1].body!) as InsightsSending).term).toBe(2);
  await press('world-insights-open');
  expect(texts()).toContain(words.sending.done_one);
  await toggle();
  expect(host('insights-off')).toHaveLength(1);
  await toggle();
  expect(texts()).toContain(words.sending.upToDate);
  await toggle();
  await press('insights-back');
  expect(texts()).toContain(words.row.teacher);
  await moveTo(id, 3);
  expect(puts()).toHaveLength(2);
  await press('world-leave');
  const book = await openRecordBook(worldSpec(teacher.asSpec(), world.asSpec(), id));
  expect(sentSendings(book.entries).map((one) => [one.classId, one.sending.term])).toEqual([
    [packed.id, 1],
    [packed.id, 2],
  ]);
});

test('a refusal says so, and trying again sends what is left', async () => {
  const id = await teachersWorld();
  server.observatory.reset();
  await press('world-insights-open');
  await toggle();
  expect(host('insights-sending-failed')).toHaveLength(1);
  expect(texts()).toContain(words.sending.failed);
  expect(await server.observatory.store.sendings(id)).toEqual([]);
  await press('insights-log-open');
  expect(host('insights-log-failed')[0].props.children).toBe(words.log.failed);
  await press('insights-log-back');
  await server.observatory.store.open(id);
  await press('insights-retry');
  expect(host('insights-sending-done')).toHaveLength(1);
  await press('insights-log-open');
  expect(host('insights-log-failed')[0].props.children).toBe('');
  await press('insights-log-back');
  expect(await server.observatory.store.sendings(id)).toHaveLength(1);
  expect(puts()).toHaveLength(2);
  await press('insights-back');
  await press('world-leave');
  const book = await openRecordBook(worldSpec(teacher.asSpec(), world.asSpec(), id));
  expect(sentSendings(book.entries).map((one) => one.sending.term)).toEqual([1]);
});
