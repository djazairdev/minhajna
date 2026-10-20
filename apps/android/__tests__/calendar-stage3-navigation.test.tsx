// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import ReactTestRenderer from 'react-test-renderer';
import { calendarEntry } from '../jest/calendar-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
  typeSettings,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { TopBar } from '../src/navigation/NavigationChrome';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
const header = () => settingsRoot().findAllByType(TopBar).at(-1)!.props as NativeStackHeaderProps;
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'en'] as const)(
  'confirms a bundled lunar entry, replaces its details with the local confirmation, and withdraws back to Calendar (%s)',
  async (language) => {
    const data = {
      ...(await withDay()),
      calendar: [calendarEntry('lunar', { lunar: true, effect: 'no-school', confidence: 'expected' })],
    };
    await showSettingsScreen(
      <AppNavigator initialRouteName="Home" direction={language === 'ar' ? 'rtl' : 'ltr'} />,
      data,
      language,
    );
    await pressSettings('today-settings');
    await pressSettings('settings-calendar');
    await pressSettings('calendar-entry-bundled-lunar');
    await pressSettings('calendar-lunar');
    expect(header().route.name).toBe('CalendarLunar');
    await typeSettings('calendar-source', 'إعلان رؤية تجريبي');
    await pressSettings('calendar-preview');
    await pressSettings('calendar-save');
    expect(header().route.name).toBe('CalendarEntry');
    expect(header().route.params).toEqual({ id: 'lunar', origin: 'local', schoolId: 's-1' });
    await pressSettings('calendar-edit');
    expect(header().route.name).toBe('CalendarEdit');
    await typeSettings('calendar-source', 'تصحيح إعلان تجريبي');
    await pressSettings('calendar-preview');
    await pressSettings('calendar-save');
    expect(header().route.name).toBe('CalendarEntry');
    expect(data.book.state.calendar).toHaveLength(1);
    await pressSettings('calendar-cancel');
    await pressSettings('calendar-confirm-cancel');
    expect(header().route.name).toBe('Calendar');
    expect(
      settingsRoot().findAll((node) => node.props.testID === 'calendar-entry-bundled-lunar').length,
    ).toBeGreaterThan(0);
  },
);

test('adds an A/B reset through its focused page, edits the same ID and cancels back to Calendar', async () => {
  const data = await withDay();
  await showSettingsScreen(<AppNavigator initialRouteName="Home" direction="rtl" />, data);
  await pressSettings('today-settings');
  await pressSettings('settings-calendar');
  await pressSettings('calendar-add');
  await pressSettings('calendar-kind-ab-reset');
  await pressSettings('calendar-add-reset');
  expect(header().route.name).toBe('CalendarAb');
  await typeSettings('calendar-source', 'ضبط أسبوع تجريبي');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  const id = data.book.state.calendar[0].id;
  expect(header().route.name).toBe('CalendarEntry');
  await pressSettings('calendar-edit');
  await typeSettings('calendar-source', 'تصحيح ضبط تجريبي');
  await pressSettings('calendar-preview');
  await pressSettings('calendar-save');
  expect(data.book.state.calendar[0].id).toBe(id);
  expect(data.book.state.calendar).toHaveLength(1);
  await pressSettings('calendar-cancel');
  await pressSettings('calendar-confirm-cancel');
  expect(header().route.name).toBe('Calendar');
});

test.each([
  ['unknown', 's-1'],
  ['expected-non-lunar', 's-1'],
  ['lunar', 'missing'],
] as const)('denies a lunar route without an eligible scoped reference (%s, %s)', async (id, schoolId) => {
  const data = {
    ...(await withDay()),
    calendar: [
      calendarEntry('expected-non-lunar', { confidence: 'expected', effect: 'no-school' }),
      calendarEntry('lunar', { lunar: true, effect: 'no-school', confidence: 'expected' }),
    ],
  };
  const before = [...data.book.entries];
  await showSettingsScreen(<AppNavigator initialRouteName="Home" direction="rtl" />, data);
  await pressSettings('today-settings');
  await ReactTestRenderer.act(() => header().navigation.navigate('CalendarLunar', { id, schoolId }));
  expect(settingsTexts()).toContain(i18n.t('calendarView.edit.readOnly'));
  expect(data.book.entries).toEqual(before);
});
