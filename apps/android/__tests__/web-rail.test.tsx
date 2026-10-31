// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's rail (#251, answers 524 and 525): on a PC the home tabs are a rail
// with the app's name, the schools, the tabs and the current one, and Settings,
// with no bottom bar, Classes named as on the board; a tab and Settings open
// from it; «قفل الآن» locks at once, shown only where App gives the lock; its
// foot says where the copy here came from, last, and nothing on a fresh PC; a
// restored history is not recorded again; the phone keeps its bottom bar; the log names
// a restored copy's route; and every new text is in French and English. Made-up
// records.

import { activityLog, parseDay, type LogLine } from '@minhajna/core';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Platform } from 'react-native';
import { mount, press, root, texts, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import { ClassesTab } from '../src/classes/ClassesTab';
import { LockAway } from '../src/lock/lock-away';
import { lineText } from '../src/log/log-text';
import { HomeTabs } from '../src/navigation/HomeTabs';
import { HomeTabBar } from '../src/navigation/NavigationChrome';
import settings from '../src/settings/text/ar.json';
import text from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { i18n } from '../src/text/i18n';
import { dayAndMonth } from '../src/today/DayMark';

jest.mock('../src/navigation/RecordScreens', () => ({ TodayTab: () => null, ClassesTabScreen: () => null }));
jest.mock('../src/navigation/DocumentScreens', () => ({ DocumentsTabScreen: () => null }));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});
afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

const DAY = parseDay('2026-10-20');
const navigate = jest.fn();

/** The home tab bar's props, with Today current. */
function bar(): BottomTabBarProps {
  const routes = (['Today', 'Classes', 'Documents'] as const).map((name) => ({ key: `${name}-k`, name }));
  return {
    state: { index: 0, routes },
    descriptors: Object.fromEntries(
      routes.map((route) => [route.key, { options: { title: text.navigation[route.name.toLowerCase() as 'today'] } }]),
    ),
    navigation: { emit: () => ({ defaultPrevented: false }), navigate },
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as BottomTabBarProps;
}

const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
const selected = (testID: string) =>
  root().findAll((node) => node.props.testID === testID && node.props['aria-selected'] !== undefined)[0]?.props[
    'aria-selected'
  ] as boolean | undefined;

test('on a PC the home tabs are a rail with the schools, the current tab and Settings', async () => {
  const data = await withPupils();
  await mount(data, <HomeTabBar {...bar()} />);
  expect(has('side-rail')).toBe(true);
  expect(has('tab-Today')).toBe(false);
  const schools = [...data.book.state.schools.values()].map((school) => school.name).join(' · ');
  expect(texts()).toEqual(
    expect.arrayContaining([
      text.name,
      schools,
      text.navigation.today,
      text.navigation.classes,
      text.navigation.documents,
      settings.title,
    ]),
  );
  expect(selected('rail-Today')).toBe(true);
  expect(selected('rail-Classes')).toBe(false);
  expect(has('rail-copy')).toBe(false);
  expect(has('rail-lock')).toBe(false);
});

test('the home tabs and the Classes page on a PC name Classes as on the board', async () => {
  await mount(
    await withPupils(),
    <NavigationContainer>
      <HomeTabs />
    </NavigationContainer>,
  );
  expect(texts()).toEqual(expect.arrayContaining([text.navigation.today, text.navigation.pc.classes]));
  expect(texts()).not.toContain(text.navigation.classes);
  expect(selected('rail-Today')).toBe(true);
  await unmount();
  await mount(
    await withPupils(),
    <ClassesTab onClass={jest.fn()} onBook={jest.fn()} onWeek={jest.fn()} onDigest={jest.fn()} />,
  );
  expect(texts()).toContain(text.navigation.pc.classes);
});

test('a tab and Settings open from the rail, and Lock now locks at once', async () => {
  const lock = jest.fn();
  await mount(
    await withPupils(),
    <LockAway.Provider value={lock}>
      <HomeTabBar {...bar()} />
    </LockAway.Provider>,
  );
  await press('rail-Classes');
  expect(navigate).toHaveBeenLastCalledWith('Classes', undefined);
  await press('rail-Settings');
  expect(navigate).toHaveBeenLastCalledWith('Settings');
  expect(texts()).toContain(text.shell.lockNow);
  await press('rail-lock');
  expect(lock).toHaveBeenCalledTimes(1);
});

test('the foot says where the copy came from, last', async () => {
  const data = await withPupils();
  await data.book.record(DAY, { kind: 'copy.received', received: { from: 'backup' } });
  await mount(data, <HomeTabBar {...bar()} />);
  expect(texts()).toContain(i18n.t('shell.from.backup', { day: dayAndMonth(DAY, 'ar', data.profile) }));
  await unmount();
  const back = parseDay('2026-10-22');
  await data.book.record(back, { kind: 'handover.ended', handover: { how: 'back' } });
  await mount(data, <HomeTabBar {...bar()} />);
  expect(texts()).toContain(i18n.t('shell.from.back', { day: dayAndMonth(back, 'ar', data.profile) }));
});

test('opening a restored history does not record its receipt again', async () => {
  const data = await withPupils();
  await data.book.record(DAY, { kind: 'copy.received', received: { from: 'phone' } });
  await mount(data, <HomeTabBar {...bar()} />);
  await unmount();
  await mount(data, <HomeTabBar {...bar()} />);
  const kept = data.book.entries.filter((entry) => entry.kind === 'copy.received');
  expect(kept.map((entry) => [entry.layer, entry.content?.body])).toEqual([
    ['device', { kind: 'copy.received', received: { from: 'phone' } }],
  ]);
});

test('the phone keeps its bottom bar', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  await mount(await withPupils(), <HomeTabBar {...bar()} />);
  expect(has('tab-Today')).toBe(true);
  expect(has('side-rail')).toBe(false);
});

test("the log names a restored copy's route", async () => {
  const data = await withPupils();
  await data.book.record(DAY, { kind: 'copy.received', received: { from: 'archive' } });
  const day = activityLog(data.book.entries).find((one) => one.day === DAY);
  const line = day?.items[0]?.line as LogLine;
  const names = { state: data.book.state, profile: data.profile, lang: 'ar' } as const;
  expect(lineText(i18n.t, names, line)).toBe(text.log.copyReceived.archive);
});

test('every new text is in French and English', () => {
  for (const other of [fr, en]) {
    expect(Object.keys(other.shell.from)).toEqual(Object.keys(text.shell.from));
    expect(Object.keys(other.log.copyReceived)).toEqual(Object.keys(text.log.copyReceived));
    for (const [key, value] of Object.entries(other.shell.from)) {
      expect(value).not.toBe(text.shell.from[key as keyof typeof text.shell.from]);
      expect(value).toContain('{{day}}');
    }
    expect(other.shell.lockNow).not.toBe(text.shell.lockNow);
  }
});
