// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The interface opens in Arabic, right to left, until the teacher chooses
// another language (#21, answer 157). A choice that changes the direction
// restarts the interface; one that keeps it applies at once.

import { Text } from 'react-native';
import type { PressableProps, TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import NativeInterface from '../src/native/NativeMinhajnaInterface';
import { Welcome } from '../src/navigation/Welcome';
import { chooseLanguage, currentLanguage, i18n, startLanguage } from '../src/text/i18n';
import { FakeInterface } from '../jest/fake-interface';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

afterEach(async () => {
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

test('opens in Arabic before any choice, whatever the phone', () => {
  expect(new FakeInterface().asSpec().language()).toBeNull();
  expect(startLanguage(new FakeInterface().asSpec())).toBe('ar');
  expect(currentLanguage()).toBe('ar');
});

test('opens in the language kept on this phone, and in Arabic for one it does not offer', () => {
  const phone = new FakeInterface();
  phone.kept = 'fr';
  expect(startLanguage(phone.asSpec())).toBe('fr');
  phone.kept = 'de';
  expect(startLanguage(phone.asSpec())).toBe('ar');
});

test('keeps a choice that changes the direction, and restarts before showing it', () => {
  const phone = new FakeInterface();
  chooseLanguage('fr', phone.asSpec());
  expect([phone.kept, phone.restarts]).toEqual(['fr', 1]);
  expect(currentLanguage()).toBe('ar');
});

test('switches between French and English at once, with no restart', async () => {
  await i18n.changeLanguage('fr');
  const phone = new FakeInterface();
  chooseLanguage('en', phone.asSpec());
  expect([phone.kept, phone.restarts]).toEqual(['en', 0]);
  expect(currentLanguage()).toBe('en');

  chooseLanguage('ar', phone.asSpec());
  expect([phone.kept, phone.restarts]).toEqual(['ar', 1]);
});

test('does nothing when the current language is chosen again', () => {
  const phone = new FakeInterface();
  chooseLanguage('ar', phone.asSpec());
  expect([phone.kept, phone.restarts]).toEqual([null, 0]);
});

async function welcome() {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Welcome standalone />);
  });
  return tree!;
}

function chips(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAll(
    (node) => (node.props as PressableProps).accessibilityRole === 'radio' && typeof node.props.onPress === 'function',
  );
}

test('offers the three languages, each in its own name, with Arabic chosen at first', async () => {
  const tree = await welcome();
  expect(chips(tree).map((chip) => (chip.props as PressableProps).accessibilityState?.checked)).toEqual([
    true,
    false,
    false,
  ]);
  const names = chips(tree).map((chip) => chip.findByType(Text).props as TextProps);
  expect(names.map((name) => name.children)).toEqual(['العربية', 'Français', 'English']);
  await ReactTestRenderer.act(() => tree.unmount());
});

test('keeps the language chosen on the welcome page', async () => {
  const setLanguage = jest.spyOn(NativeInterface, 'setLanguage');
  const restart = jest.spyOn(NativeInterface, 'restart');
  const tree = await welcome();
  await ReactTestRenderer.act(() => {
    (chips(tree)[1].props as PressableProps).onPress?.({} as never);
  });
  expect(setLanguage).toHaveBeenCalledWith('fr');
  expect(restart).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(() => tree.unmount());
});

test('marks English as chosen once the interface is in English, and keeps the names', async () => {
  await i18n.changeLanguage('en');
  const tree = await welcome();
  expect(chips(tree).map((chip) => (chip.props as PressableProps).accessibilityState?.checked)).toEqual([
    false,
    false,
    true,
  ]);
  expect(chips(tree).map((chip) => (chip.findByType(Text).props as TextProps).children)).toEqual([
    'العربية',
    'Français',
    'English',
  ]);
  await ReactTestRenderer.act(() => tree.unmount());
});
