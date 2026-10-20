// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { parseDay } from '@minhajna/core';
import ReactTestRenderer from 'react-test-renderer';
import { noticeData } from '../jest/calendar-notice-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { calendarInput as NativeInput } from '../jest/calendar-input';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { TopBar } from '../src/navigation/NavigationChrome';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
const header = () => settingsRoot().findAllByType(TopBar).at(-1)!.props as NativeStackHeaderProps;
beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'en'] as const)(
  'receives a closure from Calendar, keeps it read-only and allows withdrawal (%s)',
  async (language) => {
    const data = await withDay();
    jest.mocked(NativeInput.readFile).mockResolvedValueOnce(JSON.stringify(noticeData()));
    await showSettingsScreen(
      <AppNavigator initialRouteName="Home" direction={language === 'ar' ? 'rtl' : 'ltr'} />,
      data,
      language,
    );
    await pressSettings('today-settings');
    await pressSettings('settings-calendar');
    await pressSettings('calendar-receive');
    expect(header().route.name).toBe('CalendarReceive');
    const before = [...data.book.entries];
    await pressSettings('calendar-receive-ignore');
    expect(header().route.name).toBe('Calendar');
    expect(data.book.entries).toEqual(before);
    await pressSettings('calendar-receive');
    await pressSettings('calendar-receive-file');
    await pressSettings('calendar-receive-acknowledge');
    await pressSettings('calendar-receive-preview');
    await pressSettings('calendar-receive-save');
    expect(header().route.name).toBe('CalendarEntry');
    expect(header().route.params).toEqual({ id: noticeData().entry.id, origin: 'local', schoolId: 's-1' });
    expect(settingsRoot().findAll((node) => node.props.testID === 'calendar-edit')).toEqual([]);
    expect(settingsTexts()).toContain(i18n.t('calendarView.receive.received'));
    await pressSettings('calendar-cancel');
    await pressSettings('calendar-confirm-cancel');
    expect(header().route.name).toBe('Calendar');
    expect(data.book.state.calendar).toHaveLength(0);
    expect(data.book.entries).toHaveLength(before.length + 2);
  },
);

test('a missing school cannot open a receiving route', async () => {
  const data = await withDay();
  const before = [...data.book.entries];
  await showSettingsScreen(<AppNavigator initialRouteName="Home" direction="rtl" />, data);
  await pressSettings('today-settings');
  await ReactTestRenderer.act(() => header().navigation.navigate('CalendarReceive', { schoolId: 'missing' }));
  expect(settingsTexts()).toContain(i18n.t('calendarView.edit.readOnly'));
  expect(NativeInput.readFile).not.toHaveBeenCalled();
  expect(NativeInput.scanQr).not.toHaveBeenCalled();
  expect(data.book.entries).toEqual(before);
});

test('saving opens details in the school selected during review, not the initial route school', async () => {
  const data = await withDay();
  const school = data.book.state.schools.get('s-1')!;
  const schoolClass = data.book.state.classes.get('k-1')!;
  await data.book.recordAll(parseDay('2026-10-15'), [
    { kind: 'school.set', school: { ...school, id: 's-2', name: 'متوسطة أخرى تجريبية', zone: '31' } },
    { kind: 'class.set', schoolClass: { ...schoolClass, id: 'second-class', schoolId: 's-2' } },
  ]);
  const notice = noticeData();
  notice.school = { name: 'متوسطة أخرى تجريبية', zone: '31' };
  jest.mocked(NativeInput.readFile).mockResolvedValueOnce(JSON.stringify(notice));
  await showSettingsScreen(<AppNavigator initialRouteName="Home" direction="rtl" />, data);
  await pressSettings('today-settings');
  await pressSettings('settings-calendar');
  await pressSettings('calendar-receive');
  expect(header().route.params).toEqual({ schoolId: 's-1' });
  await pressSettings('calendar-receive-file');
  await pressSettings('calendar-receive-school-s-2');
  await pressSettings('calendar-receive-acknowledge');
  await pressSettings('calendar-receive-preview');
  await pressSettings('calendar-receive-save');
  expect(header().route.params).toEqual({ id: notice.entry.id, origin: 'local', schoolId: 's-2' });
  expect(settingsTexts()).toContain(notice.entry.name.ar);
  expect(data.book.state.calendar[0].schoolId).toBe('s-2');
});
