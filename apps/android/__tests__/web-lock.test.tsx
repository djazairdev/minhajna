// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's passphrase screens (#250, answer 502) in the app, with the .web
// screens standing in for the phone's PIN screens as the web build picks
// them: a fresh PC asks for a passphrase of 12 characters or more twice,
// the lock asks for it and counts wrong ones, «نسيت عبارة المرور؟» says what
// is left to do, and the change page checks the current one. The
// passphrases are made up.

import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import type { PressableProps, TextInputProps, TextProps } from 'react-native';
import App from '../App';
import { FakeStorage } from '../jest/fake-storage';
import { TextField } from '../src/components/TextField';
import { LockPin } from '../src/lock/LockPin';
import { AppNavigator } from '../src/navigation/AppNavigator';
import text from '../src/text/ar.json';

jest.mock('../src/lock/CreatePin', () => jest.requireActual<object>('../src/lock/CreatePin.web'));
jest.mock('../src/lock/Unlock', () => jest.requireActual<object>('../src/lock/Unlock.web'));
jest.mock('../src/lock/LockPin', () => jest.requireActual<object>('../src/lock/LockPin.web'));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const PASSPHRASE = 'chalk on the green board';
const NEXT = 'another long passphrase';
const web = text.lock.web;

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function passphraseStorage(pin: string | null = null, opened = false): FakeStorage {
  const storage = new FakeStorage();
  storage.pinRule = /^.{12,}$/u;
  storage.pin = pin;
  storage.opened = opened;
  storage.created = pin !== null;
  return storage;
}

async function render(element: React.ReactElement) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
    await settle();
  });
}

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID }).props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function fill(testID: string, value: string) {
  const [input] = tree!.root.findAll((node) => node.type === TextField && node.props.testID === testID);
  await ReactTestRenderer.act(async () => {
    (input?.props as TextInputProps).onChangeText?.(value);
    await settle();
  });
}

function value(testID: string): unknown {
  return tree!.root.findAll((node) => node.type === TextField && node.props.testID === testID)[0]?.props.value;
}

function texts(): unknown[] {
  return tree!.root.findAllByType(Text).map((node): unknown => (node.props as TextProps).children);
}

const twelve = (template: string) => template.replace('{{count}}', '12');

test('a fresh PC asks for a passphrase of 12 characters or more twice, then opens setup', async () => {
  const storage = passphraseStorage();
  await render(<App storage={storage.asSpec()} />);
  await press('welcome-start');
  expect(texts()).toContain(web.create.title);
  expect(texts()).toContain(twelve(web.create.line_many));
  await fill('passphrase-new', 'short words');
  await fill('passphrase-repeat', 'short words');
  await press('passphrase-create');
  expect(texts()).toContain(twelve(web.short_many));
  await fill('passphrase-new', 'x'.repeat(1025));
  await fill('passphrase-repeat', 'x'.repeat(1025));
  await press('passphrase-create');
  expect(texts()).toContain(web.long);
  await fill('passphrase-new', PASSPHRASE);
  await fill('passphrase-repeat', `${PASSPHRASE}.`);
  await press('passphrase-create');
  expect(texts()).toContain(web.mismatch);
  expect(storage.pin).toBeNull();
  await fill('passphrase-repeat', PASSPHRASE);
  await press('passphrase-create');
  expect(storage.pin).toBe(PASSPHRASE);
  expect(texts()).toContain(text.privacy.title);
});

test('the lock asks for the passphrase, says a wrong one, and opens with the right one', async () => {
  const storage = passphraseStorage(PASSPHRASE);
  await render(<App storage={storage.asSpec()} />);
  expect(texts()).toContain(web.title);
  expect(tree!.root.findAllByType(AppNavigator)).toHaveLength(0);
  await press('passphrase-forgot');
  expect(texts()).toContain(web.forgotLine);
  await fill('passphrase', 'not the passphrase');
  await press('passphrase-open');
  expect(texts()).toContain(web.wrong);
  expect(storage.failures).toBe(1);
  await fill('passphrase', PASSPHRASE);
  await press('passphrase-open');
  expect(storage.opened).toBe(true);
  expect(tree!.root.findAllByType(AppNavigator)).toHaveLength(1);
});

test('the fifth wrong passphrase brings a wait, said once, that the right one cannot skip', async () => {
  const storage = passphraseStorage(PASSPHRASE);
  await render(<App storage={storage.asSpec()} />);
  for (let i = 1; i <= 5; i++) {
    await fill('passphrase', `wrong passphrase ${i}`);
    await press('passphrase-open');
  }
  expect(texts()).toContain(web.waitWhy);
  const wait = text.lock.waitSeconds_many.replace('{{count}}', '30');
  expect(texts().filter((shown) => shown === wait)).toHaveLength(2);
  await fill('passphrase', PASSPHRASE);
  await press('passphrase-open');
  expect(storage.opened).toBe(false);
});

test('the change page checks the current passphrase, then keeps the new one', async () => {
  const storage = passphraseStorage(PASSPHRASE, true);
  const onDone = jest.fn();
  const onCancel = jest.fn();
  await render(<LockPin storage={storage.asSpec()} mode="change" onDone={onDone} onCancel={onCancel} />);
  expect(texts()).toContain(web.change.title);
  await fill('passphrase-current', 'not the passphrase');
  await fill('passphrase-new', NEXT);
  await fill('passphrase-repeat', NEXT);
  await press('passphrase-change');
  expect(texts()).toContain(web.wrong);
  expect(onDone).not.toHaveBeenCalled();
  expect(['passphrase-current', 'passphrase-new', 'passphrase-repeat'].map(value)).toEqual(['', '', '']);
  await fill('passphrase-current', PASSPHRASE);
  await fill('passphrase-new', NEXT);
  await fill('passphrase-repeat', NEXT);
  await press('passphrase-change');
  expect(storage.pin).toBe(NEXT);
  expect(onDone).toHaveBeenCalledTimes(1);
  await press('lock-pin-cancel');
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('a passphrase that did not save says so, blaming space only for a full disk', async () => {
  const storage = passphraseStorage();
  storage.pinRule = /^$/u;
  await render(<App storage={storage.asSpec()} />);
  await press('welcome-start');
  await fill('passphrase-new', PASSPHRASE);
  await fill('passphrase-repeat', PASSPHRASE);
  await press('passphrase-create');
  expect(texts()).toContain(web.create.notSaved);
  expect(value('passphrase-new')).toBe('');
});

test('a PC has no fingerprint, so that page goes straight back', async () => {
  const onCancel = jest.fn();
  await render(
    <LockPin
      storage={passphraseStorage(PASSPHRASE, true).asSpec()}
      mode="biometric"
      onDone={jest.fn()}
      onCancel={onCancel}
    />,
  );
  expect(onCancel).toHaveBeenCalledTimes(1);
});
