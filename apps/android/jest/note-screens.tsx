// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Shared helpers for the lesson note screens' tests (#237): a made-up
// Thursday's sessions, with the lesson «فهم المنطوق 1 (مثال)» and its four
// stages projected for 4م1's second session on 22 October, and the ways the
// tests mount a screen, read it, press and type.

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Text, useWindowDimensions, type PressableProps, type TextInputProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { withData, type TestData } from './app-data';

export const staged = 'c-1/2026-10-22/m2/k-1-w';
export const window = { width: 360, height: 800, scale: 2, fontScale: 1 };

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
export const root = () => tree!.root;

const settle = async () => {
  for (let tick = 0; tick < 5; tick += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** Mounts `element` over `data`, left to right for `direction` ltr, at `fontScale`. */
export async function mount(data: TestData, element: ReactElement, direction: 'rtl' | 'ltr' = 'rtl', fontScale = 1) {
  jest.mocked(useWindowDimensions).mockReturnValue({ ...window, fontScale });
  await unmount();
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>{withData(data, element)}</LocaleDirContext.Provider>,
    );
    await settle();
  });
}

export async function unmount() {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
}

export const texts = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [(node.props as TextProps).children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );

/** The pressable with `testID`, if it does anything. */
export const control = (testID: string) =>
  root().findAll(
    (node) => node.props.testID === testID && typeof (node.props as PressableProps).onPress === 'function',
  )[0];

export async function press(testID: string, times = 1) {
  await ReactTestRenderer.act(async () => {
    for (let time = 0; time < times; time += 1) (control(testID).props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

export async function type(testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    root()
      .findAll((node) => node.props.testID === testID && typeof node.props.onChangeText === 'function')
      .map((node) => node.props as TextInputProps)[0]
      ?.onChangeText?.(value);
    await settle();
  });
}
