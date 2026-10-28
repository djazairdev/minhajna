// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the PC's browser offers (#250, answers 511 and 512). Keeping the
// data goes through the storage manager: Chrome and Edge decide on their
// own, by how the site is used, and agree for an installed app; Firefox
// asks the teacher. A browser with no storage manager, or one that fails,
// counts as not keeping it. Installing goes through the offer Chrome and
// Edge make once the page loads: public/offer.js holds it from the page's
// first moment, as the app shows its own button in place of the
// browser's, and it is spent once its dialog has been answered, as a
// browser offers each one once. The app counts as installed while it runs
// in its own window, or once the browser says it was installed. Whether
// this tab erased the PC just before is read once, as the page loads, so
// the welcome says it for as long as the page lasts (answer 519).

import type { Spec } from '../../../android/src/native/NativeMinhajnaBrowser';
import { takeErased } from './web-settings.ts';

/** The browser's install offer, of which only these parts are used. */
type Offer = Event & {
  prompt(): Promise<unknown>;
  readonly userChoice: Promise<{ readonly outcome: string }>;
};

/** What public/offer.js kept before this module ran. */
type Early = { minhajnaOffer?: Offer; minhajnaInstalled?: boolean };

const early: Early = typeof window === 'undefined' ? {} : (window as unknown as Early);
let installed =
  early.minhajnaInstalled === true ||
  (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches === true);
let offer: Offer | null = installed ? null : (early.minhajnaOffer ?? null);
let waiting: (() => void)[] = [];
const erased = typeof window !== 'undefined' && takeErased();

function changed(): void {
  const all = waiting;
  waiting = [];
  all.forEach((resolve) => resolve());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    offer = event as Offer;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    offer = null;
    changed();
  });
}

/** The storage manager, when the browser has one. */
function manager(): StorageManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage;
}

const Browser: Spec = {
  async dataKept() {
    try {
      return (await manager()?.persisted?.()) === true;
    } catch {
      return false;
    }
  },
  async keepData() {
    try {
      return (await manager()?.persist?.()) === true || (await manager()?.persisted?.()) === true;
    } catch {
      return false;
    }
  },
  installState: () => (installed ? 'installed' : offer !== null ? 'offered' : 'none'),
  async install() {
    const shown = offer;
    if (shown === null || installed) return false;
    offer = null;
    try {
      await shown.prompt();
      const accepted = (await shown.userChoice).outcome === 'accepted';
      if (accepted) installed = true;
      return accepted;
    } catch {
      return false;
    } finally {
      changed();
    }
  },
  installChanged: () => new Promise<void>((resolve) => waiting.push(resolve)),
  erasedHere: () => erased,
};

export default Browser;
