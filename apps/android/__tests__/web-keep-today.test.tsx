// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a PC's screens say of the browser's offers once opened (#250,
// answers 511 and 512): Today warns each day that the browser may clear the
// data, before the 30-day reminder is due and whether it is on or off, and
// offers «نسخة احتياطية الآن» until a backup is saved that day; once the
// browser keeps the data, only the reminder, in the PC's words.
// «الأجهزة والنسخ» offers installing the app while the browser offers it.
// Made-up records only.

import { addDays } from '@minhajna/core';
import { Platform } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { browserState, resetBrowser } from '../jest/fake-browser';
import { withPupils } from '../jest/roll-class';
import { forgetKept } from '../src/lock/browser-offers';
import files from '../src/native/NativeMinhajnaFiles';
import { Devices } from '../src/settings/Devices';
import { setNotifyPrefs } from '../src/settings/notify-prefs';
import text from '../src/text/ar.json';
import settings from '../src/settings/text/ar.json';
import { TodayBackup } from '../src/today/TodayBackup';

jest.mock('../src/native/NativeMinhajnaBrowser', () => jest.requireActual<object>('../jest/fake-browser'));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const KEY = ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'].join('');
const saveFile = jest.spyOn(files, 'saveFile');

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  resetBrowser();
  forgetKept();
});
afterEach(async () => {
  await unmount();
  setNotifyPrefs({ backup: true });
  jest.clearAllMocks();
});

const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;

async function today(data: TestData, day = DAY) {
  const onSheet = jest.fn();
  await mount(data, <TodayBackup day={day} onSheet={onSheet} />, day);
  return onSheet;
}

test('Today warns each day the browser does not keep the data, even with the reminder off', async () => {
  setNotifyPrefs({ backup: false });
  const data = await withPupils();
  const onSheet = await today(data);
  expect(texts()).toEqual([
    text.lock.web.risk.title,
    text.lock.web.risk.why,
    text.lock.web.cleared,
    text.today.keep.now,
    text.today.keep.where,
  ]);
  expect(accessibilityProblems(root())).toEqual([]);
  await press('today-keep-now');
  expect(onSheet).toHaveBeenCalledTimes(1);
});

test('the backup is saved under the recovery key, and the warning says so for the rest of the day', async () => {
  const data = await withPupils();
  await data.book.record(DAY, { kind: 'recovery.set', recovery: { key: KEY } });
  await today(data);
  await press('today-keep-now');
  expect(saveFile).toHaveBeenCalledTimes(1);
  await unmount();
  await today(data);
  expect(has('today-keep-saved')).toBe(true);
  expect(has('today-keep-now')).toBe(false);
  await unmount();
  await today(data, addDays(DAY, 1));
  expect(has('today-keep-now')).toBe(true);
});

test('once the browser keeps the data, only the reminder shows, when due and in the PC’s words', async () => {
  browserState.kept = true;
  const data = await withPupils();
  await today(data);
  expect(has('today-keep')).toBe(false);
  expect(has('today-backup')).toBe(false);
  await unmount();
  await today(data, addDays(DAY, 30));
  expect(texts()).toEqual(expect.arrayContaining([text.today.backup.pc.none, text.today.backup.pc.body]));
});

test('the devices page offers installing while the browser does, and not once installed', async () => {
  const data = await withPupils();
  const element = <Devices onTransfer={jest.fn()} onSheet={jest.fn()} backupNow={false} onBackupStarted={jest.fn()} />;
  await mount(data, element);
  expect(texts()).toEqual(expect.arrayContaining([settings.devices.install, settings.devices.installLine]));
  await press('devices-install');
  expect(browserState.installs).toBe(1);
  expect(has('devices-install')).toBe(false);
  await unmount();
  await mount(data, element);
  expect(has('devices-install')).toBe(false);
});
