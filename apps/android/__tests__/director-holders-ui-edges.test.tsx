// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys' holders at their edges in a national demo world (#571, answers 600
// and 601), against a made-up demo server: a reading of the drop space that
// lands after a new code is dropped, and a keyring read for an earlier wait is
// never kept; "different" starts again with a new code; two keyrings at one
// code are said; a manual check that finds nothing says so; a start that fails
// goes back to the choice and says why; a keyring kept whose follow fails still
// leaves the wait, and the page says why; a device a holder removed shows that
// alone, with nothing to add or remove; a scan cancelled says nothing, a
// refused camera says so, and a code with this device's own ID is refused; and
// D-Issue on a device that holds no key starts none, sending the director to
// D-Keys. Every world, school and device is made up.

import {
  directorSchool,
  eventOf,
  keptWaiting,
  latestHeld,
  readHolderQr,
  seedNationalWorld,
  type SchoolCalendar,
} from '@minhajna/core';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { calendarInput } from '../jest/calendar-input';
import { FakeStorage } from '../jest/fake-storage';
import { DemoServer, nodeKit } from '../jest/world-server';
import { failed, startWorld } from '../src/demo/world-session';
import * as holderWait from '../src/director/holder-wait';
import { addDevice, removeHolderDevice } from '../src/director/holders-session';
import * as issueSession from '../src/director/issue-session';
import * as keyringSession from '../src/director/keyring-session';
import { IssueCodes } from '../src/director/IssueCodes';
import { PUBLIC_KEY_BYTES } from '../src/director/school-desk';
import { SchoolKeys } from '../src/director/SchoolKeys';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';

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

type Device = Awaited<ReturnType<typeof world>>['director'];

const codeOf = (waiting: holderWait.Waiting) => readHolderQr(waiting.code)!;
const kept = (device: Device) => keptWaiting(device.book.entries, PUBLIC_KEY_BYTES);

async function render(element: React.ReactElement) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
    await settle();
  });
  await turns();
}

const keysPage = (open: Device, school: Awaited<ReturnType<typeof world>>['school']) =>
  render(<SchoolKeys world={open} school={school} kit={nodeKit} send={server.send} dayText={String} />);

test('a reading that lands after a new code is dropped, and a keyring read for another wait is not kept', async () => {
  const { school, director, deputy } = await world();
  const desk = await issueSession.holdSchool(director, nodeKit, server.send);
  const first = await holderWait.waitToHold(deputy, nodeKit, server.send);
  await addDevice(director, desk, codeOf(first), nodeKit, server.send);
  const admitted = await holderWait.readDrop(deputy, first.waiting, nodeKit, server.send);
  if (admitted === null || admitted === 'contested') throw new Error('The deputy was not admitted');
  let land: (found: typeof admitted) => void = () => undefined;
  jest.spyOn(holderWait, 'readDrop').mockImplementationOnce(() => new Promise((resolve) => (land = resolve)));
  await keysPage(deputy, school);
  await press('keys-wait-check');
  await press('keys-wait-again');
  const second = kept(deputy)!;
  expect(second.secret).not.toBe(first.waiting.secret);
  await ReactTestRenderer.act(async () => {
    land(admitted);
    await settle();
  });
  await turns();
  expect(has('keys-wait-compare')).toBe(false);
  await expect(holderWait.keepAdmitted(deputy, second, admitted, nodeKit, server.send)).rejects.toMatchObject({
    code: 'E_KEYRING_CHANGED',
  });
  expect(latestHeld(deputy.book.entries, PUBLIC_KEY_BYTES)).toBeNull();
});

test('“different” starts again with a new code, two keyrings are said, and an empty check says so', async () => {
  const { school, deputy } = await world();
  await keysPage(deputy, school);
  await press('keys-start-wait');
  await press('keys-wait-check');
  expect(texts()).toContain(words.wait.nothing);
  const first = kept(deputy)!.secret;
  const shown = { school: 'made-up', secret: first, fingerprint: '1-abcd', opened: {} as never };
  jest.spyOn(holderWait, 'readDrop').mockResolvedValueOnce(shown);
  await press('keys-wait-check');
  expect(has('keys-wait-compare')).toBe(true);
  await press('keys-wait-differ');
  expect(has('keys-wait-qr')).toBe(true);
  expect(kept(deputy)!.secret).not.toBe(first);
  jest.spyOn(holderWait, 'readDrop').mockResolvedValueOnce('contested');
  await press('keys-wait-check');
  expect(texts()).toContain(words.wait.contested);
});

