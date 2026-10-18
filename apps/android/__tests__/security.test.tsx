// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «القفل والأمان» (#210): the way in from Help, changing the PIN, the
// fingerprint or face on and off, the delay, screenshots, and the screen
// guard on each kind of screen. Made-up records only.

import { parseDay } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { AppState, Text } from 'react-native';
import type { PressableProps, TextProps } from 'react-native';
import App from '../App';
import type { FakeLock } from '../jest/fake-lock';
import { FakeStorage } from '../jest/fake-storage';
import { typePin } from '../jest/unlock';
import NativeLock from '../src/native/NativeMinhajnaLock';
import { openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const lock = NativeLock as unknown as FakeLock;
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  lock.delayMinutes = 5;
  lock.screenshots = false;
  lock.guarded.length = 0;
});

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);

async function act(work: () => void) {
  await ReactTestRenderer.act(async () => {
    work();
    await settle();
  });
}

const press = (testID: string) =>
  act(() => (tree!.root.findByProps({ testID }).props as PressableProps).onPress?.({} as never));

/** Presses the innermost control that shows `label`. */
const pressLabel = (label: string) =>
  act(() => {
    const controls = tree!.root.findAll(
      (node) =>
        typeof (node.props as PressableProps).onPress === 'function' &&
        node.findAll((inner) => inner.type === Text && (inner.props as TextProps).children === label).length > 0,
    );
    (controls.at(-1)!.props as PressableProps).onPress?.({} as never);
  });

/** Opens the app on Today with setup finished, then «القفل والأمان» from Help. */
async function openSecurity(storage = FakeStorage.unlocked()) {
  const book = await openRecordBook(storage.asSpec());
  await book.recordAll(parseDay('2026-10-15'), [{ kind: 'setup.finished' }]);
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App storage={storage.asSpec()} />);
    await settle();
  });
  expect(lock.secure).toBe(true);
  await typePin(tree!, storage.pin!);
  expect(lock.secure).toBe(true);
  expect(lock.guarded).not.toContain('open');
  await press('today-help');
  expect(lock.secure).toBe(false);
  await pressLabel(text.security.title);
  expect(texts()).toContain(text.security.subtitle);
  return storage;
}

test('opens from Help and lists what stays on', async () => {
  await openSecurity();
  expect(lock.secure).toBe(false);
  expect(lock.guarded.slice(-2)).toEqual(['records', 'open']);
  for (const fact of ['fixedDatabase', 'fixedNotifications', 'fixedBackup', 'fixedPermissions'] as const) {
    expect(texts()).toContain(text.security[fact]);
  }
  expect(texts()).toContain(text.security.noBiometric);
  expect(tree!.root.findByProps({ testID: 'security-delay-5' }).props.selected).toBe(true);
});

test('changes the PIN after the current one, and starts again after a wrong one', async () => {
  const storage = await openSecurity();
  await press('security-change-pin');
  expect(lock.secure).toBe(true);
  expect(texts()).toContain(text.lock.change.current);
  await typePin(tree!, '1111');
  await typePin(tree!, '2580');
  await typePin(tree!, '2580');
  expect(texts()).toContain(text.lock.wrong);
  expect(texts()).toContain(text.lock.change.current);
  expect(storage.pin).toBe('1234');
  expect(storage.failures).toBe(1);
  await typePin(tree!, '1234');
  await typePin(tree!, '2580');
  await typePin(tree!, '2581');
  expect(texts()).toContain(text.lock.create.mismatch);
  expect(texts()).toContain(text.lock.change.next);
  await typePin(tree!, '2580');
  await typePin(tree!, '2580');
  expect(storage.pin).toBe('2580');
  expect(texts()).toContain(text.security.pinChanged);
  expect(lock.secure).toBe(false);
});

test('a wait from wrong PINs holds on the PIN page too', async () => {
  const storage = await openSecurity();
  storage.failures = 5;
  storage.waitUntil = Date.now() + 30_000;
  await press('security-change-pin');
  expect(texts()).toContain(text.lock.waitWhy);
  expect(tree!.root.findByProps({ testID: 'pin-1' }).props.disabled).toBe(true);
  await press('lock-pin-cancel');
  expect(texts()).toContain(text.security.subtitle);
});

test('turns the fingerprint on with the PIN and the prompt, and off again', async () => {
  const storage = FakeStorage.unlocked();
  storage.biometricAvailable = true;
  await openSecurity(storage);
  expect(tree!.root.findByProps({ testID: 'security-open-pin' }).props.selected).toBe(true);
  await press('security-open-phone');
  expect(texts()).toContain(text.lock.change.confirm);
  await typePin(tree!, '1111');
  expect(texts()).toContain(text.lock.wrong);
  expect(storage.biometric).toBe(false);
  storage.prompt = 'cancel';
  await typePin(tree!, '1234');
  expect(texts()).toContain(text.lock.change.biometricFailed);
  storage.prompt = 'match';
  await typePin(tree!, '1234');
  expect(storage.biometric).toBe(true);
  expect(texts()).toContain(text.security.biometricOn);
  expect(tree!.root.findByProps({ testID: 'security-open-phone' }).props.selected).toBe(true);
  await press('security-open-pin');
  expect(storage.biometric).toBe(false);
  expect(texts()).toContain(text.security.biometricOff);
});

test('the delay is kept, the lock counts with it and says it, and a change is said once', async () => {
  const listening = new Set<Parameters<typeof AppState.addEventListener>[1]>();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    listening.add(listener);
    return { remove: () => listening.delete(listener) };
  });
  const realNow = Date.now.bind(Date);
  let offset = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
  await openSecurity();
  await press('security-change-pin');
  for (const pin of ['1234', '2580', '2580']) await typePin(tree!, pin);
  expect(texts()).toContain(text.security.pinChanged);
  await press('security-delay-1');
  expect(lock.delayMinutes).toBe(1);
  expect(tree!.root.findByProps({ testID: 'security-delay-1' }).props.selected).toBe(true);
  offset = 61_000;
  await act(() => {
    for (const listener of [...listening]) listener('active');
  });
  expect(texts()).toContain(text.lock.footer_one);
  expect(lock.secure).toBe(true);
  await typePin(tree!, '2580');
  expect(texts()).toContain(text.security.subtitle);
  expect(texts()).not.toContain(text.security.pinChanged);
});

test('allowing screenshots is kept, and the switch shows it', async () => {
  await openSecurity();
  const toggle = (on: boolean) =>
    act(() =>
      (
        tree!.root.findByProps({ testID: 'security-screenshots' }).props as { onValueChange: (on: boolean) => void }
      ).onValueChange(on),
    );
  await toggle(true);
  expect(lock.screenshots).toBe(true);
  expect(tree!.root.findByProps({ testID: 'security-screenshots' }).props.value).toBe(true);
  await press('security-change-pin');
  expect(lock.secure).toBe(true);
  const before = lock.guarded.length;
  await press('lock-pin-cancel');
  expect(lock.guarded[before]).toBe('pin');
  await toggle(false);
  expect(lock.screenshots).toBe(false);
  expect(tree!.root.findByProps({ testID: 'security-screenshots' }).props.value).toBe(false);
});

test('the welcome is open to screenshots, and the first PIN is not', async () => {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App storage={new FakeStorage().asSpec()} />);
    await settle();
  });
  expect(lock.secure).toBe(false);
  await press('welcome-start');
  expect(lock.secure).toBe(true);
});
