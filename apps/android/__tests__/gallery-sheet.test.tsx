// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Modal, Text, TextInput } from 'react-native';
import type { ModalProps, PressableProps, TextInputProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { BottomSheetSamples } from '../src/gallery/sheet-samples';
import { samples } from '../src/gallery/samples';
import { sheetTexts } from '../src/gallery/sheet-texts';
import { choiceTexts } from '../src/gallery/choice-texts';
import { fieldTexts } from '../src/gallery/text-field-texts';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(jest.requireActual<typeof import('react-native')>('react-native'), 'findNodeHandle').mockReturnValue(71);
});
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  const pending = jest.getTimerCount();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  expect(pending).toBe(0);
});

async function press(id: string) {
  const [node] = tree.root.findAll((node) => node.props.testID === id && !!node.props.onPress);
  expect(node).toBeDefined();
  await ReactTestRenderer.act(() => {
    (node.props as PressableProps).onPress?.({} as never);
  });
}

test.each(['short', 'long', 'form'] as const)(
  'opens the %s preview and cancellation never makes a choice',
  async (variant) => {
    await i18n.changeLanguage('ar');
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<BottomSheetSamples sample={samples.ar} language="ar" />);
    });
    const visible = () => (tree.root.findByType(Modal).props as ModalProps).visible;
    expect(visible()).toBe(false);
    await press(`sheet-open-${variant}`);
    expect(visible()).toBe(true);
    expect(accessibilityProblems(tree.root)).toEqual([]);
    if (variant === 'form') {
      const input = () => tree.root.findByType(TextInput).props as TextInputProps;
      await ReactTestRenderer.act(() => {
        input().onChangeText?.(fieldTexts.ar.value);
      });
      expect(input().value).toBe(fieldTexts.ar.value);
    }
    await press('sheet-close');
    expect(visible()).toBe(false);
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === sheetTexts.ar.cancelled)).toBe(true);
    await press(`sheet-open-${variant}`);
    await press('sheet-choice-0');
    expect(visible()).toBe(false);
    expect(
      tree.root
        .findAllByType(Text)
        .some((node) => node.props.children === sheetTexts.ar.chosen.replace('{{choice}}', choiceTexts.ar.option)),
    ).toBe(true);
  },
);
