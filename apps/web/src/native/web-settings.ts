// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The settings a PC keeps outside the history (#250): the interface language,
// the lock's choices and the screens' own settings, never a record, as the
// phone keeps them outside its database. They live in the browser's local
// storage under one prefix, so erasing the PC finds every one. A browser
// that refuses the storage keeps none: reads give nothing, and writes fail.

const PREFIX = 'minhajna:';

/** The kept value, or null when there is none or the browser refuses its storage. */
export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

/** Keeps the value; false when the browser refused it. */
export function writeSetting(key: string, value: string): boolean {
  try {
    localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}

/** Forgets the value, if any. */
export function dropSetting(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    return;
  }
}

/** The language the teacher chose on this PC, or null before any choice. */
export function keptLanguage(): string | null {
  return readSetting('language');
}
