// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The browser's two offers to a PC (#250). Keeping the data (R-6.6-08,
// answer 511): the app asks once the passphrase is set and at each
// opening, and until the browser agrees the lock page warns and Today
// offers a backup; what was last read is shared by every screen, and the
// web app reads it as it starts, so the lock page has it as it shows.
// Installing the app (R-6.6-05, answer 512): offered on a first-run page
// and in «الأجهزة والنسخ» while the browser offers it and the app is not
// installed; one follower waits for the browser's changes, however many
// screens show it. A phone has neither: its data counts as kept, and the
// app as installed.

import { useEffect, useSyncExternalStore } from 'react';
import found, { type Spec } from '../native/NativeMinhajnaBrowser';

/** The browser's module, which a phone does not have. */
const browser: Spec | null = found ?? null;

/** Whether the browser keeps the data; null until it has been read. */
let kept: boolean | null = null;
const listeners = new Set<() => void>();

function settle(value: boolean): boolean {
  if (kept !== value) {
    kept = value;
    listeners.forEach((listener) => listener());
  }
  return value;
}

/** Reads whether the browser keeps the data, without asking it to. */
export async function readKept(): Promise<boolean> {
  return settle(browser === null || (await browser.dataKept().catch(() => false)));
}

/** Asks the browser to keep the data, and says whether it does. */
export async function askToKeep(): Promise<boolean> {
  return settle(browser === null || (await browser.keepData().catch(() => false)));
}

/** Whether the browser keeps the data, read when nothing is known yet; null until then. */
export function useDataKept(): boolean | null {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (browser === null ? true : kept),
  );
  useEffect(() => {
    if (value === null) void readKept();
  }, [value]);
  return value;
}

export type InstallState = 'installed' | 'offered' | 'none';

function installState(): InstallState {
  const state = browser?.installState() ?? 'installed';
  return state === 'offered' || state === 'none' ? state : 'installed';
}

const installListeners = new Set<() => void>();
let following = false;

/** Waits for the browser's next change of offer, once for the whole app. */
function follow(): void {
  if (browser === null || following) return;
  following = true;
  const next = (): void => {
    installListeners.forEach((listener) => listener());
    void browser.installChanged().then(next);
  };
  void browser.installChanged().then(next);
}

/** Whether the app is installed or offered, followed as the browser changes it, and the install itself. */
export function useInstall(): { readonly state: InstallState; readonly install: () => Promise<boolean> } {
  const state = useSyncExternalStore((listener) => {
    installListeners.add(listener);
    follow();
    return () => installListeners.delete(listener);
  }, installState);
  return { state, install: () => browser?.install().catch(() => false) ?? Promise.resolve(false) };
}

/** Forgets what was read, for tests. */
export function forgetKept(): void {
  kept = null;
}
