// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The browser's offers on the web (#250, answers 511, 512 and 523), on a
// made-up page: keeping the data through the storage manager, counted as not
// kept when it is missing or fails; the install offer, held from the start in
// place of the browser's own, spent once its dialog is answered, and over once
// the app is installed, one the page kept before the module ran, through
// public/offer.js, taken over; and a report's text shared, or copied where
// sharing is missing or fails. The last tests load fresh copies of the module,
// as installing cannot be undone.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

type Handler = (event: Event) => void;
const handlers = new Map<string, Handler>();
const keeper = { persisted: false, granted: false, asked: 0, failing: false };

Object.assign(globalThis, {
  window: {
    addEventListener: (kind: string, handler: Handler) => handlers.set(kind, handler),
    matchMedia: () => ({ matches: false }),
  },
});
Object.defineProperty(navigator, 'storage', {
  configurable: true,
  value: {
    persisted: () => (keeper.failing ? Promise.reject(new Error('refused')) : Promise.resolve(keeper.persisted)),
    persist: () => {
      keeper.asked += 1;
      if (keeper.failing) return Promise.reject(new Error('refused'));
      keeper.persisted = keeper.granted;
      return Promise.resolve(keeper.granted);
    },
  },
});

const { default: Browser } = await import('../src/native/Browser.ts');

/** A fresh copy of the module, as installing cannot be undone. */
async function fresh(name: string) {
  const copy: string = `../src/native/Browser.ts?${name}`;
  return ((await import(copy)) as typeof import('../src/native/Browser.ts')).default;
}

/** An install offer the teacher answers with `outcome`. */
function made(outcome: string) {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    shown: 0,
    prompt() {
      event.shown += 1;
      return Promise.resolve();
    },
    userChoice: Promise.resolve({ outcome }),
  });
  return event;
}

/** The browser makes its install offer once this module has run. */
function offer(outcome: string) {
  const event = made(outcome);
  handlers.get('beforeinstallprompt')?.(event);
  return event;
}

beforeEach(() => Object.assign(keeper, { persisted: false, granted: false, asked: 0, failing: false }));

describe('the browser module', () => {
  it('sends a text through the share menu, or copies it where there is none or it fails', async () => {
    const copied: string[] = [];
    let sharing: ((data: { title: string; text: string }) => Promise<void>) | undefined;
    let copying = true;
    Object.defineProperty(navigator, 'share', { configurable: true, get: () => sharing });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          if (!copying) return Promise.reject(new Error('refused'));
          copied.push(text);
          return Promise.resolve();
        },
      },
    });
    assert.equal(await Browser.sendText('Made up', 'A made-up report'), 'copied');
    sharing = () => Promise.resolve();
    assert.equal(await Browser.sendText('Made up', 'Shared'), 'shared');
    sharing = () => Promise.reject(Object.assign(new Error('closed'), { name: 'AbortError' }));
    assert.equal(await Browser.sendText('Made up', 'Closed'), 'cancelled');
    sharing = () => Promise.reject(Object.assign(new Error('not allowed'), { name: 'NotAllowedError' }));
    assert.equal(await Browser.sendText('Made up', 'Refused share'), 'copied');
    copying = false;
    assert.equal(await Browser.sendText('Made up', 'Refused copy'), 'failed');
    assert.deepEqual(copied, ['A made-up report', 'Refused share']);
  });

  it('reads and asks whether the data is kept, counting a failure as not kept', async () => {
    assert.equal(await Browser.dataKept(), false);
    assert.equal(await Browser.keepData(), false);
    assert.equal(keeper.asked, 1);
    keeper.granted = true;
    assert.equal(await Browser.keepData(), true);
    assert.equal(await Browser.dataKept(), true);
    keeper.failing = true;
    assert.equal(await Browser.dataKept(), false);
    assert.equal(await Browser.keepData(), false);
  });

  it('holds the install offer, spends it once answered, and says when it changes', async () => {
    assert.equal(Browser.installState(), 'none');
    assert.equal(await Browser.install(), false);
    let changes = 0;
    void Browser.installChanged().then(() => (changes += 1));
    const refused = offer('dismissed');
    assert.equal(refused.defaultPrevented, true);
    assert.equal(Browser.installState(), 'offered');
    await Promise.resolve();
    assert.equal(changes, 1);
    assert.equal(await Browser.install(), false);
    assert.equal(refused.shown, 1);
    assert.equal(Browser.installState(), 'none');
    const later = offer('accepted');
    handlers.get('appinstalled')?.(new Event('appinstalled'));
    assert.equal(Browser.installState(), 'installed');
    assert.equal(await Browser.install(), false);
    assert.equal(later.shown, 0);
  });

  it('counts the app installed once its dialog is accepted, and offers nothing more', async () => {
    const browser = await fresh('accepted');
    const accepted = offer('accepted');
    assert.equal(browser.installState(), 'offered');
    assert.equal(await browser.install(), true);
    assert.equal(accepted.shown, 1);
    assert.equal(browser.installState(), 'installed');
    offer('accepted');
    assert.equal(browser.installState(), 'installed');
  });

  it('takes over an offer, or an install, the page kept before it ran', async () => {
    const early = made('accepted');
    Object.assign(window, { minhajnaOffer: early });
    const browser = await fresh('early');
    assert.equal(browser.installState(), 'offered');
    assert.equal(await browser.install(), true);
    assert.equal(early.shown, 1);
    Object.assign(window, { minhajnaInstalled: true });
    assert.equal((await fresh('installed')).installState(), 'installed');
  });
});
