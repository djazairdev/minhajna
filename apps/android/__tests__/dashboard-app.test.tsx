// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard's door in the whole app on a PC (answer 809): from the lock
// page after the history was locked away, reading a teacher's statement
// (dashboard-reader) opens reader mode's notice once the passphrase is typed,
// not the screen left before the lock. The passphrase is made up.

import ReactTestRenderer from 'react-test-renderer';
import { Platform } from 'react-native';
import type { PressableProps, TextInputProps } from 'react-native';
import App from '../App';
import { FakeStorage } from '../jest/fake-storage';
import { TextField } from '../src/components/TextField';

jest.mock('../src/lock/CreatePin', () => jest.requireActual<object>('../src/lock/CreatePin.web'));
jest.mock('../src/lock/Unlock', () => jest.requireActual<object>('../src/lock/Unlock.web'));
jest.mock('../src/lock/LockPin', () => jest.requireActual<object>('../src/lock/LockPin.web'));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
const mockLocks: (() => void)[] = [];
jest.mock('../src/lock/useAutoLock', () => ({
  ...jest.requireActual<object>('../src/lock/useAutoLock'),
  useAutoLock: (_active: boolean, _minutes: number, lock: () => void) => {
    mockLocks.push(lock);
  },
}));

const PASSPHRASE = 'chalk on the green board';
let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const has = (testID: string) => tree!.root.findAll((node) => node.props.testID === testID).length > 0;

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findAll((node) => node.props.testID === testID)[0]?.props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function unlock() {
  const [input] = tree!.root.findAll((node) => node.type === TextField && node.props.testID === 'passphrase');
  await ReactTestRenderer.act(async () => {
    (input?.props as TextInputProps).onChangeText?.(PASSPHRASE);
    await settle();
  });
  await press('passphrase-open');
}

beforeEach(() => jest.replaceProperty(Platform, 'OS', 'web'));

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

test('reader mode asked from the lock page wins over the screen left before the lock', async () => {
  const storage = new FakeStorage();
  storage.pinRule = /^.{12,}$/u;
  storage.pin = PASSPHRASE;
  storage.created = true;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App storage={storage.asSpec()} />);
    await settle();
  });
  await unlock();
  await press('welcome-start');
  expect(has('privacy-accept')).toBe(true);
  await ReactTestRenderer.act(async () => {
    mockLocks.at(-1)?.();
    await settle();
  });
  await press('passphrase-dashboard');
  await press('dashboard-reader');
  await unlock();
  await press('privacy-accept');
  expect(has('reader-home')).toBe(true);
});
