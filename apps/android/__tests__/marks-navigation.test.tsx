// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Marks routes (#238, answers 431 and 436): the Class page's row opens
// the hub on today's term, whose setup row opens the setup for it; Back with
// a draft asks first, staying keeps it and leaving drops it; a save goes back
// to the hub, which says the setup is now the teacher's. A test's row opens
// its entry (#239), whose «تم» goes back to the hub with the marks counted.
// Made-up records only.

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { Alert, type AlertButton } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { withTest } from '../jest/marks-class';
import { withDay } from '../jest/today-day';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { AppNavigator } from '../src/navigation/AppNavigator';
import { TopBar } from '../src/navigation/NavigationChrome';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

const header = () => settingsRoot().findAllByType(TopBar).at(-1)!.props as NativeStackHeaderProps;

async function back() {
  await ReactTestRenderer.act(async () => {
    header().navigation.goBack();
    await Promise.resolve();
  });
}

async function choose(button: AlertButton | undefined) {
  await ReactTestRenderer.act(async () => {
    button?.onPress?.();
    await Promise.resolve();
  });
}

test('the hub opens the setup, Back with a draft asks first, and a save goes back to the hub', async () => {
  const data = await withDay();
  const alert = jest.spyOn(Alert, 'alert');
  await showSettingsScreen(<AppNavigator initialRouteName="Home" direction="rtl" />, data);
  await pressSettings('tab-Classes');
  await pressSettings('classes-c-1-class');
  await pressSettings('class-marks');
  expect([header().route.name, header().route.params]).toEqual(['Marks', { courseId: 'c-1' }]);
  await pressSettings('marks-setup');
  expect([header().route.name, header().route.params]).toEqual(['MarksSetup', { courseId: 'c-1', term: 1 }]);
  await back();
  expect(alert).not.toHaveBeenCalled();
  expect(header().route.name).toBe('Marks');

  await pressSettings('marks-setup');
  await pressSettings('setup-points-participation-decrease');
  await back();
  expect(alert.mock.calls[0]?.[0]).toBe(text.marks.leave);
  await choose(alert.mock.calls[0]?.[2]?.[0]);
  expect(header().route.name).toBe('MarksSetup');
  await back();
  await choose(alert.mock.calls[1]?.[2]?.[1]);
  expect(header().route.name).toBe('Marks');
  expect(data.book.state.assessment.size).toBe(0);

  await pressSettings('marks-setup');
  await pressSettings('setup-points-participation-decrease');
  await pressSettings('setup-points-research-increase');
  await pressSettings('setup-save');
  expect(header().route.name).toBe('Marks');
  expect(alert).toHaveBeenCalledTimes(2);
  expect(data.book.state.assessment.get('c-1')).toHaveLength(1);
  expect(settingsTexts()).toContain('6 عناصر على 20 · إعدادك منذ الفصل الأول');
});

test('a test’s row opens its entry, and «تم» goes back to the hub', async () => {
  const data = await withTest();
  await showSettingsScreen(<AppNavigator initialRouteName="Home" direction="rtl" />, data);
  await pressSettings('tab-Classes');
  await pressSettings('classes-c-1-class');
  await pressSettings('class-marks');
  await pressSettings('marks-test-t-1');
  expect([header().route.name, header().route.params]).toEqual([
    'MarksEntry',
    { courseId: 'c-1', term: 1, testId: 't-1' },
  ]);
  await pressSettings('entry-absent');
  await back();
  expect(header().route.name).toBe('Marks');
  expect(settingsTexts()).toContain('الأحد 8 نوفمبر · 1 من 3');
  await pressSettings('marks-exam');
  expect(header().route.params).toEqual({ courseId: 'c-1', term: 1 });
  for (const id of ['entry-next', 'entry-next', 'entry-next', 'entry-done']) await pressSettings(id);
  expect(header().route.name).toBe('Marks');
});
