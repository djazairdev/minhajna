// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up PC web app's update module for the tests (#250, answers 516 and
// 517): the server holds a newer build or not, installing it works or
// fails as a test sets it, and an update installed before the opening is
// kept until the app forgets it. The phone's tests have no such module, as
// a phone has none.

import type { Spec } from '../src/native/NativeMinhajnaUpdate';

export const updateState = {
  offer: null as string | null,
  installed: null as string | null,
  fails: false,
  installs: [] as string[],
  forgotten: 0,
};

export function resetUpdate(): void {
  Object.assign(updateState, { offer: null, installed: null, fails: false, installs: [], forgotten: 0 });
}

export const fakeUpdate: Spec = {
  available: () => Promise.resolve(updateState.offer),
  install: (sha256) => {
    updateState.installs.push(sha256);
    return updateState.fails
      ? Promise.reject(new Error('Made-up network failure'))
      : new Promise<void>(() => undefined);
  },
  installed: () => Promise.resolve(updateState.installed),
  forget: () => {
    updateState.installed = null;
    updateState.forgotten += 1;
  },
};

export default fakeUpdate;
