// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The web versions of the native modules (#250): the settings, the lock's
// choices and crash reports kept in the browser under one prefix and
// refused as the phone refuses them; a browser that refuses its storage
// keeping nothing; the direction from the kept language; the browser's
// SHA-256 and random bytes; and every step of the later parts refused as
// not built yet. The browser's storages are made-up ones here; the vault's
// own tests are in vault.test.ts.

import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

const kept = new Map<string, string>();
let refusing = false;
const storage = {
  getItem: (key: string) => kept.get(key) ?? null,
  setItem(key: string, value: string) {
    if (refusing) throw new Error('QuotaExceededError');
    kept.set(key, value);
  },
  removeItem: (key: string) => void kept.delete(key),
};
Object.assign(globalThis, { localStorage: storage });

const { default: Interface } = await import('../src/native/Interface.ts');
const { default: Lock } = await import('../src/native/Lock.ts');
const { default: Crash } = await import('../src/native/Crash.ts');
const { default: Storage } = await import('../src/native/Storage.ts');
const { default: Files } = await import('../src/native/Files.ts');
const { isRtl } = await import('../src/direction.ts');

beforeEach(() => {
  kept.clear();
  refusing = false;
});

describe('the web modules', () => {
  it('keeps the language and settings under one prefix, and refuses what the phone refuses', () => {
    assert.equal(Interface.language(), null);
    assert.equal(isRtl(), true);
    Interface.setLanguage('fr');
    assert.equal(Interface.language(), 'fr');
    assert.equal(isRtl(), false);
    Interface.setSetting('print-size', 'a4');
    assert.equal(Interface.setting('print-size'), 'a4');
    assert.deepEqual([...kept.keys()].sort(), ['minhajna:language', 'minhajna:setting:print-size']);
    assert.throws(() => Interface.setSetting('Bad Key', 'x'), /E_SETTING/u);
    assert.throws(() => Interface.setSetting('long', 'x'.repeat(4097)), /E_SETTING/u);
    assert.equal(Interface.setting('Bad Key'), null);
    refusing = true;
    assert.throws(() => Interface.setLanguage('en'), /E_SETTING/u);
  });

  it('keeps the lock’s delay and screenshot choice, with the phone’s defaults', async () => {
    assert.deepEqual(Lock.settings(), { delayMinutes: 5, screenshots: false });
    await Lock.setDelay(15);
    await Lock.allowScreenshots(true);
    assert.deepEqual(Lock.settings(), { delayMinutes: 15, screenshots: true });
    await assert.rejects(Lock.setDelay(10), { code: 'E_SETTING' });
    kept.set('minhajna:lock-delay', '7');
    assert.equal(Lock.settings().delayMinutes, 5);
  });

  it('keeps a crash only while reports are on, and deletes it when they go off', () => {
    assert.equal(Crash.reportsOn(), false);
    assert.equal(Crash.keep('TypeError', ['a.js 1:2']), false);
    assert.equal(Crash.setReports(true), true);
    Crash.steps(['Today', 'Roll']);
    assert.equal(Crash.keep('TypeError', ['a.js 1:2']), true);
    assert.deepEqual(JSON.parse(Crash.kept() ?? ''), {
      type: 'TypeError',
      frames: ['a.js 1:2'],
      steps: ['Today', 'Roll'],
      version: '',
      android: '',
    });
    Crash.setReports(false);
    assert.equal(Crash.kept(), null);
  });

  it('gives the browser’s SHA-256 and random bytes, and a lock at set-up', async () => {
    assert.deepEqual(await Storage.digest(['abc']), [
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    ]);
    await assert.rejects(Storage.digest(['\ud800']), { code: 'E_NOT_WELL_FORMED' });
    assert.match(Storage.randomBytes(16), /^[0-9a-f]{32}$/u);
    assert.equal((await Storage.lockStatus()).state, 'setup');
  });

  it('refuses every step of the later parts as not built yet, keeping nothing', async () => {
    await assert.rejects(Storage.eraseDevice(), { code: 'E_WEB_NOT_YET' });
    await assert.rejects(Files.openText(), { code: 'E_WEB_NOT_YET' });
    assert.equal(kept.size, 0);
  });
});
