// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { samples } from '../src/gallery/samples';
import { StepperSamples } from '../src/gallery/stepper-samples';
import { stepperTexts } from '../src/gallery/stepper-texts';
import { SwitchSamples } from '../src/gallery/switch-samples';

let tree: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => ReactTestRenderer.act(() => tree?.unmount()));

async function render(element: ReactElement, direction: 'rtl' | 'ltr') {
  await ReactTestRenderer.act(() => {
    tree?.unmount();
    tree = ReactTestRenderer.create(<LocaleDirContext.Provider value={direction}>{element}</LocaleDirContext.Provider>);
  });
}

function control(testID: string) {
  return tree.root.findAll((node) => node.props.testID === testID && !!node.props.onFocus)[0].props as PressableProps;
}

async function press(testID: string) {
  await ReactTestRenderer.act(() => {
    control(testID).onPress?.({} as never);
  });
}

function count(testID: string) {
  return tree.root.findAllByType(Text).find((node) => node.props.testID === `${testID}-value`)!.props;
}

describe.each(
  (['ar', 'fr', 'en'] as const).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('switch and count previews (%s, %s)', (language, direction) => {
  test('switches change independently and disabled values stay put', async () => {
    await render(<SwitchSamples sample={samples[language]} language={language} />, direction);
    expect(control('switch-short').accessibilityState?.checked).toBe(false);
    expect(control('switch-long').accessibilityState?.checked).toBe(true);
    await press('switch-short');
    expect(control('switch-short').accessibilityState?.checked).toBe(true);
    expect(control('switch-long').accessibilityState?.checked).toBe(true);
    await press('switch-long');
    expect(control('switch-long').accessibilityState?.checked).toBe(false);
    await press('switch-disabled-false');
    await press('switch-disabled-true');
    expect(control('switch-disabled-false').accessibilityState?.checked).toBe(false);
    expect(control('switch-disabled-true').accessibilityState?.checked).toBe(true);
    expect(accessibilityProblems(tree.root)).toEqual([]);
  });

  test('counts stop at each limit, update their live name and leave the other preview alone', async () => {
    await render(<StepperSamples sample={samples[language]} language={language} />, direction);
    for (let at = 0; at < 3; at += 1) await press('stepper-short-increase');
    expect(count('stepper-short').children).toBe('3');
    expect(control('stepper-short-increase').disabled).toBe(true);
    for (let at = 0; at < 4; at += 1) await press('stepper-short-decrease');
    expect(count('stepper-short').children).toBe('0');
    expect(count('stepper-short').accessibilityLabel).toBe(
      `${stepperTexts[language].label}: 0. ${stepperTexts[language].unit}`,
    );
    expect(control('stepper-short-decrease').disabled).toBe(true);
    expect(count('stepper-long').children).toBe('36');
    await press('stepper-long-decrease');
    expect(count('stepper-long').children).toBe('35');
    for (const id of [
      'stepper-disabled-decrease',
      'stepper-disabled-increase',
      'stepper-fixed-decrease',
      'stepper-fixed-increase',
    ])
      await press(id);
    expect(count('stepper-disabled').children).toBe('2');
    expect(count('stepper-fixed').children).toBe('0');
    expect(count('stepper-short').children).toBe('0');
    expect(accessibilityProblems(tree.root)).toEqual([]);
  });
});
