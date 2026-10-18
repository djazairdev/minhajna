// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseDay } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { AppState, BackHandler, Text } from 'react-native';
import type { PressableProps, TextProps } from 'react-native';
import App from '../App';
import { FakeStorage } from '../jest/fake-storage';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { openRecordBook } from '../src/storage/history';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function start(storage: FakeStorage) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App storage={storage.asSpec()} />);
    await settle();
  });
}

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID }).props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function type(pin: string) {
  for (const digit of pin) await press(`pin-${digit}`);
}

function texts(): unknown[] {
  return tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
}

/** Moves the clock on by `away` milliseconds and brings the app back to the listeners still listening. */
function comeBackAfter(away: number) {
  const listening = new Set<Parameters<typeof AppState.addEventListener>[1]>();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    listening.add(listener);
    return { remove: () => listening.delete(listener) };
  });
  const realNow = Date.now.bind(Date);
  let offset = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
  return (step = away) =>
    ReactTestRenderer.act(async () => {
      offset += step;
      for (const listener of [...listening]) listener('active');
      await settle();
    });
}

const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;
const navigator = () => tree!.root.findAllByType(AppNavigator);

test('a fresh install asks for a PIN twice after the welcome, then opens setup', async () => {
  const storage = new FakeStorage();
  const comeBack = comeBackAfter(5 * 60_000 + 1_000);
  await start(storage);
  await press('welcome-start');
  expect(texts()).toContain(text.lock.create.title);
  await type('2580');
  expect(texts()).toContain(text.lock.create.repeat);
  await type('2581');
  expect(texts()).toContain(text.lock.create.mismatch);
  expect(texts()).toContain(text.lock.create.title);
  await type('2580');
  await type('2580');
  expect(storage.pin).toBe('2580');
  expect(navigator()).toHaveLength(1);
  expect(navigator()[0].props.initialState).toEqual({
    index: 1,
    routes: [{ name: 'Welcome' }, { name: 'Privacy' }],
  });
  expect(texts()).toContain(text.privacy.title);
  await comeBack();
  expect(navigator()).toHaveLength(0);
  await type('2580');
  expect(texts()).toContain(text.privacy.title);
});

test("Android's Back starts the PIN again, then returns to the welcome", async () => {
  const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.add(handler);
    return {
      remove: () => {
        handlers.delete(handler);
      },
    };
  });
  const back = () =>
    ReactTestRenderer.act(async () => {
      [...handlers].reverse().some((handler) => handler({ type: 'hardwareBackPress', timeStamp: 0 }) === true);
      await settle();
    });
  await start(new FakeStorage());
  await press('welcome-start');
  await type('2580');
  expect(texts()).toContain(text.lock.create.repeat);
  await back();
  expect(texts()).toContain(text.lock.create.title);
  await back();
  expect(has('welcome-start')).toBe(true);
});

test('offers the fingerprint after the first PIN where the phone has one', async () => {
  const storage = new FakeStorage();
  storage.biometricAvailable = true;
  await start(storage);
  await press('welcome-start');
  await type('1470');
  await type('1470');
  expect(texts()).toContain(text.lock.biometricAsk.title);
  storage.prompt = 'cancel';
  await press('biometric-yes');
  expect(texts()).toContain(text.lock.biometricAsk.failed);
  storage.prompt = 'match';
  await press('biometric-yes');
  expect(storage.biometric).toBe(true);
  expect(navigator()).toHaveLength(1);
});

test('a history from 0.1.0 keeps its records under the new PIN', async () => {
  const storage = new FakeStorage();
  const book = await openRecordBook(storage.asSpec());
  await book.recordAll(parseDay('2026-10-15'), [{ kind: 'setup.finished' }]);
  storage.opened = false;
  await start(storage);
  expect(has('welcome-start')).toBe(false);
  expect(texts()).toContain(text.lock.create.upgrade);
  await type('0000');
  await type('0000');
  expect(navigator()[0].props.initialRouteName).toBe('Home');
});

test('a wrong PIN is said, and the fifth brings a wait the right PIN cannot skip', async () => {
  const storage = FakeStorage.unlocked();
  storage.opened = false;
  await start(storage);
  expect(texts()).toContain(text.lock.promptPin);
  expect(has('pin-biometric')).toBe(false);
  await type('1111');
  expect(texts()).toContain(text.lock.wrong);
  for (let i = 0; i < 4; i++) await type('1111');
  expect(texts()).toContain(text.lock.waitWhy);
  expect(tree!.root.findByProps({ testID: 'pin-1' }).props.disabled).toBe(true);
  expect(storage.failures).toBe(5);
  await type('1234');
  expect(storage.failures).toBe(5);
  expect(navigator()).toHaveLength(0);
});

