// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import ReactTestRenderer from 'react-test-renderer';
import { settingsData } from '../jest/settings-data';
import { closeSettingsScreen, pressSettings, settingsRoot, showSettingsScreen } from '../jest/settings-screen';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { TopBar } from '../src/navigation/NavigationChrome';
import { i18n } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

const header = () => settingsRoot().findAllByType(TopBar).at(-1)!.props as NativeStackHeaderProps;

async function back() {
  await ReactTestRenderer.act(() => header().navigation.goBack());
}

test.each(['ar', 'en'] as const)(
  'opens Settings from Today and returns there from each editor (%s)',
  async (language) => {
    const data = await settingsData();
    const before = [...data.book.entries];
    await showSettingsScreen(
      <AppNavigator initialRouteName="Home" direction={language === 'ar' ? 'rtl' : 'ltr'} />,
      data,
      language,
    );
    await pressSettings('today-settings');
    expect(header().route.name).toBe('Settings');
    const editors = [
      ['card', 'SettingsCard', 'card-next'],
      ['schools', 'SettingsSchools', 'setup-next'],
      ['classes', 'SettingsClasses', 'classes-next'],
      ['week', 'SettingsWeek', 'week-next'],
      ['language', 'Language', 'settings-language-save'],
    ];
    for (const [id, route, done] of editors) {
      await pressSettings(`settings-${id}`);
      expect(header().route.name).toBe(route);
      await pressSettings(done);
      expect(header().route.name).toBe('Settings');
    }
    for (const [id, route] of [
      ['lengths', 'SettingsLengths'],
      ['plans', 'SettingsPlans'],
      ['rules', 'RollRules'],
      ['security', 'Security'],
      ['times', 'Times'],
    ]) {
      await pressSettings(`settings-${id}`);
      expect(header().route.name).toBe(route);
      await back();
      expect(header().route.name).toBe('Settings');
    }
    expect(data.book.entries).toEqual(before);
    await back();
    expect(settingsRoot().findAllByType(TopBar)).toHaveLength(0);
  },
);

test('carries only school IDs through navigation and restricts the pack chooser to that school', async () => {
  await showSettingsScreen(<AppNavigator initialRouteName="Home" direction="rtl" />, await settingsData());
  await pressSettings('today-settings');
  await pressSettings('settings-school-times-s-2');
  expect(header().route.params).toEqual({ schoolId: 's-2' });
  await back();
  await pressSettings('settings-school-plans-s-2');
  await pressSettings('settings-choose-k-other-arabic-4am');
  expect(header().route.name).toBe('Packs');
  expect(header().route.params).toEqual({ grade: '4am', subject: 'arabic', schoolId: 's-2' });
  await pressSettings('pack-cancel');
  expect(header().route.name).toBe('SettingsPlans');
});
