// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مسح هذا الحاسوب» (#250, Web-erase, answers 518 to 520), as «مسح هذا الجهاز»
// erases a phone: the browser's database goes whole, with the sealed key, the
// history, the timings and the signing pair in it; then the open history's keys
// are forgotten, and every setting kept under the app's prefix goes, the
// interface language among them. A database the browser fails to delete leaves
// everything as it was, the history still open. The app's own files stay in the
// offline worker's cache, so it opens again without internet, empty as at
// first. A tab of the app that holds the database open closes it when the
// browser asks. One that keeps it open for longer than BLOCKED_FOR makes the
// erase answer E_ERASE_WAITS: the delete cannot be called back, and this tab's
// history waits behind it, so the page stays busy and asks for the other tabs
// to be closed; once they are, the erase finishes and this tab starts again.
// Every other tab reloads once the database is gone, so none goes on showing
// what was erased. The tab that erased keeps a mark for itself alone, so its
// next page says the PC was erased.

import { dropAllSettings, markErased } from '../web-settings.ts';
import { closeDatabase, NAME } from './database.ts';
import { coded, forgetOpened } from './lock.ts';

const CHANNEL = 'minhajna-erase';
/** How long another tab may keep the database open before the page is told the erase waits, in milliseconds. */
const BLOCKED_FOR = 3_000;

/** The channel between the app's tabs, where the browser has one. */
const channel =
  typeof location !== 'undefined' && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;

channel?.addEventListener('message', (event: MessageEvent) => {
  if (event.data === 'erased') location.reload();
});

/** Forgets the open history and the settings, once the database is gone, and tells the other tabs. */
function finish(): void {
  forgetOpened();
  dropAllSettings();
  markErased();
  channel?.postMessage('erased');
}

/** Erases everything the app keeps in this browser but its own files; the caller then restarts the app. */
export async function eraseDevice(): Promise<void> {
  await closeDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(NAME);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let late = false;
    request.onblocked = () => {
      timer ??= setTimeout(() => {
        late = true;
        reject(coded('The erase waits for the app’s other tabs', 'E_ERASE_WAITS'));
      }, BLOCKED_FOR);
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      finish();
      if (!late) resolve();
      else if (typeof location !== 'undefined') location.reload();
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error ?? new Error('The browser did not delete its database'));
    };
  });
}
