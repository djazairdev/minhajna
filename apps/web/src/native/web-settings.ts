// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The settings a PC keeps outside the history (#250): the interface language,
// the lock's choices and the screens' own settings, never a record, as the
// phone keeps them outside its database. They live in the browser's local
// storage under one prefix, so erasing the PC finds every one. A browser
// that refuses the storage keeps none: reads give nothing, and writes fail.
// The mark that this tab erased the PC lives in the tab's own session
// storage, read once when the page loads (answer 519).

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

/** Forgets every value kept under the prefix. */
export function dropAllSettings(): void {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, at) => localStorage.key(at));
    for (const key of keys) if (key?.startsWith(PREFIX) === true) localStorage.removeItem(key);
  } catch {
    return;
  }
}

const ERASED = `${PREFIX}erased`;

/** Marks, for this tab alone, that it erased the PC. */
export function markErased(): void {
  try {
    sessionStorage.setItem(ERASED, 'yes');
  } catch {
    return;
  }
}

/** Whether this tab erased the PC before it loaded the page, forgetting the mark. */
export function takeErased(): boolean {
  try {
    const erased = sessionStorage.getItem(ERASED) === 'yes';
    sessionStorage.removeItem(ERASED);
    return erased;
  } catch {
    return false;
  }
}

/** The language the teacher chose on this PC, or null before any choice. */
export function keptLanguage(): string | null {
  return readSetting('language');
}
