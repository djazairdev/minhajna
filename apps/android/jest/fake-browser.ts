// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up PC browser for the web app's tests (#250, answers 511 and 512):
// it keeps the data or not, as a test sets it, counting each time the app
// asks; it offers installing the app or not, and its install dialog,
// shown only while it offers, is accepted or refused as set. A change of
// offer reaches whoever waits for one. The phone's tests have no such
// module, as a phone has none.

import type { Spec } from '../src/native/NativeMinhajnaBrowser';

let waiting: (() => void)[] = [];

export const browserState = {
  kept: false,
  asked: 0,
  state: 'offered' as 'installed' | 'offered' | 'none',
  accepts: true,
  installs: 0,
};

/** The browser changes its offer, as when Chrome makes one after the page loads. */
export function changeOffer(state: typeof browserState.state): void {
  browserState.state = state;
  const all = waiting;
  waiting = [];
  all.forEach((resolve) => resolve());
}

export function resetBrowser(): void {
  Object.assign(browserState, { kept: false, asked: 0, state: 'offered', accepts: true, installs: 0 });
}

export const fakeBrowser: Spec = {
  dataKept: () => Promise.resolve(browserState.kept),
  keepData: () => {
    browserState.asked += 1;
    return Promise.resolve(browserState.kept);
  },
  installState: () => browserState.state,
  install: () => {
    if (browserState.state !== 'offered') return Promise.resolve(false);
    browserState.installs += 1;
    changeOffer(browserState.accepts ? 'installed' : 'none');
    return Promise.resolve(browserState.accepts);
  },
  installChanged: () => new Promise<void>((resolve) => waiting.push(resolve)),
};

export default fakeBrowser;