test('a wait counts down, then the PIN opens the app', async () => {
  const storage = FakeStorage.unlocked();
  storage.opened = false;
  storage.failures = 5;
  storage.waitUntil = Date.now() + 1_500;
  await start(storage);
  expect(texts()).toContain(text.lock.waitSeconds_two);
  expect(tree!.root.findByProps({ testID: 'pin-1' }).props.disabled).toBe(true);
  await type('1234');
  expect(storage.failures).toBe(5);
  await ReactTestRenderer.act(() => new Promise((resolve) => setTimeout(resolve, 2_100)));
  expect(tree!.root.findByProps({ testID: 'pin-1' }).props.disabled).toBe(false);
  await type('1234');
  expect(navigator()).toHaveLength(1);
});

test("the phone's prompt opens by itself where it is on, and a cancel leaves the PIN", async () => {
  const storage = FakeStorage.unlocked();
  storage.opened = false;
  storage.biometric = true;
  storage.prompt = 'cancel';
  const ask = jest.spyOn(storage, 'unlockWithBiometrics');
  await start(storage);
  expect(ask).toHaveBeenCalledTimes(1);
  expect(texts()).toContain(text.lock.prompt);
  expect(navigator()).toHaveLength(0);
  storage.prompt = 'match';
  await press('pin-biometric');
  expect(ask).toHaveBeenCalledTimes(2);
  expect(navigator()).toHaveLength(1);
});

test('a history still open at start is locked before anything shows', async () => {
  const storage = FakeStorage.unlocked();
  await start(storage);
  expect(storage.opened).toBe(false);
  expect(navigator()).toHaveLength(0);
  expect(texts()).toContain(text.lock.promptPin);
});

test('a first PIN that did not save is asked again, and the lock shows where the phone kept it', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const storage = new FakeStorage();
  const failure = () => Object.assign(new Error('The PIN did not save'), { code: 'E_HISTORY' });
  const create = jest.spyOn(storage, 'createLock').mockRejectedValueOnce(failure());
  await start(storage);
  await press('welcome-start');
  await type('2580');
  await type('2580');
  expect(texts()).toContain(text.lock.create.failed);
  expect(texts()).toContain(text.lock.create.title);
  expect(storage.pin).toBeNull();
  create.mockImplementationOnce((pin) => {
    storage.pin = pin;
    storage.opened = true;
    return Promise.reject(failure());
  });
  await type('2580');
  await type('2580');
  expect(texts()).toContain(text.lock.promptPin);
  expect(storage.opened).toBe(false);
  await type('2580');
  expect(navigator()).toHaveLength(1);
});

test('a wait ends on time when the app comes back from behind another app', async () => {
  const storage = FakeStorage.unlocked();
  storage.opened = false;
  storage.failures = 6;
  storage.waitUntil = Date.now() + 60_000;
  const comeBack = comeBackAfter(61_000);
  await start(storage);
  expect(texts()).toContain(text.lock.waitMinutes_one);
  expect(tree!.root.findByProps({ testID: 'pin-1' }).props.disabled).toBe(true);
  await comeBack();
  expect(texts()).not.toContain(text.lock.waitWhy);
  expect(tree!.root.findByProps({ testID: 'pin-1' }).props.disabled).toBe(false);
  await type('1234');
  expect(navigator()).toHaveLength(1);
});

test('a full phone refuses to try the PIN, and says why', async () => {
  const storage = FakeStorage.unlocked();
  storage.opened = false;
  jest
    .spyOn(storage, 'unlock')
    .mockRejectedValueOnce(Object.assign(new Error('A PIN try cannot be counted'), { code: 'E_NO_SPACE' }));
  await start(storage);
  await type('1234');
  expect(texts()).toContain(text.lock.noSpace);
  await type('1234');
  expect(navigator()).toHaveLength(1);
});

test('locks once back after five minutes away, and comes back to the same screen', async () => {
  const storage = FakeStorage.unlocked();
  const book = await openRecordBook(storage.asSpec());
  await book.recordAll(parseDay('2026-10-15'), [{ kind: 'setup.finished' }]);
  const comeBack = comeBackAfter(4 * 60_000);
  await start(storage);
  await type('1234');
  await press('tab-Classes');
  await comeBack();
  expect(navigator()).toHaveLength(1);
  await comeBack(5 * 60_000 + 1_000);
  expect(navigator()).toHaveLength(0);
  expect(storage.opened).toBe(false);
  expect(texts()).toContain(text.lock.promptPin);
  await type('1234');
  expect(navigator()).toHaveLength(1);
  const state = navigator()[0].props.initialState as {
    routes: { name: string; state?: { index: number; routeNames: string[] } }[];
  };
  const home = state.routes.find((route) => route.name === 'Home');
  expect(home?.state?.routeNames[home.state.index]).toBe('Classes');
});

test("a wait keeps the device's own time when the phone's clock is moved on", async () => {
  const storage = FakeStorage.unlocked();
  storage.opened = false;
  storage.failures = 6;
  storage.now = Date.now.bind(Date);
  storage.waitUntil = storage.now() + 60_000;
  const comeBack = comeBackAfter(61_000);
  await start(storage);
  await comeBack();
  expect(texts()).toContain(text.lock.waitWhy);
  expect(tree!.root.findByProps({ testID: 'pin-1' }).props.disabled).toBe(true);
});
