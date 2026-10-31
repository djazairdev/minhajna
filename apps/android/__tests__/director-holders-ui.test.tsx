// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys' holders in a national demo world (#571, answer 600), against a
// made-up demo server: a device that holds no key offers both ways; waiting, it
// shows its one-time code and fingerprint under a guarded screen, and once the
// director adds it, the keyring's fingerprint to compare, then keeps it and
// shows the key held by two devices; giving up goes back to the choice. On the
// director's phone, a scanned code shows the new device's fingerprint before it
// is added, then the keyring's; another holder's box removes it after the
// design's question, and removing the device that made the recovery opens the
// recovery's tab on the new parts. On a PC a pasted text that is no holder's
// code says so. A recovery whose maker is gone is warned of. Every world,
// school and device is made up.

import {
  directorSchool,
  holderFingerprint,
  keptWaiting,
  readHolderQr,
  seedNationalWorld,
  type KeysFacts,
  type SchoolCalendar,
} from '@minhajna/core';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { calendarInput } from '../jest/calendar-input';
import type { FakeLock } from '../jest/fake-lock';
import { FakeStorage } from '../jest/fake-storage';
import { DemoServer, nodeKit } from '../jest/world-server';
import { startWorld } from '../src/demo/world-session';
import { keepAdmitted, readDrop, waitToHold } from '../src/director/holder-wait';
import { addDevice } from '../src/director/holders-session';
import { holdSchool } from '../src/director/issue-session';
import { makeRecovery } from '../src/director/keys-session';
import { PUBLIC_KEY_BYTES } from '../src/director/school-desk';
import { SchoolKeys } from '../src/director/SchoolKeys';
import * as keysPage from '../src/director/use-keys-page';
import NativeLock from '../src/native/NativeMinhajnaLock';
import { leaveWorldNetwork } from '../src/network/world-network';
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
const words = text.demo.keys;
const lock = NativeLock as unknown as FakeLock;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
  calendarInput.scanQr.mockReset();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;

async function turns() {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      await settle();
    });
}

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress?.({} as never);
    await settle();
  });
  await turns();
}

/** A started world, the seeded school, and two devices in it, each with a store of its own. */
async function world() {
  const started = await startWorld('national', calendar, nodeKit, server.send);
  const id = started.keys.world;
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const device = async () => ({
    world: id,
    date: started.date,
    book: await openRecordBook(new FakeStorage().asSpec()),
  });
  return { school, director: await device(), deputy: await device() };
}

async function page(
  open: Awaited<ReturnType<typeof world>>['director'],
  school: Awaited<ReturnType<typeof world>>['school'],
) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <SchoolKeys world={open} school={school} kit={nodeKit} send={server.send} dayText={String} />,
    );
    await settle();
  });
  await turns();
}

test('a device waits with its code, is added, compares the fingerprint and holds the key', async () => {
  const { school, director, deputy } = await world();
  const desk = await holdSchool(director, nodeKit, server.send);
  await page(deputy, school);
  expect(has('keys-start-here') && has('keys-start-wait')).toBe(true);
  expect(has('keys-tab')).toBe(false);
  await press('keys-start-wait');
  expect(has('keys-wait-qr')).toBe(true);
  expect(lock.guarded.at(-1)).toBe('pin');
  const waiting = keptWaiting(deputy.book.entries, PUBLIC_KEY_BYTES)!;
  const holder = { id: waiting.device, publicKey: waiting.publicKey };
  const own = await holderFingerprint(holder, desk.crypto);
  expect(texts()).toContain(words.wait.device.replace('{{fingerprint}}', isolate(own)));
  const code = readHolderQr(`minhajna-holder:1:${holder.id}:${holder.publicKey}:${waiting.secret}`)!;
  const { fingerprint } = await addDevice(director, desk, code, nodeKit, server.send);
  await press('keys-wait-check');
  expect(texts()).toContain(words.wait.compare.replace('{{fingerprint}}', isolate(fingerprint)));
  await press('keys-wait-same');
  expect(has('keys-wait')).toBe(false);
  expect(lock.guarded.at(-1)).toBe('records');
  expect(texts()).toContain(words.count.replace('{{number}}', '2'));
  expect(keptWaiting(deputy.book.entries, PUBLIC_KEY_BYTES)).toBeNull();
});

