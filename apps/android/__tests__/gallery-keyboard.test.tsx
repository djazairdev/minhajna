// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Keyboard, KeyboardAvoidingView, ScrollView, TextInput, View } from 'react-native';
import type {
  KeyboardAvoidingViewProps,
  ScrollViewInstance,
  ScrollViewProps,
  ViewInstance,
  ViewProps,
} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { GalleryScroll } from '../src/gallery/GalleryScroll';

let tree: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  jest.restoreAllMocks();
});

test('measures the header offset and reveals the focused edit box after a keyboard resize', async () => {
  const input = {} as ReturnType<typeof TextInput.State.currentlyFocusedInput>;
  jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(input);
  const visible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
  const onContentSizeChange = jest.fn();
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <GalleryScroll onContentSizeChange={onContentSizeChange}>
        <View />
      </GalleryScroll>,
    );
  });
  const frameNode = tree.root.findByType(View);
  jest
    .spyOn(frameNode.instance as ViewInstance, 'measureInWindow')
    .mockImplementation((callback) => callback(0, 81, 360, 700));
  const reveal = jest.spyOn(
    tree.root.findByType(ScrollView).instance as ScrollViewInstance,
    'scrollResponderScrollNativeHandleToKeyboard',
  );
  const frame = frameNode.props as ViewProps;
  await ReactTestRenderer.act(() => {
    frame.onLayout?.({} as never);
  });
  const avoiding = () => tree.root.findByType(KeyboardAvoidingView).props as KeyboardAvoidingViewProps;
  expect(avoiding()).toMatchObject({ behavior: 'height', keyboardVerticalOffset: 81 });
  await ReactTestRenderer.act(() => {
    avoiding().onLayout?.({} as never);
  });
  expect(reveal).toHaveBeenCalledWith(input, 97, true);
  reveal.mockClear();
  await ReactTestRenderer.act(() => {
    (tree.root.findByType(View).props as ViewProps).onFocus?.({} as never);
  });
  expect(reveal).toHaveBeenCalledWith(input, 97, true);
  reveal.mockClear();
  const scroll = tree.root.findByType(ScrollView).props as ScrollViewProps;
  await ReactTestRenderer.act(() => {
    scroll.onContentSizeChange?.(360, 1200);
  });
  expect(onContentSizeChange).toHaveBeenCalledWith(360, 1200);
  expect(reveal).toHaveBeenCalledWith(input, 97, true);
  reveal.mockClear();
  visible.mockReturnValue(false);
  await ReactTestRenderer.act(() => {
    avoiding().onLayout?.({} as never);
  });
  expect(reveal).not.toHaveBeenCalled();
  expect(scroll).toMatchObject({ keyboardShouldPersistTaps: 'handled', keyboardDismissMode: 'on-drag' });
});
