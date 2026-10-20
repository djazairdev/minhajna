// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import ReactTestRenderer from 'react-test-renderer';
import { calendarData } from '../jest/calendar-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { TopBar } from '../src/navigation/NavigationChrome';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

test('adds through the calendar, opens the saved entry, edits its same ID and cancels back to the calendar', async () => {
  const data = await calendarData();
  await showSettingsScreen(<AppNavigator initialRouteName="Home" direction="rtl" />, data);
  await pressSettings('today-settings');
  await pressSettings('settings-calendar');
  await pressSettings('calendar-add');
  expect(header().route.name).toBe('CalendarEdit');
  await typeSettings('calendar-source', 'إعلان تجريبي جديد');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(header().route.name).toBe('CalendarEntry');
  const id = data.book.state.calendar.find((entry) => entry.source === 'إعلان تجريبي جديد')!.id;
  expect(header().route.params).toEqual({ id, origin: 'local', schoolId: 's-1' });
  await pressSettings('calendar-edit');
  expect(header().route.name).toBe('CalendarEdit');
  await typeSettings('calendar-source', 'تصحيح تجريبي');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(header().route.name).toBe('CalendarEntry');
  expect(data.book.state.calendar.find((entry) => entry.id === id)?.source).toBe('تصحيح تجريبي');
  await pressSettings('calendar-cancel');
  await pressSettings('calendar-confirm-cancel');
  expect(header().route.name).toBe('Calendar');
  expect(data.book.state.calendar.some((entry) => entry.id === id)).toBe(false);
});

test.each([
  ['school-1', 's-2'],
  ['same-id', 's-1'],
  ['missing', 's-1'],
  ['school-1', 'missing'],
] as const)(
  'denies an editor route that does not resolve an editable scoped local entry (%s, %s)',
  async (id, schoolId) => {
    const data = await calendarData();
    const before = [...data.book.entries];
    await showSettingsScreen(<AppNavigator initialRouteName="Home" direction="rtl" />, data);
    await pressSettings('today-settings');
    await ReactTestRenderer.act(() => header().navigation.navigate('CalendarEdit', { id, schoolId }));
    expect(settingsTexts()).toContain(i18n.t('calendarView.edit.readOnly'));
    expect(settingsRoot().findAll((node) => node.props.testID === 'calendar-preview')).toEqual([]);
    expect(data.book.entries).toEqual(before);
  },
);
const header = () => settingsRoot().findAllByType(TopBar).at(-1)!.props as NativeStackHeaderProps;
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'en'] as const)(
  'opens through Settings and keeps school and layer choices on Back (%s)',
  async (language) => {
    const data = await calendarData();
    const before = [...data.book.entries];
    await showSettingsScreen(
      <AppNavigator initialRouteName="Home" direction={language === 'ar' ? 'rtl' : 'ltr'} />,
      data,
      language,
    );
    await pressSettings('today-settings');
    await pressSettings('settings-calendar');
    expect(header().route.name).toBe('Calendar');
    await pressSettings('calendar-school-s-2');
    await pressSettings('calendar-layer-school');
    await pressSettings('calendar-entry-local-school-2');
    expect(header().route.name).toBe('CalendarEntry');
    expect(header().route.params).toEqual({ id: 'school-2', origin: 'local', schoolId: 's-2' });
    await ReactTestRenderer.act(() => header().navigation.goBack());
    expect(header().route.name).toBe('Calendar');
    expect(settingsControl('calendar-school-s-2').accessibilityState?.checked).toBe(true);
    expect(settingsControl('calendar-layer-school').accessibilityState?.checked).toBe(true);
    await ReactTestRenderer.act(() => header().navigation.goBack());
    expect(header().route.name).toBe('Settings');
    expect(data.book.entries).toEqual(before);
  },
);