test('a keyring kept whose follow fails still leaves the wait, and the page then says the problem', async () => {
  const { school, director, deputy } = await world();
  const desk = await issueSession.holdSchool(director, nodeKit, server.send);
  const waiting = await holderWait.waitToHold(deputy, nodeKit, server.send);
  await addDevice(director, desk, codeOf(waiting), nodeKit, server.send);
  await keysPage(deputy, school);
  await press('keys-wait-check');
  jest.spyOn(keyringSession, 'followSchool').mockRejectedValueOnce(failed('Made up', 'E_OFFLINE'));
  jest.spyOn(issueSession, 'holdSchool').mockRejectedValueOnce(failed('Made up', 'E_OFFLINE'));
  await press('keys-wait-same');
  expect(has('keys-wait')).toBe(false);
  expect(latestHeld(deputy.book.entries, PUBLIC_KEY_BYTES)).not.toBeNull();
  expect(texts()).toContain(text.demo.problem.offline);
});

test('a start that fails goes back to the choice, and a removed device shows only that', async () => {
  const { school, director, deputy } = await world();
  jest.spyOn(issueSession, 'holdSchool').mockRejectedValueOnce(failed('Made up', 'E_OFFLINE'));
  await keysPage(director, school);
  await press('keys-start-here');
  expect(has('keys-start')).toBe(true);
  expect(texts()).toContain(text.demo.problem.offline);
  await ReactTestRenderer.act(() => tree?.unmount());
  const desk = await issueSession.holdSchool(director, nodeKit, server.send);
  const waiting = await holderWait.waitToHold(deputy, nodeKit, server.send);
  await addDevice(director, desk, codeOf(waiting), nodeKit, server.send);
  const admitted = await holderWait.readDrop(deputy, waiting.waiting, nodeKit, server.send);
  if (admitted === null || admitted === 'contested') throw new Error('The deputy was not admitted');
  await holderWait.keepAdmitted(deputy, waiting.waiting, admitted, nodeKit, server.send);
  await removeHolderDevice(director, desk, waiting.waiting.device, nodeKit, server.send);
  await keysPage(deputy, school);
  expect(texts()).toContain(words.removed);
  expect(has('keys-add') || has('keys-group-holders') || has('keys-start')).toBe(false);
});

test('a scan cancelled says nothing, a refused camera says so, and this device’s own code is refused', async () => {
  const { school, director } = await world();
  const desk = await issueSession.holdSchool(director, nodeKit, server.send);
  await keysPage(director, school);
  calendarInput.scanQr.mockResolvedValueOnce(null);
  await press('keys-add-scan');
  expect(has('keys-add-confirm')).toBe(false);
  calendarInput.scanQr.mockRejectedValueOnce(failed('Made up', 'E_CALENDAR_CAMERA'));
  await press('keys-add-scan');
  expect(texts()).toContain(text.demo.school.problem.camera);
  const own = `minhajna-holder:1:${desk.held.device}:${desk.held.publicKey}:${'ab'.repeat(16)}`;
  calendarInput.scanQr.mockResolvedValueOnce(own);
  await press('keys-add-scan');
  expect(texts()).toContain(words.add.own);
  expect(has('keys-add-confirm')).toBe(false);
});

test('D-Issue on a device that holds no key starts none and sends the director to D-Keys', async () => {
  const { school, director } = await world();
  await render(
    <IssueCodes
      world={director}
      school={school}
      profile={reference.profile}
      kit={nodeKit}
      send={server.send}
      dayText={String}
    />,
  );
  expect(texts()).toContain(text.demo.issue.keysFirst);
  expect(director.book.entries.filter((one) => eventOf(one)?.kind === 'school.held')).toHaveLength(0);
});
