// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys in a national demo world (#571, answers 599 and 600), against a
// made-up demo server: the director's keys page on a PC, holding no key yet,
// offers to start it there, then holds the school key and says one device holds
// it, the director's own; the drawing kit is handed the map, the holders on the
// start side, linked to the key, which links to what it opens, and no recovery
// yet; the same boxes are written out in groups, the key's facts in the panel
// first, as labelled rows, a box chosen showing its own; the recovery's tab
// opens on the recovery, says none is made and gives the keyring's fingerprint.
// A second holder shows by the first four characters of its ID. Two holders
// that look like a recovery warn on either tab. The map of a recovery links
// both parts to it and it to the key, and right to left the holders stand on
// the right. On a phone there is no map and the groups are written out. Every
// world, school and device is made up.

import {
  addHolder,
  directorSchool,
  keyringFingerprint,
  seedNationalWorld,
  type KeysFacts,
  type SchoolCalendar,
} from '@minhajna/core';
import type { TFunction } from 'i18next';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { newDevicePair } from '../src/demo/world-key-crypto';
import { startWorld } from '../src/demo/world-session';
import { holdSchool } from '../src/director/issue-session';
import { keysMap } from '../src/director/keys-map';
import * as keysPage from '../src/director/use-keys-page';
import { SchoolKeys } from '../src/director/SchoolKeys';
import { Drawing, type DrawingKit, type MapSpec } from '../src/drawing/drawing-kit';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';
import { isolate } from '../src/week/grid-labels';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const reference = read;
const calendar: SchoolCalendar = reference.calendar;
const server = new DemoServer();
const teacher = new FakeStorage();
let world = new FakeWorld(teacher);
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const words = text.demo.keys;
const drawn: MapSpec[] = [];
const kit: DrawingKit = {
  Chart: () => null,
  Map: ({ spec }) => {
    drawn.push(spec);
    return null;
  },
};

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  drawn.length = 0;
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
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const within = (testID: string) =>
  tree!.root
    .findAllByProps({ testID })[0]
    .findAllByType(Text)
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));

async function press(testID: string) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
      await settle();
    });
}

const t = ((key: string, values?: Record<string, unknown>) =>
  Object.entries(values ?? {}).reduce(
    (one, [name, value]) => one.replace(`{{${name}}}`, String(value)),
    key,
  )) as never as TFunction;

test('the keys page on a PC maps the director’s device holding the key, and writes the map out', async () => {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <Drawing.Provider value={kit}>
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
        />
      </Drawing.Provider>,
    );
    await settle();
  });
  await press('demo-start-national');
  await press('world-role-director');
  await press('world-page-keys');
  expect(within('keys-start')).toContain(words.start.title);
  await press('keys-start-here');
  const id = worldNetworkOpen()!;
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  expect(texts()).toContain(words.count.replace('{{number}}', '1'));
  const spec = drawn.at(-1)!;
  expect(spec.label).toBe(words.map);
  const own = spec.nodes.find((one) => one.label === words.box.own)!;
  const key = spec.nodes.find((one) => one.id === 'key')!;
  expect(own.x).toBeLessThan(key.x);
  expect(spec.links.map((one) => `${one.from}>${one.to}`)).toEqual([
    `${own.id}>key`,
    'key>opens-weeks',
    'key>opens-pupils',
    'key>opens-status',
  ]);
  expect(spec.nodes.find((one) => one.id === 'recovery')?.label).toBe(words.box.noRecovery);
  expect(within('keys-group-holders')).toEqual([
    words.group.holders,
    words.box.key.replace('{{school}}', school.name),
    words.box.own,
  ]);
  expect(within('keys-group-none')).toEqual([
    words.group.none,
    words.box.servers,
    words.box.ministry,
    words.box.inspector,
    words.box.timetable,
  ]);
  expect(within('keys-panel')).toEqual([
    words.chosen,
    words.box.key.replace('{{school}}', school.name),
    words.row.holds,
    words.count.replace('{{number}}', '1'),
    words.row.opens,
    words.row.opensValue,
    words.row.notHeld,
    words.row.notHeldValue,
  ]);
  const current = (testID: string) =>
    (tree!.root.findAllByProps({ testID })[0].props as Record<string, unknown>)['aria-current'];
  expect(current('keys-box-key')).toBe('true');
  await press('keys-box-opens-pupils');
  expect(current('keys-box-key')).toBeUndefined();
  expect(current('keys-box-opens-pupils')).toBe('true');
  expect(within('keys-panel')).toEqual([words.chosen, words.box.pupils, words.about.pupils]);
  await press('keys-tab-recovery');
  expect(has('keys-group-holders')).toBe(false);
  expect(within('keys-panel')).toEqual([words.chosen, words.box.noRecovery, words.about.notMade]);
  expect(within('keys-group-recovery')).toEqual([
    words.group.recovery,
    words.box.schoolPart,
    words.box.directoratePart,
    words.box.noRecovery,
  ]);
  expect(texts().some((one) => one.startsWith(words.fingerprint.split('{{fingerprint}}')[0]))).toBe(true);
  expect(has('keys-many')).toBe(false);
  expect(texts()).toEqual(expect.arrayContaining([words.footer.map, words.footer.buttons]));
});

