// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types the PIN on the lock screen (#210), for tests that start with a
// history already under a PIN: every start asks for it, as on the phone.

import ReactTestRenderer from 'react-test-renderer';
import type { PressableProps } from 'react-native';

/** Types `pin` on the keypad the tree shows, a digit at a time, letting each press settle. */
export async function typePin(tree: ReactTestRenderer.ReactTestRenderer, pin = '1234'): Promise<void> {
  for (const digit of pin) {
    await ReactTestRenderer.act(async () => {
      (tree.root.findByProps({ testID: `pin-${digit}` }).props as PressableProps).onPress?.({} as never);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}
