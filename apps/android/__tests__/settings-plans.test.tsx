// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { settingsData } from '../jest/settings-data';
import { closeSettingsScreen, settingsRoot, settingsTexts, showSettingsScreen } from '../jest/settings-screen';
import { Plans } from '../src/settings/Plans';
import { catalogues, i18n } from '../src/text/i18n';
import { accessibilityProblems } from '../jest/accessibility';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test('shows each school’s real pins and missing releases, not the newest installed pack', async () => {
  const data = await settingsData();
  await showSettingsScreen(<Plans onRelease={jest.fn()} />, data);
  expect(settingsTexts()).toContain('متوسطة الأمل (مثال)');
  expect(settingsTexts()).toContain(catalogues.ar.plan.status.example);
  expect(settingsTexts().some((text) => text.includes('2025.9'))).toBe(true);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(settingsRoot().findAll((node) => String(node.props.testID).startsWith('settings-choose-'))).toEqual([]);
});

test('a school-specific plan page does not include the other school’s classes', async () => {
  await showSettingsScreen(<Plans schoolId="s-2" onRelease={jest.fn()} />, await settingsData());
  expect(settingsTexts()).not.toContain('متوسطة النجاح');
  expect(settingsRoot().findAllByProps({ testID: 'settings-plans-s-1' })).toHaveLength(0);
});
