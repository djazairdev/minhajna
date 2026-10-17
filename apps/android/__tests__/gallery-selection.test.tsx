// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LocaleDirContext } from '@react-navigation/native';
import type { ReactElement } from 'react';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { RadioCardSamples } from '../src/gallery/radio-card-samples';
import { samples } from '../src/gallery/samples';
import { SegmentedControlSamples } from '../src/gallery/segmented-control-samples';

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

describe.each(
  (['ar', 'fr', 'en'] as const).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('selection previews (%s, %s)', (language, direction) => {
  test('two- and three-way switches change independently, and inactive previews stay put', async () => {
    await render(<SegmentedControlSamples language={language} sample={samples[language]} />, direction);
    await press('segments-two-seats');
    expect(control('segments-two-seats').accessibilityState?.selected).toBe(true);
    expect(control('segments-two-list').accessibilityState?.selected).toBe(false);
    expect(control('segments-three-week').accessibilityState?.selected).toBe(true);
    await press('segments-three-month');
    expect(control('segments-three-month').accessibilityState?.selected).toBe(true);
    expect(control('segments-three-week').accessibilityState?.selected).toBe(false);
    await press('segments-disabled-list');
    expect(control('segments-disabled-seats').accessibilityState?.selected).toBe(true);
    expect(control('segments-two-seats').accessibilityState?.selected).toBe(true);
    expect(accessibilityProblems(tree.root)).toEqual([]);
  });

  test('choosing one radio clears the other, never the group, and inactive previews stay put', async () => {
    await render(<RadioCardSamples language={language} sample={samples[language]} />, direction);
    expect(control('cards-first').accessibilityState?.checked).toBe(false);
    expect(control('cards-second').accessibilityState?.checked).toBe(false);
    await press('cards-second');
    expect(control('cards-second').accessibilityState?.checked).toBe(true);
    await press('cards-first');
    expect(control('cards-first').accessibilityState?.checked).toBe(true);
    expect(control('cards-second').accessibilityState?.checked).toBe(false);
    await press('cards-first');
    expect(control('cards-first').accessibilityState?.checked).toBe(true);
    await press('cards-disabled-second');
    expect(control('cards-disabled-first').accessibilityState?.checked).toBe(true);
    expect(control('cards-first').accessibilityState?.checked).toBe(true);
    expect(accessibilityProblems(tree.root)).toEqual([]);
  });
});
