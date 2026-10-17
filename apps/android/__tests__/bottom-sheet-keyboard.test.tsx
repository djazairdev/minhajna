// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { KeyboardAvoidingView, ScrollView, TextInput, View } from 'react-native';
import type { KeyboardAvoidingViewProps, ScrollViewInstance, ScrollViewProps, ViewInstance } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { BottomSheet } from '../src/components/BottomSheet';
import { sheetTexts } from '../src/gallery/sheet-texts';
import { feedbackTexts } from '../src/gallery/feedback-texts';

jest.mock('react-native-safe-area-context', () => ({
  ...(jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default as object),
  useSafeAreaInsets: () => ({ top: 24, left: 8, right: 12, bottom: 16 }),
}));

let tree: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.restoreAllMocks();
});

test('uses modal-local insets and remeasures only its own focused input as the keyboard changes', async () => {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <BottomSheet
        visible
        title={sheetTexts.ar.title}
        context={sheetTexts.ar.context}
        reassurance={feedbackTexts.ar.reassurance}
        onClose={() => undefined}
        returnFocusRef={{ current: null }}
      >
        <TextInput />
      </BottomSheet>,
    );
  });
  const input = {} as ReturnType<typeof TextInput.State.currentlyFocusedInput>;
  const current = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(input);
  const frame = tree.root.findAllByType(View).find((node) => node.props.testID === 'sheet-content-frame')!;
  let top = 180;
  const measure = jest
    .spyOn(frame.instance as ViewInstance, 'measureInWindow')
    .mockImplementation((callback) => callback(0, top, 360, 300));
  const scroll = tree.root.findByType(ScrollView);
  const reveal = jest.spyOn(scroll.instance as ScrollViewInstance, 'scrollResponderScrollNativeHandleToKeyboard');
  const avoiding = tree.root.findByType(KeyboardAvoidingView).props as KeyboardAvoidingViewProps;
  expect(avoiding.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ paddingTop: 36, paddingLeft: 8, paddingRight: 12 })]),
  );
  expect((scroll.props as ScrollViewProps).contentContainerStyle).toEqual(
    expect.arrayContaining([expect.objectContaining({ paddingBottom: 32 })]),
  );
  await ReactTestRenderer.act(() => {
    avoiding.onLayout?.({} as never);
  });
  expect(reveal).not.toHaveBeenCalled();
  await ReactTestRenderer.act(() => {
    (scroll.props as ScrollViewProps).onFocus?.({} as never);
  });
  expect(reveal).toHaveBeenLastCalledWith(input, 196, true);
  top = 80;
  await ReactTestRenderer.act(() => {
    avoiding.onLayout?.({} as never);
  });
  expect(reveal).toHaveBeenLastCalledWith(input, 96, true);
  reveal.mockClear();
  current.mockReturnValue(undefined);
  await ReactTestRenderer.act(() => {
    avoiding.onLayout?.({} as never);
  });
  expect(reveal).not.toHaveBeenCalled();
  current.mockReturnValue(input);
  await ReactTestRenderer.act(() => {
    (scroll.props as ScrollViewProps).onBlur?.({} as never);
    avoiding.onLayout?.({} as never);
  });
  expect(reveal).not.toHaveBeenCalled();
  expect(scroll.props).toMatchObject({
    removeClippedSubviews: false,
    keyboardShouldPersistTaps: 'handled',
    keyboardDismissMode: 'on-drag',
  });
  let finish: Parameters<ViewInstance['measureInWindow']>[0] | undefined;
  measure.mockImplementation((callback) => {
    finish = callback;
  });
  await ReactTestRenderer.act(() => {
    (scroll.props as ScrollViewProps).onFocus?.({} as never);
  });
  current.mockReturnValue({} as NonNullable<typeof input>);
  await ReactTestRenderer.act(() => finish?.(0, 50, 360, 300));
  expect(reveal).not.toHaveBeenCalled();
});
