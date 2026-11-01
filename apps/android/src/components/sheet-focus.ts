// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { findNodeHandle, type ViewInstance } from 'react-native';
import NativeInterface from '../native/NativeMinhajnaInterface';

/** The native interface accepts only an ephemeral view identifier, never its label or contents. */
export function focusTarget(target: ViewInstance | null) {
  if (target && target.isConnected !== false) {
    const tag = findNodeHandle(target);
    if (typeof tag === 'number') NativeInterface.focusView(tag);
  }
}

/**
 * Android has no Modal.onDismiss callback. With animation disabled, restore
 * after the closing commit's next frame; cancel if reopened or unmounted.
 * Keep the sheet mounted and change visible so every close path is covered.
 */
export function useSheetFocus(visible: boolean, returnFocusRef: RefObject<ViewInstance | null>) {
  const heading = useRef<ViewInstance>(null);
  const wasVisible = useRef(false);
  useLayoutEffect(() => {
    NativeInterface.cancelFocusRequest();
    const closing = wasVisible.current && !visible;
    wasVisible.current = visible;
    const frame = closing ? requestAnimationFrame(() => focusTarget(returnFocusRef.current)) : undefined;
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      NativeInterface.cancelFocusRequest();
    };
  }, [visible, returnFocusRef]);
  return { heading, focusHeading: () => focusTarget(heading.current) };
}
