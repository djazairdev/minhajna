// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The notifications set ahead (#234, answers 403, 405, 406 and 482): the
// digest's fixed words and the preview's sessions, «غداً» the evening before
// and «اليوم» that morning after a quiet evening; the backup reminder at 18:00
// on its day; planned again once setup is done and when the choices change; the
// permission asked once, also for the reminder alone; a tapped notification
// opening the digest, also while the app is open; and the Notif screen's notice
// when Android does not let the app notify, which asks again or opens its
// settings. Made-up data only.

import { parseDay, type RecordEvent } from '@minhajna/core';
import { DeviceEventEmitter, PermissionsAndroid, Platform } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { withData, type TestData } from '../jest/app-data';
import { fakeNotify } from '../jest/fake-notify';
import { closeSettingsScreen, pressSettings, settingsRoot, showSettingsScreen } from '../jest/settings-screen';
import { repaceContext } from '../jest/repace-data';
import { withDay } from '../jest/today-day';
import face from '../src/native/NativeMinhajnaInterface';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { epochOf, notifyItems } from '../src/notify/notify-items';
import { Notify } from '../src/settings/Notify';
import { setBackupLater } from '../src/settings/backup-later';
import { setNotifyPrefs } from '../src/settings/notify-prefs';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const iso = (value: string) => `\u2068${value}\u2069`;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await closeSettingsScreen();
  setNotifyPrefs({ digest: true, preview: false, saturday: false, backup: true });
  setBackupLater(null);
  Object.assign(fakeNotify, { planned: [], plans: 0, allowed: true, settingsOpened: 0, opened: null });
  face.setSetting('notify-asked', 'false');
  jest.restoreAllMocks();
  await i18n.changeLanguage('ar');
});

/** The demo day, set up, with 4م1 also taught on Sunday's first morning slot. */
async function setUp(): Promise<TestData> {
  const data = await withDay();
  const version = data.book.state.timetables[0]?.version;
  if (version === undefined) throw new Error('No week');
  const sunday = { ...version.entries[0], id: 'e-9', weekday: 0 as const };
  const events: RecordEvent[] = [
    { kind: 'timetable.set', version: { ...version, entries: [...version.entries, sunday] } },
    { kind: 'setup.finished' },
  ];
  await data.book.recordAll(parseDay('2026-10-14'), events);
  return data;
}

async function mount(data: TestData, today = '2026-10-14') {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(withData(data, <AppNavigator initialRouteName="Home" />, today));
  });
}

const settle = () => ReactTestRenderer.act(() => new Promise<void>((done) => setTimeout(done, 1100)));
const now = { day: parseDay('2026-10-14'), minutes: 10 * 60 };

test('the digest says only that it is ready, and a preview gives the day’s sessions', async () => {
  const data = await setUp();
  const t = i18n.t.bind(i18n);
  const items = notifyItems(t, repaceContext(data), { ...data, state: data.book.state }, now, {
    digest: true,
    preview: true,
    saturday: false,
  });
  const thursday = items.find((one) => one.id === 'preview-2026-10-15');
  expect(thursday?.at).toBe(epochOf({ day: parseDay('2026-10-14'), minutes: 19 * 60 }));
  const words = (count: number) => ({
    sessions: i18n.t('count.sessions', { count }),
    time: iso('08:00'),
    class: iso('4م1'),
  });
  expect(thursday?.text).toBe(i18n.t('notify.tomorrow', words(3)));
  const sunday = items.find((one) => one.id === 'preview-2026-10-18');
  expect(sunday?.at).toBe(epochOf({ day: parseDay('2026-10-18'), minutes: 7 * 60 }));
  expect(sunday?.text).toBe(i18n.t('notify.today', words(1)));
  expect(items.find((one) => one.id === 'digest-2026-10-18')).toEqual({
    id: 'digest-2026-10-18',
    at: epochOf({ day: parseDay('2026-10-18'), minutes: 7 * 60 }),
    channel: 'digest',
    channelName: i18n.t('digest.title'),
    title: i18n.t('digest.title'),
    text: i18n.t('notify.digestText'),
    open: 'digest',
  });
  expect(new Set(items.map((one) => one.open))).toEqual(new Set(['digest', 'today']));
});

