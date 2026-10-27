// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's first run and lock with the browser's offers (#250, answers 511
// and 512), through the app as the web build picks its screens: while the
// browser offers installing the app as the page shows, its page comes
// before the passphrase, installs through the browser's dialog, or is put
// off or refused; with no offer then, the passphrase comes straight, and
// stays. The app asks the browser to keep the data as the passphrase is
// sent, on the first run and at the first try of each opening, and the
// lock warns while it does not. Made-up passphrases.

import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import type { PressableProps, TextInputProps, TextProps } from 'react-native';
import App from '../App';
import { browserState, changeOffer, resetBrowser } from '../jest/fake-browser';
import { FakeStorage } from '../jest/fake-storage';
import { TextField } from '../src/components/TextField';
import { forgetKept } from '../src/lock/browser-offers';
import text from '../src/text/ar.json';

jest.mock('../src/native/NativeMinhajnaBrowser', () => jest.requireActual<object>('../jest/fake-browser'));
jest.mock('../src/lock/CreatePin', () => jest.requireActual<object>('../src/lock/CreatePin.web'));
jest.mock('../src/lock/Unlock', () => jest.requireActual<object>('../src/lock/Unlock.web'));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const PASSPHRASE = 'chalk on the green board';
const web = text.lock.web;

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

beforeEach(() => {
  resetBrowser();
  forgetKept();
});
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function passphraseStorage(pin: string | null = null): FakeStorage {
  const storage = new FakeStorage();
  storage.pinRule = /^.{12,}$/u;
  storage.pin = pin;
  storage.created = pin !== null;
  return storage;
}

async function act(run: () => void) {
  await ReactTestRenderer.act(async () => {
    run();
    await settle();
  });
}

const start = (storage: FakeStorage) =>
  act(() => (tree = ReactTestRenderer.create(<App storage={storage.asSpec()} />)));
const press = (testID: string) =>
  act(() => (tree!.root.findByProps({ testID }).props as PressableProps).onPress?.({} as never));

function fill(testID: string, value: string) {
  const [input] = tree!.root.findAll((node) => node.type === TextField && node.props.testID === testID);
  return act(() => (input?.props as TextInputProps).onChangeText?.(value));
}

const texts = () => tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
const has = (testID: string) => tree!.root.findAll((node) => node.props.testID === testID).length > 0;

async function choosePassphrase() {
  await fill('passphrase-new', PASSPHRASE);
  await fill('passphrase-repeat', PASSPHRASE);
  await press('passphrase-create');
}

test('installs through the browser before the passphrase, then asks it to keep the data', async () => {
  const storage = passphraseStorage();
  await start(storage);
  await press('welcome-start');
  expect(texts()).toEqual(expect.arrayContaining([web.install.title, web.install.line, web.install.package]));
  expect(has('passphrase-new')).toBe(false);
  await press('install-app');
  expect(browserState.installs).toBe(1);
  expect(texts()).toEqual(expect.arrayContaining([web.install.done, web.install.opens]));
  await press('install-next');
  expect(texts()).toContain(web.create.title);
  expect(browserState.asked).toBe(0);
  await choosePassphrase();
  expect(browserState.asked).toBe(1);
  expect(texts()).toContain(text.privacy.title);
});

test('a refused install goes on to the passphrase and says where to install later', async () => {
  browserState.accepts = false;
  await start(passphraseStorage());
  await press('welcome-start');
  await press('install-app');
  expect(texts()).toEqual(expect.arrayContaining([web.create.title, web.install.failed]));
});

test('putting it off goes on with no install, and Back returns to the welcome', async () => {
  await start(passphraseStorage());
  await press('welcome-start');
  await press('install-back');
  expect(has('welcome-start')).toBe(true);
  await press('welcome-start');
  await press('install-later');
  expect(browserState.installs).toBe(0);
  expect(texts()).toContain(web.create.title);
});

test('with no offer the passphrase comes straight, and an offer made later does not take the page', async () => {
  browserState.state = 'none';
  await start(passphraseStorage());
  await press('welcome-start');
  expect(texts()).toContain(web.create.title);
  await act(() => changeOffer('offered'));
  expect(has('install-app')).toBe(false);
  expect(has('passphrase-new')).toBe(true);
});

test('an offer withdrawn before the press says it was not installed', async () => {
  await start(passphraseStorage());
  await press('welcome-start');
  await act(() => changeOffer('none'));
  await press('install-app');
  expect(texts()).toEqual(expect.arrayContaining([web.create.title, web.install.failed]));
});

test('installed from the browser’s own menu meanwhile, the page says so', async () => {
  await start(passphraseStorage());
  await press('welcome-start');
  await act(() => changeOffer('installed'));
  expect(texts()).toEqual(expect.arrayContaining([web.install.done, web.install.opens]));
  await press('install-next');
  expect(texts()).toContain(web.create.title);
});

test('the lock warns while the browser does not keep the data, and asks it once at each opening', async () => {
  const storage = passphraseStorage(PASSPHRASE);
  await start(storage);
  expect(has('keep-risk')).toBe(true);
  expect(texts()).toEqual(expect.arrayContaining([web.risk.badge, web.risk.title]));
  await fill('passphrase', 'not the passphrase');
  await press('passphrase-open');
  expect(browserState.asked).toBe(1);
  await fill('passphrase', PASSPHRASE);
  await press('passphrase-open');
  expect(storage.opened).toBe(true);
  expect(browserState.asked).toBe(1);
});

test('no warning once the browser keeps the data', async () => {
  browserState.kept = true;
  await start(passphraseStorage(PASSPHRASE));
  expect(texts()).toContain(web.title);
  expect(has('keep-risk')).toBe(false);
});
