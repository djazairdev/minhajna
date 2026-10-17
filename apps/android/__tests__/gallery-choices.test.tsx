// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Text } from 'react-native';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { CheckRow } from '../src/components/CheckRow';
import { OptionRow } from '../src/components/OptionRow';
import { Gallery } from '../src/gallery/Gallery';
import { samples } from '../src/gallery/samples';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
});

async function press(testID: string) {
  const [control] = tree.root.findAll((node) => node.props.testID === testID && !!node.props.onPress);
  expect(control).toBeDefined();
  await ReactTestRenderer.act(() => {
    (control.props as PressableProps).onPress?.({} as never);
  });
}

test('toggles only the requested checkbox and keeps option choices exclusive', async () => {
  await i18n.changeLanguage('ar');
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Gallery />);
  });
  const checks = () => tree.root.findAllByType(CheckRow).map((node) => node.props.checked as boolean);
  const options = () => tree.root.findAllByType(OptionRow).map((node) => node.props.selected as boolean | undefined);
  expect(checks()).toEqual([true, false, false, false, true]);
  await press('check-1');
  expect(checks()).toEqual([true, true, false, false, true]);
  await press('check-0');
  expect(checks()).toEqual([false, true, false, false, true]);
  expect(options()).toEqual([undefined, true, false, false, true]);
  await press('option-1');
  expect(options()).toEqual([undefined, false, true, false, true]);
  await press('option-1');
  expect(options()).toEqual([undefined, false, true, false, true]);
  await press('option-0');
  expect(options()).toEqual([undefined, true, false, false, true]);
  const actionCount = () =>
    tree.root
      .findByProps({ testID: 'gallery-entry-OptionRow' })
      .findAllByType(Text)
      .find((node) => node.props.accessibilityLiveRegion === 'polite')?.props.children as string;
  expect(actionCount()).toBe(samples.ar.activations.replace('{{count}}', '0'));
  await press('option-action');
  expect(actionCount()).toBe(samples.ar.activations.replace('{{count}}', '1'));
});
