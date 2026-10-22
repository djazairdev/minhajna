// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The re-pace screens at large text (#229): the draft with its ticks, and a
// primary draft sent to print and waiting with its approval date open, in
// Arabic and English, with text at 100% and 200%. Every control is named,
// every text grows and wraps, and at 200% each week's row stacks its parts.
// Made-up data only.

import { StyleSheet, Text, useWindowDimensions, type TextProps, type ViewStyle } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { behind, behindInPrimary } from '../jest/repace-data';
import { closeSettingsScreen, pressSettings, settingsRoot, showSettingsScreen } from '../jest/settings-screen';
import { Repace } from '../src/plan/Repace';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;

/** Every control named, no text clipped or held at one size, no text missing. */
function expectScales(): void {
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  for (const node of settingsRoot().findAllByType(Text)) {
    const props = node.props as TextProps;
    expect(props.numberOfLines).toBeUndefined();
    expect(props.allowFontScaling).not.toBe(false);
    expect(props.maxFontSizeMultiplier).toBeUndefined();
  }
  expect(missingKeys).toEqual([]);
}

/** Whether every week's row lays its parts out in a column. */
function rowsStacked(): boolean {
  const rows = settingsRoot().findAll(
    (node) =>
      typeof node.props.testID === 'string' &&
      node.props.testID.startsWith('repace-week-') &&
      node.props.style !== undefined,
  );
  expect(rows.length).toBeGreaterThan(0);
  return rows.every((row) => StyleSheet.flatten(row.props.style as ViewStyle)?.flexDirection === 'column');
}

afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each((['ar', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale }))))(
  'the draft and a primary draft waiting for approval scale ($language, $fontScale×)',
  async ({ language, fontScale }) => {
    missingKeys.length = 0;
    jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
    await showSettingsScreen(<Repace courseId="c-1" />, await behind(), language);
    expect(has('repace-choice-0')).toBe(true);
    expect(has('repace-print')).toBe(true);
    expect(rowsStacked()).toBe(fontScale === 2);
    expectScales();

    await showSettingsScreen(<Repace courseId="c-1" />, await behindInPrimary(), language);
    await pressSettings('repace-print');
    expect(has('repace-record')).toBe(true);
    expect(has('repace-edit')).toBe(true);
    expectScales();
  },
);
