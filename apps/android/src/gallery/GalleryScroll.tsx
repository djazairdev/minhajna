// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { ScrollViewInstance, ScrollViewProps, ViewInstance } from 'react-native';
import { spacing } from '../design/tokens';

/**
 * Edge-to-edge Android does not resize this preview for the IME. Measure the
 * real header offset, shrink the gallery above the keyboard, and reveal the
 * focused field once the viewport has resized. ScrollView's focus measurement
 * is content-relative while the keyboard is screen-relative, so its reveal
 * offset includes that header too. No keyboard data is retained.
 * Only this scroll area's inputs may resize it. Native children stay attached
 * so a modal can restore its off-screen opener after the window regains focus.
 */
export function GalleryScroll(props: ScrollViewProps) {
  const frame = useRef<ViewInstance>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const focused = useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput>>(null);
  const [ownsKeyboard, setOwnsKeyboard] = useState(false);
  const [top, setTop] = useState(0);
  const reveal = () => {
    const input = TextInput.State.currentlyFocusedInput();
    if (input && input === focused.current && Keyboard.isVisible()) {
      scroll.current?.scrollResponderScrollNativeHandleToKeyboard(input, top + spacing['space-16'], true);
    }
  };
  return (
    <View
      ref={frame}
      style={styles.fill}
      onFocus={() => {
        focused.current = TextInput.State.currentlyFocusedInput();
        setOwnsKeyboard(!!focused.current);
        reveal();
      }}
      onBlur={() => {
        focused.current = null;
        setOwnsKeyboard(false);
      }}
      onLayout={() => frame.current?.measureInWindow((_x, y) => setTop(y))}
    >
      <KeyboardAvoidingView
        enabled={ownsKeyboard}
        behavior="height"
        keyboardVerticalOffset={top}
        style={styles.fill}
        onLayout={reveal}
      >
        <ScrollView
          {...props}
          removeClippedSubviews={false}
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={(width, height) => {
            props.onContentSizeChange?.(width, height);
            reveal();
          }}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
