// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import ReactTestRenderer from 'react-test-renderer';
import { groupsData } from '../jest/calendar-groups-data';
import {
  closeSettingsScreen,
  pressSettings,
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
const header = () => settingsRoot().findAllByType(TopBar).at(-1)!.props as NativeStackHeaderProps;
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)(
  'opens, creates, edits and withdraws a rotation through the navigator (%s)',
  async (language) => {
    const data = await groupsData();
    await showSettingsScreen(
      <AppNavigator initialRouteName="Home" direction={language === 'ar' ? 'rtl' : 'ltr'} />,
      data,
      language,
    );
    await pressSettings('today-settings');
    await pressSettings('settings-calendar');
    await pressSettings('calendar-groups');
    expect(header().route.name).toBe('CalendarGroups');
    await pressSettings('rotation-confirm-split');
    await typeSettings('calendar-source', 'إعلان تجريبي');
    await pressSettings('calendar-preview');
    await pressSettings('calendar-save');
    expect(header().route.name).toBe('CalendarEntry');
    const id = data.book.state.calendar[0].id;
    await pressSettings('calendar-edit');
    expect(header().route.name).toBe('CalendarEdit');
    await pressSettings('rotation-confirm-split');
    await pressSettings('rotation-order-reverse');
    await pressSettings('calendar-preview');
    await pressSettings('calendar-save');
    expect(data.book.state.calendar).toHaveLength(1);
    expect(data.book.state.calendar[0].id).toBe(id);
    await pressSettings('calendar-cancel');
    await pressSettings('calendar-confirm-cancel');
    expect(header().route.name).toBe('Calendar');
  },
);

test('an unknown school cannot open a usable rotation editor', async () => {
  const data = await groupsData();
  const before = [...data.book.entries];
  await showSettingsScreen(<AppNavigator initialRouteName="Home" direction="rtl" />, data);
  await pressSettings('today-settings');
  await ReactTestRenderer.act(() => header().navigation.navigate('CalendarGroups', { schoolId: 'missing' }));
  expect(settingsTexts()).toContain(i18n.t('calendarView.edit.readOnly'));
  expect(data.book.entries).toEqual(before);
});
