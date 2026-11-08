// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode rendered for the dashboard's tests (answer 856): a PC's storage
// under a made-up passphrase, with or without a kept made-up statement, the
// page rendered with no node mocks, as on a PC, its words and controls, the
// bar's Back, and the lock's passphrase typed. Every passphrase, key and
// statement is made up.

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Text, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { openTestData } from '../../android/jest/app-data';
import { FakeStorage } from '../../android/jest/fake-storage';
import { KEY_A, keepStatement, madeUpStatement } from '../../android/jest/reader-statements';
import teacher from '../../android/src/text/ar.json';
import { ReaderApp } from '../src/ReaderApp';

export const PASSPHRASE = 'a made-up reader passphrase';

/** A PC's storage, its passphrase set or not, its history open or not. */
export function passphraseStorage(passphrase: string | null = null, opened = false): FakeStorage {
  const storage = new FakeStorage();
  storage.pinRule = /^.{12,}$/u;
  storage.pin = passphrase;
  storage.opened = opened;
  storage.created = passphrase !== null;
  return storage;
}

/** A PC whose reader kept one made-up statement under the passphrase, its history locked again. */
export async function storageWithStatement(): Promise<FakeStorage> {
  const storage = passphraseStorage(PASSPHRASE, true);
  await keepStatement(await openTestData(storage), KEY_A, madeUpStatement('2026-10-01', '4M1'));
  await storage.asSpec().lockHistory();
  return storage;
}

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
export const rendered = () => tree!;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Runs a step, then lets the storage's answers and the screens settle; with no node mocks, as on a PC. */
export async function act(step: () => void = () => undefined) {
  for (let turn = 0; turn < 20; turn += 1)
    await ReactTestRenderer.act(async () => {
      if (turn === 0) step();
      await settle();
    });
}

/** Renders an element in the page's place. */
export async function show(shown: ReactElement) {
  await act(() => {
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value="rtl">{shown}</LocaleDirContext.Provider>);
  });
}

/** Unmounts the page rendered last, if any. */
export async function unmount() {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
}

export const texts = () =>
  rendered()
    .root.findAllByType(Text)
    .map((node) => [(node.props as TextProps).children].flat().map(String).join(''));
export const has = (testID: string) => rendered().root.findAll((node) => node.props.testID === testID).length > 0;
export const press = (testID: string) =>
  act(() => {
    const [node] = rendered().root.findAll((one) => one.props.testID === testID && one.props.onPress !== undefined);
    (node?.props as { onPress: (event: never) => void }).onPress({} as never);
  });
export const type = (testID: string, text: string) =>
  act(() => {
    const [node] = rendered().root.findAll(
      (one) => one.props.testID === testID && one.props.onChangeText !== undefined,
    );
    (node?.props as { onChangeText: (text: string) => void }).onChangeText(text);
  });

export const routeNames = () =>
  rendered()
    .root.findAll((node) => typeof node.props.testID === 'string')
    .map((node) => String(node.props.testID));
export const pressBack = () =>
  act(() => {
    const [back] = rendered().root.findAll(
      (node) => node.props.accessibilityLabel === teacher.navigation.back && node.props.onPress !== undefined,
    );
    (back?.props as { onPress: () => void }).onPress();
  });

/** Opens reader mode over `storage`, given as it is or changed, and types the passphrase on its lock. */
export async function unlock(storage: FakeStorage, leave: () => void, spec = storage.asSpec()) {
  await show(<ReaderApp onLeave={leave} storage={spec} />);
  await type('passphrase', PASSPHRASE);
  await press('passphrase-open');
}
