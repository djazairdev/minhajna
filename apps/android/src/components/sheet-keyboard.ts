// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useRef } from 'react';
import { TextInput, type ScrollViewInstance, type ViewInstance } from 'react-native';
import { spacing } from '../design/tokens';

/** Measure the modal's moving content frame, not the activity header or an assumed keyboard height. */
export function useSheetKeyboard() {
  const frame = useRef<ViewInstance>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const focused = useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput>>(null);
  const reveal = () => {
    const input = TextInput.State.currentlyFocusedInput();
    if (input && input === focused.current) {
      frame.current?.measureInWindow((_x, y) => {
        if (input === TextInput.State.currentlyFocusedInput()) {
          scroll.current?.scrollResponderScrollNativeHandleToKeyboard(input, y + spacing['space-16'], true);
        }
      });
    }
  };
  return {
    frame,
    scroll,
    reveal,
    onFocus: () => {
      focused.current = TextInput.State.currentlyFocusedInput();
      reveal();
    },
    onBlur: () => {
      focused.current = null;
    },
  };
}
