// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Text, TextInput, type PressableProps, type TextInputProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { i18n, type Language } from '../src/text/i18n';
import { withData, type TestData } from './app-data';
import { LockStorage } from '../src/lock/lock-storage';

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

/** The current screen's renderer. */
export const settingsRoot = () => tree!.root;

/** Unmount before changing the language, so no previous screen keeps reacting to another test. */
export async function closeSettingsScreen(): Promise<void> {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
}

/** Made-up records only, under the language's matching layout direction. */
export async function showSettingsScreen(
  element: ReactElement,
  data: TestData,
  language: Language = 'ar',
): Promise<void> {
  await closeSettingsScreen();
  await i18n.changeLanguage(language);
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={language === 'ar' ? 'rtl' : 'ltr'}>
        <LockStorage.Provider value={data.storage.asSpec()}>{withData(data, element)}</LockStorage.Provider>
      </LocaleDirContext.Provider>,
    );
  });
}

/** A native control, not its caller-owned component wrapper. */
export const settingsControl = (id: string) =>
  settingsRoot().findAll((node) => node.props.testID === id && typeof node.props.accessibilityRole === 'string')[0]
    .props as PressableProps;

/** Disabled controls deliberately do nothing. */
export async function pressSettings(id: string): Promise<void> {
  await ReactTestRenderer.act(async () => {
    await settingsControl(id).onPress?.({} as never);
  });
}

/** Native edit boxes keep their real associated label. */
export const settingsInput = (id: string) =>
  settingsRoot()
    .findAllByType(TextInput)
    .find((node) => node.props.testID === id)!.props as TextInputProps;

/** Editing settles the AppData queue within the test's act. */
export async function typeSettings(id: string, value: string): Promise<void> {
  await ReactTestRenderer.act(() => {
    settingsInput(id).onChangeText?.(value);
  });
}

/** Text on this tree, without treating a record's own words as translations. */
export function settingsTexts(): string[] {
  return settingsRoot()
    .findAllByType(Text)
    .map((node) => [node.props.children as unknown].flat().join(''));
}
