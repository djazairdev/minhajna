// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Leaving reader mode when something goes wrong, and what the dashboard says
// after it (answer 856): a lock the storage module refuses keeps reader mode
// and locks through the shell; changes that did not save keep it too, and say
// so; the navigator leaves the browser's tab its name; and a tab that has
// just erased this PC says so on the home. Every passphrase, key and
// statement is made up.

import { NavigationContainer } from '@react-navigation/native';
import { Platform } from 'react-native';
import { browserState, resetBrowser } from '../../android/jest/fake-browser';
import * as AppData from '../../android/src/storage/AppData';
import teacher from '../../android/src/text/ar.json';
import { FakeDirectory } from '../jest/fake-directory';
import {
  PASSPHRASE,
  has,
  passphraseStorage,
  press,
  pressBack,
  rendered,
  show,
  storageWithStatement,
  texts,
  unlock,
  unmount,
} from '../jest/reader-page';
import { DashboardApp } from '../src/DashboardApp';
import words from '../src/text/ar.json';

jest.mock('../../android/src/lock/CreatePin', () => jest.requireActual<object>('../../android/src/lock/CreatePin.web'));
jest.mock('../../android/src/lock/Unlock', () => jest.requireActual<object>('../../android/src/lock/Unlock.web'));
jest.mock('../../android/src/lock/LockPin', () => jest.requireActual<object>('../../android/src/lock/LockPin.web'));
jest.mock('../../android/src/native/NativeMinhajnaBrowser', () =>
  jest.requireActual<object>('../../android/jest/fake-browser'),
);
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const leave = jest.fn();

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  leave.mockClear();
  resetBrowser();
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

describe('leaving reader mode', () => {
  it('stays when the lock is refused, and locks through the shell instead', async () => {
    const storage = await storageWithStatement();
    const lockHistory = jest.spyOn(storage, 'lockHistory').mockRejectedValueOnce(new Error('A made-up refusal'));
    await unlock(storage, leave);
    expect(has('reader-home')).toBe(true);
    await press('reader-leave');
    expect(leave).not.toHaveBeenCalled();
    expect(lockHistory).toHaveBeenCalledTimes(2);
    expect(storage.opened).toBe(false);
    expect(texts()).toContain(teacher.lock.web.title);
    await press('reader-leave');
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('stays, and says so, when the last changes did not save, from the home and the first notice', async () => {
    const real = AppData.useAppData;
    jest.spyOn(AppData, 'useAppData').mockImplementation(() => ({ ...real(), allSaved: () => Promise.resolve(false) }));
    const storage = await storageWithStatement();
    await unlock(storage, leave);
    await press('reader-leave');
    expect(leave).not.toHaveBeenCalled();
    expect(storage.opened).toBe(true);
    expect(has('reader-leave-failed')).toBe(true);
    await unmount();
    jest
      .spyOn(AppData, 'useAppData')
      .mockImplementation(() => ({ ...real(), allSaved: () => Promise.reject(new Error('A made-up failure')) }));
    await unlock(passphraseStorage(PASSPHRASE), leave);
    expect(has('privacy-accept')).toBe(true);
    await pressBack();
    expect(leave).not.toHaveBeenCalled();
    expect(has('reader-leave-failed')).toBe(true);
  });

  it('leaves the browser’s tab its name', async () => {
    await unlock(await storageWithStatement(), leave);
    const container = rendered().root.findByType(NavigationContainer);
    expect(container.props.documentTitle).toEqual({ enabled: false });
  });
});

describe('after erasing this PC', () => {
  it('says so on the home of the tab that erased it, and only there', async () => {
    new FakeDirectory().install();
    await show(<DashboardApp />);
    expect(has('dashboard-erased')).toBe(false);
    await unmount();
    browserState.erased = true;
    await show(<DashboardApp />);
    expect(has('dashboard-erased')).toBe(true);
    expect(texts()).toEqual(expect.arrayContaining([words.reader.erasedTitle, words.reader.erased]));
    expect(texts()).not.toContain(teacher.welcome.erased.title);
  });
});