test('notifications are planned once setup is done, and again when the choices change', async () => {
  await mount(await setUp());
  await settle();
  expect(fakeNotify.planned.map((one) => one.id)).toEqual(['digest-2026-10-18', 'digest-2026-10-25']);
  await ReactTestRenderer.act(() => setNotifyPrefs({ digest: false }));
  await settle();
  expect(fakeNotify.planned).toEqual([]);
});

test('the backup reminder is planned at 18:00 on its day, with its own words, and not once turned off', async () => {
  await mount(await setUp(), '2026-11-05');
  await settle();
  const backups = () => fakeNotify.planned.filter((one) => one.channel === 'backup');
  expect(backups().map((one) => one.at)).toEqual([epochOf({ day: parseDay('2026-11-15'), minutes: 7 * 60 })]);
  await ReactTestRenderer.act(() => setBackupLater(parseDay('2026-11-17')));
  await settle();
  expect(backups()).toEqual([
    {
      id: 'backup-2026-11-17',
      at: epochOf({ day: parseDay('2026-11-17'), minutes: 18 * 60 }),
      channel: 'backup',
      channelName: i18n.t('settings.notify.backup'),
      title: i18n.t('notify.backupTitle'),
      text: i18n.t('notify.backupText'),
      open: 'today',
    },
  ]);
  await ReactTestRenderer.act(() => setNotifyPrefs({ backup: false }));
  await settle();
  expect(fakeNotify.planned.map((one) => one.channel)).not.toContain('backup');
});

test('nothing is planned before setup is done', async () => {
  await mount(await withDay());
  await settle();
  expect(fakeNotify.plans).toBe(0);
});

test('Android 13 and later ask for the permission once', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);
  const ask = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  const data = await setUp();
  await mount(data);
  await ReactTestRenderer.act(() => tree?.unmount());
  await mount(data);
  expect(ask).toHaveBeenCalledTimes(1);
  expect(ask).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
});

test('the permission is asked also when the backup reminder is the only notification on', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);
  const ask = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  setNotifyPrefs({ digest: false });
  await mount(await setUp());
  expect(ask).toHaveBeenCalledTimes(1);
});

test('a tapped digest notification opens the digest, once', async () => {
  fakeNotify.opened = 'digest';
  await mount(await setUp());
  expect(tree?.root.findAll((node) => node.props.testID === 'digest-range').length).toBeGreaterThan(0);
  expect(fakeNotify.opened).toBeNull();
});

test('a tap that reaches the app while it is open opens the digest', async () => {
  await mount(await setUp());
  expect(tree?.root.findAll((node) => node.props.testID === 'digest-range')).toEqual([]);
  fakeNotify.opened = 'digest';
  await ReactTestRenderer.act(() => {
    DeviceEventEmitter.emit('minhajnaNotifyOpened');
  });
  expect(tree?.root.findAll((node) => node.props.testID === 'digest-range').length).toBeGreaterThan(0);
});

test('on Android 13, a permission granted from the notice opens no settings', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);
  fakeNotify.allowed = false;
  jest.spyOn(PermissionsAndroid, 'request').mockImplementation(() => {
    fakeNotify.allowed = true;
    return Promise.resolve(PermissionsAndroid.RESULTS.GRANTED);
  });
  face.setSetting('notify-asked', 'true');
  await showSettingsScreen(<Notify />, await setUp());
  await pressSettings('notify-allow');
  expect(fakeNotify.settingsOpened).toBe(0);
  expect(settingsRoot().findAll((node) => node.props.testID === 'notify-off')).toEqual([]);
});

test('the Notif screen says when Android does not let the app notify, and opens its settings', async () => {
  fakeNotify.allowed = false;
  await showSettingsScreen(<Notify />, await setUp());
  expect(settingsRoot().findAll((node) => node.props.testID === 'notify-off').length).toBeGreaterThan(0);
  await pressSettings('notify-allow');
  expect(fakeNotify.settingsOpened).toBe(1);
  await ReactTestRenderer.act(() => setNotifyPrefs({ digest: false }));
  expect(settingsRoot().findAll((node) => node.props.testID === 'notify-off').length).toBeGreaterThan(0);
  await ReactTestRenderer.act(() => setNotifyPrefs({ backup: false }));
  expect(settingsRoot().findAll((node) => node.props.testID === 'notify-off')).toEqual([]);
});