test('a second holder shows by its ID, and on a phone the groups are written out with no map', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const id = started.keys.world;
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const open = { world: id, date: started.date, book: await openRecordBook(new FakeStorage().asSpec()) };
  const desk = await holdSchool(open, nodeKit, server.send);
  const pair = await newDevicePair(nodeKit);
  const other = { id: 'f'.repeat(32), publicKey: pair.publicKey };
  const two = await addHolder(desk.opened, other, desk.held.device, desk.crypto);
  await open.book.record(open.date, { kind: 'school.held', held: { ...desk.held, ring: two.ring } });
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <Drawing.Provider value={null}>
        <SchoolKeys world={open} school={school} kit={nodeKit} send={server.send} dayText={String} />
      </Drawing.Provider>,
    );
    await settle();
  });
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      await settle();
    });
  expect(drawn).toEqual([]);
  expect(texts()).toContain(words.count.replace('{{number}}', '2'));
  expect(within('keys-group-holders')).toContain(words.box.device.replace('{{id}}', 'ffff'));
  await press('keys-box-holder-ffffffffffffffffffffffffffffffff');
  expect(within('keys-panel')).toContain(words.about.device);
  await press('keys-tab-recovery');
  expect(texts()).toContain(words.fingerprint.replace('{{fingerprint}}', isolate(keyringFingerprint(two.ring))));
});

test('the map of a recovery links both parts to it and it to the key, and right to left turns', () => {
  const facts: KeysFacts = {
    own: 'a'.repeat(32),
    devices: ['a'.repeat(32)],
    recoveries: ['b'.repeat(32)],
    epochs: 1,
    fingerprint: '1',
  };
  const made = keysMap(t, facts, 'School', true);
  expect(made.spec.links.slice(-3)).toEqual([
    { from: 'part-school', to: 'recovery' },
    { from: 'part-directorate', to: 'recovery' },
    { from: 'recovery', to: 'key', label: 'demo.keys.link.recovers' },
  ]);
  const holder = made.spec.nodes.find((one) => one.id.startsWith('holder-'))!;
  const key = made.spec.nodes.find((one) => one.id === 'key')!;
  expect(holder.x).toBeGreaterThan(key.x);
  expect(made.groups.find((one) => one.id === 'recovery')?.boxes.map((one) => one.about)).toEqual([
    'demo.keys.about.schoolPart',
    'demo.keys.about.directoratePart',
    'demo.keys.about.recovery',
  ]);
});

test('two holders that look like a recovery warn on either tab', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const facts: KeysFacts = {
    own: 'a'.repeat(32),
    devices: ['a'.repeat(32)],
    recoveries: ['b'.repeat(32), 'c'.repeat(32)],
    epochs: 1,
    fingerprint: '2-abcd',
  };
  jest.spyOn(keysPage, 'useKeysPage').mockReturnValue({
    mode: 'holder',
    facts,
    orphaned: false,
    choose: () => undefined,
    desk: null,
    busy: false,
    problem: null,
    reload: () => undefined,
    recovery: null,
    setRecovery: () => undefined,
    making: false,
    setMaking: () => undefined,
    said: null,
    setSaid: () => undefined,
  });
  const open = { world: 'ABCDE', date: '2026-10-20' as never, book: await openRecordBook(new FakeStorage().asSpec()) };
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld('ABCDE', zones, workingDays, reference.packs))!;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<SchoolKeys world={open} school={school} kit={nodeKit} dayText={String} />);
    await settle();
  });
  expect(within('keys-many')).toEqual([words.many]);
  await press('keys-box-holder-' + 'a'.repeat(32));
  expect(within('keys-panel')).toContain(words.about.own);
  await press('keys-tab-recovery');
  expect(within('keys-many')).toEqual([words.many]);
  expect(within('keys-panel')).toEqual([words.chosen, words.box.recovery, words.about.recovery]);
});
