// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode in the dashboard (answer 856), with the PC's passphrase pages
// as the web build picks them: the home's row opens it and its way back
// returns; first use asks for a passphrase twice, then shows the notice in
// reader mode, then the reader's home, with Settings and neither Help nor
// teaching, and none of the teacher app's navigator; the small Settings and
// what its rows open; leaving locks the history; a later unlock lands on the
// reader's home once a statement is kept, and on the notice until then; a
// crash report kept before the last stop is offered on the home. Every
// passphrase, key and statement is made up.

import { Platform } from 'react-native';
import { fakeCrash } from '../../android/jest/fake-crash';
import { AppNavigator } from '../../android/src/navigation/AppNavigator';
import teacher from '../../android/src/text/ar.json';
import { FakeDirectory } from '../jest/fake-directory';
import { DashboardApp } from '../src/DashboardApp';
import { ReaderApp } from '../src/ReaderApp';
import {
  PASSPHRASE,
  has,
  passphraseStorage,
  press,
  pressBack,
  rendered,
  routeNames,
  show,
  storageWithStatement,
  texts,
  type,
  unlock as open,
  unmount,
} from '../jest/reader-page';
import words from '../src/text/ar.json';

const unlock = (storage: Parameters<typeof open>[0]) => open(storage, leave);

jest.mock('../../android/src/lock/CreatePin', () => jest.requireActual<object>('../../android/src/lock/CreatePin.web'));
jest.mock('../../android/src/lock/Unlock', () => jest.requireActual<object>('../../android/src/lock/Unlock.web'));
jest.mock('../../android/src/lock/LockPin', () => jest.requireActual<object>('../../android/src/lock/LockPin.web'));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const leave = jest.fn();

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  leave.mockClear();
  fakeCrash.reset();
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

describe('reader mode', () => {
  it('opens from the home on its passphrase page, which goes back to the home', async () => {
    new FakeDirectory().install();
    await show(<DashboardApp />);
    expect(texts()).toContain(words.home.reader);
    await press('dashboard-reader');
    expect(has('dashboard-reader')).toBe(false);
    expect(texts()).toContain(words.reader.leave);
    await press('reader-leave');
    expect(has('dashboard-reader')).toBe(true);
  });

  it('asks for a passphrase first, then shows the notice, then the reader’s home', async () => {
    const storage = passphraseStorage();
    await show(<ReaderApp onLeave={leave} storage={storage.asSpec()} />);
    expect(texts()).toContain(teacher.lock.web.create.title);
    expect(has('passphrase-back')).toBe(false);
    await type('passphrase-new', PASSPHRASE);
    await type('passphrase-repeat', PASSPHRASE);
    await press('passphrase-create');
    expect(storage.pin).toBe(PASSPHRASE);
    expect(texts()).toContain(teacher.privacy.title);
    await press('privacy-accept');
    expect(has('reader-home')).toBe(true);
    expect(has('reader-picture-empty')).toBe(true);
    expect(['reader-settings', 'reader-leave'].map(has)).toEqual([true, true]);
    expect(['reader-help', 'reader-teach', 'welcome-start'].map(has)).toEqual([false, false, false]);
    expect(rendered().root.findAllByType(AppNavigator)).toHaveLength(0);
  });

  it('keeps a small Settings: the lock, the language, erasing this PC, crash reports and the notice', async () => {
    await unlock(await storageWithStatement());
    await press('reader-settings');
    const rows = routeNames().filter((id) => id.startsWith('settings-'));
    expect(rows).toEqual(
      expect.arrayContaining([
        'settings-security',
        'settings-language',
        'settings-erase',
        'settings-crashes',
        'settings-privacy',
      ]),
    );
    expect(['settings-card', 'settings-help', 'settings-export', 'settings-received'].map(has)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    await press('settings-crashes');
    expect(fakeCrash.on).toBe(true);
    await press('settings-erase');
    expect(['erase-confirm', 'erase-export'].map(has)).toEqual([true, false]);
    await pressBack();
    await press('settings-language');
    expect(has('settings-language-fr')).toBe(true);
    await pressBack();
    await press('settings-security');
    expect(texts()).toContain(teacher.security.web.subtitle);
    await pressBack();
    await press('settings-privacy');
    expect(has('privacy-accept')).toBe(false);
    expect(has('privacy-connections')).toBe(true);
  });

  it('locks the history as it goes back to the dashboard, from the home and from the first notice', async () => {
    const storage = await storageWithStatement();
    await unlock(storage);
    expect(storage.opened).toBe(true);
    await press('reader-leave');
    expect(leave).toHaveBeenCalledTimes(1);
    expect(storage.opened).toBe(false);
    await unmount();
    const fresh = passphraseStorage(PASSPHRASE);
    await unlock(fresh);
    expect(texts()).toContain(teacher.privacy.title);
    await pressBack();
    expect(leave).toHaveBeenCalledTimes(2);
    expect(fresh.opened).toBe(false);
  });

  it('opens on the reader’s home once a statement is kept, and on the notice until then', async () => {
    await unlock(passphraseStorage(PASSPHRASE));
    expect(has('privacy-accept')).toBe(true);
    expect(has('reader-home')).toBe(false);
    await unmount();
    await unlock(await storageWithStatement());
    expect(has('privacy-accept')).toBe(false);
    expect(has('reader-home')).toBe(true);
    expect(has('reader-picture-empty')).toBe(false);
  });

  it('leaves from the lock page too, and offers a crash report kept before the last stop', async () => {
    const storage = await storageWithStatement();
    await show(<ReaderApp onLeave={leave} storage={storage.asSpec()} />);
    expect(texts()).toContain(teacher.lock.web.title);
    await press('reader-leave');
    expect(leave).toHaveBeenCalledTimes(1);
    await unmount();
    fakeCrash.on = true;
    fakeCrash.report = JSON.stringify({
      type: 'TypeError',
      frames: ['made 1:2'],
      steps: [],
      version: '0',
      android: '',
    });
    await unlock(storage);
    expect(has('crash-sheet')).toBe(true);
  });
});
