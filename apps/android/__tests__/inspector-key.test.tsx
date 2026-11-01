// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The inspector's key (#593, answer 621): the device makes its pair the first
// time and keeps it in the world's store, then posts the public half once in
// its directorate's space, where the directorate finds it by the fingerprint
// the card shows; two inspectors' keys are both found; when another device took
// the stream's next number first, the key goes on top, two openings at once
// keep one pair, and a refusal while the stream stays as it was is the
// server's; the card announces the key posted and, on a PC, leaves a busy
// server to its alert, with a way to try again, while the phone announces it;
// unmounted while posting it changes nothing, and only the inspector's home
// shows it. Every directorate and device is made up.

import {
  directorateSpace,
  eventOf,
  inspectorByFingerprint,
  inspectorKey,
  inspectorKeyPlace,
  openDirectorateRecords,
  sealDirectorateRecord,
  toBase64Url,
  type Holder,
} from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { AccessibilityInfo, Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { server } from '../jest/timetable-send';
import { nodeKit as kit } from '../jest/world-server';
import { newDevicePair, worldKeyCrypto } from '../src/demo/world-key-crypto';
import { startWorld, type Send } from '../src/demo/world-session';
import { WorldHome } from '../src/demo/WorldHome';
import { InspectorKey } from '../src/inspector/InspectorKey';
import { postInspectorKey } from '../src/inspector/inspector-key-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { spaceBatches } from '../src/school/space-read';
import { openRecordBook } from '../src/storage/history';
import ar from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const DIRECTORATE = 'directorate-3';
const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const calendar = read.calendar;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

async function world() {
  const started = await startWorld('national', calendar, kit, server.send);
  const id = started.keys.world;
  const device = async () => ({
    world: id,
    date: started.date,
    book: await openRecordBook(new FakeStorage().asSpec()),
  });
  return { id, device };
}

async function stream(id: string) {
  const space = await directorateSpace(id, DIRECTORATE, kit.mac);
  const place = await inspectorKeyPlace(space, kit.mac);
  const batches = (await spaceBatches(id, space, server.send)).get(place.stream) ?? [];
  return { space, place, batches };
}

async function posted(id: string) {
  const { place, batches } = await stream(id);
  return openDirectorateRecords(place, batches, kit.cipher);
}

/** Puts another made-up key at the stream's next number, as another device would. */
async function another(id: string) {
  const { space, place, batches } = await stream(id);
  const holder = { id: '0123456789abcdef0123456789abcdef', publicKey: `04${'ab'.repeat(64)}` };
  const sealed = await sealDirectorateRecord(place, inspectorKey(id, holder), batches.length, kit.cipher);
  const body = { stream: place.stream, first: batches.length, batches: sealed.map((one) => toBase64Url(one.bytes)) };
  await server.send({ method: 'POST', path: `/worlds/${id}/spaces/${space}/batches`, body });
}

const found = async (id: string, typed: string): Promise<Holder | null> =>
  inspectorByFingerprint(await posted(id), id, typed, worldKeyCrypto(kit, await newDevicePair(kit)));

test('the key is made once, posted once, and found by the fingerprint the inspectorate sends', async () => {
  const { id, device } = await world();
  const here = await device();
  const first = await postInspectorKey(here, DIRECTORATE, kit, server.send);
  const again = await postInspectorKey(here, DIRECTORATE, kit, server.send);
  expect(first.fingerprint).toMatch(/^[0-9a-f]{4}(?:-[0-9a-f]{4}){3}$/u);
  expect(again).toEqual(first);
  const kept = here.book.entries.filter((entry) => eventOf(entry)?.kind === 'inspector.device');
  expect(kept).toHaveLength(1);
  expect(await posted(id)).toHaveLength(1);
  expect(await found(id, first.fingerprint.toUpperCase().split('-').join(' '))).toEqual(first.holder);
});

test('two inspectors’ keys are both found, and one posted after another took the number goes on top', async () => {
  const { id, device } = await world();
  const [here, there] = [await device(), await device()];
  let other: Awaited<ReturnType<typeof postInspectorKey>> | undefined;
  const racing: Send = async (request) => {
    if (request.method === 'POST' && other === undefined)
      other = await postInspectorKey(there, DIRECTORATE, kit, server.send);
    return server.send(request);
  };
  const mine = await postInspectorKey(here, DIRECTORATE, kit, racing);
  expect(other).toBeDefined();
  expect(mine.holder).not.toEqual(other!.holder);
  expect(await posted(id)).toHaveLength(2);
  expect(await found(id, mine.fingerprint)).toEqual(mine.holder);
  expect(await found(id, other!.fingerprint)).toEqual(other!.holder);
});

test('two openings at once keep one pair, and a refusal is said for what it is', async () => {
  const { id, device } = await world();
  const here = await device();
  const [one, two] = await Promise.all([
    postInspectorKey(here, DIRECTORATE, kit, server.send),
    postInspectorKey(here, DIRECTORATE, kit, server.send),
  ]);
  expect(two.holder).toEqual(one.holder);
  expect(here.book.entries.filter((entry) => eventOf(entry)?.kind === 'inspector.device')).toHaveLength(1);
  const there = await device();
  const full: Send = async (request) =>
    request.method === 'POST' ? { status: 409, body: { error: 'full' }, retryAfter: null } : server.send(request);
  await expect(postInspectorKey(there, DIRECTORATE, kit, full)).rejects.toThrow('answered 409');
  const changing: Send = async (request) => {
    if (request.method === 'POST') await another(id);
    return server.send(request);
  };
  await expect(postInspectorKey(there, DIRECTORATE, kit, changing)).rejects.toThrow('kept changing');
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}
const control = (testID: string) =>
  tree!.root.findAll((node) => node.props.testID === testID && node.props.label !== undefined)[0];

test('the card shows the fingerprint, says a busy server and tries again', async () => {
  const { id, device } = await world();
  const here = await device();
  server.busy = true;
  await act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        <InspectorKey world={here} directorate={DIRECTORATE} kit={kit} send={server.send} />
      </LocaleDirContext.Provider>,
    );
  });
  const said = () => String(tree!.root.findByProps({ testID: 'inspector-key-said' }).props.children);
  expect(texts()).toContain(ar.demo.problem.busy);
  expect(said()).not.toContain(ar.demo.problem.busy);
  server.busy = false;
  await act(() => (control('inspector-key-again').props as PressableProps).onPress?.({} as never));
  const { fingerprint } = await postInspectorKey(here, DIRECTORATE, kit, server.send);
  expect(texts()).toEqual(expect.arrayContaining([ar.demo.inspectorKey.line, fingerprint.split('-').join(' ')]));
  expect(said()).toBe(ar.demo.inspectorKey.posted);
  expect(await posted(id)).toHaveLength(1);
});