test('giving up the wait goes back to the choice, and the next wait has a new code', async () => {
  const { school, deputy } = await world();
  await page(deputy, school);
  await press('keys-start-wait');
  const first = keptWaiting(deputy.book.entries, PUBLIC_KEY_BYTES)!.secret;
  await press('keys-wait-give-up');
  expect(has('keys-start')).toBe(true);
  expect(keptWaiting(deputy.book.entries, PUBLIC_KEY_BYTES)).toBeNull();
  await press('keys-start-wait');
  expect(keptWaiting(deputy.book.entries, PUBLIC_KEY_BYTES)!.secret).not.toBe(first);
});

test('the director scans a code, adds the device, and removes it after the question', async () => {
  const { school, director, deputy } = await world();
  const desk = await holdSchool(director, nodeKit, server.send);
  const waiting = await waitToHold(deputy, nodeKit, server.send);
  await page(director, school);
  calendarInput.scanQr.mockResolvedValueOnce(waiting.code);
  await press('keys-add-scan');
  expect(texts()).toContain(words.add.confirm.replace('{{fingerprint}}', isolate(waiting.fingerprint)));
  await press('keys-add-yes');
  expect(texts()).toContain(words.count.replace('{{number}}', '2'));
  const admitted = await readDrop(deputy, waiting.waiting, nodeKit, server.send);
  if (admitted === null || admitted === 'contested') throw new Error('The deputy was not admitted');
  expect(texts()).toContain(words.add.done.replace('{{fingerprint}}', isolate(admitted.fingerprint)));
  await keepAdmitted(deputy, waiting.waiting, admitted, nodeKit, server.send);
  expect(has(`keys-box-holder-${desk.held.device}`)).toBe(true);
  await press(`keys-box-holder-${desk.held.device}`);
  expect(has('keys-remove')).toBe(false);
  await press(`keys-box-holder-${waiting.waiting.device}`);
  await press('keys-remove-open');
  const name = words.box.device.replace('{{id}}', waiting.waiting.device.slice(0, 4));
  expect(texts()).toContain(words.remove.ask.replace('{{device}}', isolate(name)));
  await press('keys-remove-yes');
  expect(texts()).toContain(words.remove.done);
  expect(texts()).toContain(words.count.replace('{{number}}', '1'));
});

test('removing the device that made the recovery opens the recovery’s tab on new parts', async () => {
  const { school, director, deputy } = await world();
  const desk = await holdSchool(director, nodeKit, server.send);
  const waiting = await waitToHold(deputy, nodeKit, server.send);
  await addDevice(director, desk, readHolderQr(waiting.code)!, nodeKit, server.send);
  const admitted = await readDrop(deputy, waiting.waiting, nodeKit, server.send);
  if (admitted === null || admitted === 'contested') throw new Error('The deputy was not admitted');
  const followed = await keepAdmitted(deputy, waiting.waiting, admitted, nodeKit, server.send);
  await makeRecovery(deputy, followed.desk, nodeKit, 'make', server.send);
  await page(director, school);
  await press(`keys-box-holder-${waiting.waiting.device}`);
  await press('keys-remove-open');
  await press('keys-remove-yes');
  expect(texts()).toContain(words.remove.renewed);
  expect(has('keys-part-school') && has('keys-part-directorate')).toBe(true);
  expect(has('keys-orphaned')).toBe(false);
});

test('a pasted text that is no holder’s code says so, and a lost recovery maker is warned of', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const { school, director } = await world();
  await holdSchool(director, nodeKit, server.send);
  await page(director, school);
  await ReactTestRenderer.act(async () => {
    (
      tree!.root.findAllByProps({ testID: 'keys-add-paste' })[0].props as { onChangeText: (one: string) => void }
    ).onChangeText('minhajna-join:1:nothing');
    await settle();
  });
  await press('keys-add-scan');
  expect(texts()).toContain(words.add.notCode);
  expect(has('keys-add-confirm')).toBe(false);
  await ReactTestRenderer.act(() => tree?.unmount());
  const facts: KeysFacts = {
    own: 'a'.repeat(32),
    devices: ['a'.repeat(32)],
    recoveries: ['b'.repeat(32)],
    epochs: 2,
    fingerprint: '2-abcd',
  };
  jest.spyOn(keysPage, 'useKeysPage').mockReturnValue({
    mode: 'holder',
    facts,
    desk: null,
    orphaned: true,
    busy: false,
    problem: null,
    reload: () => undefined,
    choose: () => undefined,
    recovery: null,
    setRecovery: () => undefined,
    making: false,
    setMaking: () => undefined,
    said: null,
    setSaid: () => undefined,
  });
  await page(director, school);
  expect(has('keys-orphaned')).toBe(false);
  await press('keys-tab-recovery');
  expect(texts()).toContain(words.orphaned);
});
