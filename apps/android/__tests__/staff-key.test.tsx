// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school security key in a national demo world (#572, answer 602), against a
// made-up demo server and a made-up browser's WebAuthn: on D-Issue, a key
// issued instead of a code offers no setup without security keys; with them,
// a closed prompt is said as the page's problem and keeps the button, and
// setting the key up for its teacher says to touch it, then that it is ready,
// once the key joined; the key then reads back the teacher's session with its
// signing key. A staffroom PC signs in with the key, asked once for two
// presses, after saying a closed prompt, a key set up nowhere in the world and
// a key without the PRF extension; a browser without security keys says so.
// Every world, school, teacher and key is made up.

import { directorSchool, seedNationalWorld, type SchoolCalendar } from '@minhajna/core';
import { Platform, Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { fakeBrowser, keyWorld, noBrowser, prfFrom, reference } from '../jest/staff-key';
import { DemoServer, nodeKit } from '../jest/world-server';
import { DemoRoot } from '../src/demo/DemoRoot';
import { personName } from '../src/director/dashboard-text';
import { leaveWorldNetwork, worldNetworkOpen } from '../src/network/world-network';
import { setUpKey, signInWithKey } from '../src/staff/key-session';
import { browserKey } from '../src/staff/security-key';
import { StaffKeySignIn } from '../src/staff/StaffKeySignIn';
import { StaffPc } from '../src/staff/StaffPc';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const calendar: SchoolCalendar = reference.calendar;
const server = new DemoServer();
const words = text.demo.staff.key;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => jest.replaceProperty(Platform, 'OS', 'web'));

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
  noBrowser();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () =>
  tree!.root.findAllByType(Text).map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const pressed = (testID: string) => (tree!.root.findAllByProps({ testID })[0].props as PressableProps).onPress;

async function turns(first: () => void = () => undefined) {
  for (let turn = 0; turn < 40; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) first();
      await settle();
    });
}

const press = (testID: string) => turns(() => pressed(testID)?.({} as never));

async function render(element: React.ReactElement) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
    await settle();
  });
}

test('D-Issue sets a key up with its teacher, and the key reads back the session', async () => {
  const storage = new FakeStorage();
  await render(
    <DemoRoot
      kit={nodeKit}
      calendar={calendar}
      profile={reference.profile}
      storage={storage.asSpec()}
      world={new FakeWorld(storage).asSpec()}
      send={server.send}
      onBack={() => undefined}
      onLeft={() => undefined}
      reference={reference}
    />,
  );
  for (const one of ['demo-start-national', 'world-role-director', 'world-page-keys', 'keys-take-seeded'])
    await press(one);
  await press('world-page-codes');
  const id = worldNetworkOpen()!;
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const first = school.teachers[0];
  await press(`issue-row-${first.id}`);
  await press('issue-key-instead');
  expect(has('issue-key-setup')).toBe(false);
  const keys = fakeBrowser(() => prfFrom(7));
  for (const one of ['world-page-keys', 'world-page-codes', `issue-row-${first.id}`]) await press(one);
  keys.create.mockRejectedValueOnce(Object.assign(new Error('Made up'), { name: 'NotAllowedError' }));
  await press('issue-key-setup');
  expect(texts()).toContain(words.cancelled);
  const plain = keys.create.getMockImplementation()!;
  let release = () => undefined as void;
  keys.create.mockImplementationOnce(async (options) => {
    await new Promise<void>((resolve) => (release = resolve));
    return plain(options);
  });
  await press('issue-key-setup');
  expect(has('issue-key-asking')).toBe(true);
  await turns(() => release());
  expect(has('issue-key-asking')).toBe(false);
  expect(has('issue-key-ready')).toBe(true);
  expect(has('issue-key-setup')).toBe(false);
  const session = await signInWithKey({ world: id }, browserKey(nodeKit.random)!, nodeKit, server.send);
  expect(session).toMatchObject({ world: id, teacher: personName(first), schoolName: personName(school) });
  expect(session.joins).toHaveLength(1);
  expect(session.signing?.certificate.world).toBe(id);
});

test('a staffroom PC signs in with the key, after saying a closed prompt, an unknown key and no PRF', async () => {
  const made = await keyWorld(server);
  let prf: Uint8Array | null = prfFrom(1);
  const keys = fakeBrowser(() => prf);
  const issue = await made.issue('key');
  await setUpKey({ world: made.id }, made.desk, issue, made.names, browserKey(nodeKit.random)!, nodeKit, server.send);
  await render(
    <StaffPc
      world={made.pc}
      school={made.school}
      profile={reference.profile}
      date="made-up"
      dayText={String}
      kit={nodeKit}
      send={server.send}
      onClose={() => undefined}
    />,
  );
  keys.get.mockClear();
  keys.get.mockRejectedValueOnce(Object.assign(new Error('Made up'), { name: 'NotAllowedError' }));
  await turns(() => {
    pressed('staff-key')?.({} as never);
    pressed('staff-key')?.({} as never);
  });
  expect(keys.get).toHaveBeenCalledTimes(1);
  expect(texts()).toContain(words.cancelled);
  prf = prfFrom(2);
  await press('staff-key');
  expect(texts()).toContain(words.notSet);
  prf = null;
  await press('staff-key');
  expect(texts()).toContain(words.unsupported);
  prf = prfFrom(1);
  await press('staff-key');
  expect(has('staff-session')).toBe(true);
  expect(texts().some((one) => one.includes(made.names.teacher))).toBe(true);
});

test('a browser without security keys says so and offers no key', async () => {
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  expect(browserKey(nodeKit.random)).toBeNull();
  await render(<StaffKeySignIn world={{ world: 'made-up' }} kit={nodeKit} onSession={() => undefined} />);
  expect(texts()).toContain(words.none);
  expect(has('staff-key')).toBe(false);
});
