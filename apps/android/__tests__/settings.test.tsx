// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Text, useWindowDimensions, type TextProps } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { settingsData } from '../jest/settings-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsControl,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import NativeInterface from '../src/native/NativeMinhajnaInterface';
import { Settings } from '../src/settings/Settings';
import { countMinutes, setCountMinutes } from '../src/settings/preferences';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import { screenKind } from '../src/lock/screen-guard';
import arBase from '../src/text/ar.json';
import enBase from '../src/text/en.json';
import frBase from '../src/text/fr.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const onOpen = jest.fn();
beforeEach(() => {
  missingKeys.length = 0;
  onOpen.mockReset();
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
  setCountMinutes(false);
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  jest.restoreAllMocks();
});

test.each((['ar', 'fr', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale }))))(
  'names every control and lets text grow ($language, $fontScale×)',
  async ({ language, fontScale }) => {
    jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
    await showSettingsScreen(<Settings onOpen={onOpen} />, await settingsData(), language);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(settingsTexts()).toContain(catalogues[language].settings.rows.language);
    expect(missingKeys).toEqual([]);
    for (const node of settingsRoot().findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
    }
  },
);

test('opens existing screens and each school’s own bell times and packs', async () => {
  const data = await settingsData();
  const before = [...data.book.entries];
  await showSettingsScreen(<Settings onOpen={onOpen} />, data);
  for (const target of [
    'card',
    'schools',
    'classes',
    'week',
    'times',
    'lengths',
    'plans',
    'rules',
    'print',
    'security',
    'language',
    'help',
    'privacy',
  ]) {
    await pressSettings(`settings-${target}`);
    expect(onOpen).toHaveBeenLastCalledWith(target);
  }
  await pressSettings('settings-school-times-s-2');
  expect(onOpen).toHaveBeenLastCalledWith('times', 's-2');
  await pressSettings('settings-school-plans-s-1');
  expect(onOpen).toHaveBeenLastCalledWith('plans', 's-1');
  expect(data.book.entries).toEqual(before);
  expect(screenKind('SettingsClasses')).toBe('records');
});

test('does not offer insights, money or a pretend action for unfinished features', async () => {
  await showSettingsScreen(<Settings onOpen={onOpen} />, await settingsData());
  for (const target of ['calendar', 'updates', 'signature', 'notifications', 'backup', 'log', 'export', 'retention']) {
    expect(settingsControl(`settings-${target}`).accessibilityState?.disabled).toBe(true);
    await pressSettings(`settings-${target}`);
  }
  expect(onOpen).not.toHaveBeenCalled();
  expect(JSON.stringify(settingsTexts())).not.toMatch(/insights|donat|payment|تبرع|الإحصاءات المجهولة/i);
});

test('keeps the minutes display choice on this phone, outside the history', async () => {
  const data = await settingsData();
  const before = [...data.book.entries];
  await showSettingsScreen(<Settings onOpen={onOpen} />, data);
  expect(countMinutes()).toBe(false);
  await pressSettings('settings-minutes');
  expect(countMinutes()).toBe(true);
  await showSettingsScreen(<Settings onOpen={onOpen} />, data);
  expect(settingsControl('settings-minutes').accessibilityState?.checked).toBe(true);
  expect(data.book.entries).toEqual(before);
});

test('reports a failed preference write without showing the change as saved', async () => {
  await showSettingsScreen(<Settings onOpen={onOpen} />, await settingsData());
  jest.spyOn(NativeInterface, 'setSetting').mockImplementation(() => {
    throw new Error('Synthetic failure');
  });
  await pressSettings('settings-minutes');
  expect(countMinutes()).toBe(false);
  expect(settingsControl('settings-minutes').accessibilityState?.checked).toBe(false);
  expect(settingsTexts()).toContain(catalogues.ar.settings.failed);
});

test('damaged or future preference values do not turn minutes on', () => {
  NativeInterface.setSetting('count-minutes', 'unexpected');
  expect(countMinutes()).toBe(false);
});

test.each([
  ['ar', arBase],
  ['fr', frBase],
  ['en', enBase],
] as const)('keeps the settings texts in their own catalogue, never shadowed by the base one (%s)', (_, base) => {
  expect(Object.keys(base)).not.toContain('settings');
});