test('the card unmounted while posting changes nothing, and only the inspector’s home shows it', async () => {
  const { device } = await world();
  const here = await device();
  const errors = jest.spyOn(console, 'error');
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <InspectorKey world={here} directorate={DIRECTORATE} kit={kit} send={server.send} />,
    );
  });
  await ReactTestRenderer.act(() => tree!.unmount());
  tree = undefined;
  await act();
  expect(errors).not.toHaveBeenCalled();
  expect(here.book.entries.some((entry) => eventOf(entry)?.kind === 'inspector.device')).toBe(true);
  const home = (role: 'inspector' | 'teacher') => (
    <WorldHome
      world={{ kind: 'national', code: 'K7QF4M3XP7K7QF4M3XP7', starter: null }}
      date="day"
      role={role}
      moving={false}
      problem={null}
      onRole={() => undefined}
      onMove={() => undefined}
      onLeave={() => undefined}
      inspectorCard={<Text>made-up card</Text>}
    />
  );
  await act(() => {
    tree = ReactTestRenderer.create(home('teacher'));
  });
  expect(texts()).not.toContain('made-up card');
  await act(() => tree!.update(home('inspector')));
  expect(texts()).toContain('made-up card');
});

test('on the phone a problem is announced, and the key posted too', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  const { device } = await world();
  const here = await device();
  server.busy = true;
  await act(() => {
    tree = ReactTestRenderer.create(
      <InspectorKey world={here} directorate={DIRECTORATE} kit={kit} send={server.send} />,
    );
  });
  expect(announce).toHaveBeenLastCalledWith(ar.demo.problem.busy);
  server.busy = false;
  await act(() => (control('inspector-key-again').props as PressableProps).onPress?.({} as never));
  expect(announce).toHaveBeenLastCalledWith(ar.demo.inspectorKey.posted);
});
