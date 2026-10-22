// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// #230's primary screens at large text: Today in bands, a week pack's plan
// by plan week, a stale pack's plan with «استعماله بحذر» open, «سؤال
// المفتش», a primary slot on Week-slot, and «الدوامان» on Week-draw, in
// Arabic and English, with text at 100% and 200%. Every control is named,
// every text grows and wraps, and at 200% each of «الدوامان»'s weeks stacks
// its parts. Made-up data only.

import type { ReactElement } from 'react';
import { StyleSheet, Text, useWindowDimensions, type TextProps, type ViewStyle } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { withPrimary } from '../jest/primary-class';
import { closeSettingsScreen, pressSettings, settingsRoot, showSettingsScreen } from '../jest/settings-screen';
import { withStale } from '../jest/stale-pack';
import { ClassPlan } from '../src/classes/ClassPlan';
import { StaleQuestion } from '../src/plan/StaleQuestion';
import { i18n, missingKeys, type Language } from '../src/text/i18n';
import { Today } from '../src/today/Today';
import { WeekDraw } from '../src/week/WeekDraw';

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

/** Whether each of «الدوامان»'s weeks lays its parts out in a column. */
function weeksStacked(): boolean {
  const rows = settingsRoot().findAll(
    (node) =>
      typeof node.props.testID === 'string' &&
      node.props.testID.startsWith('shift-week-') &&
      node.props.style !== undefined,
  );
  expect(rows.length).toBeGreaterThan(0);
  return rows.every((row) => StyleSheet.flatten(row.props.style as ViewStyle)?.flexDirection === 'column');
}

async function show(element: ReactElement, data: TestData, language: Language): Promise<void> {
  await showSettingsScreen(element, data, language);
}

afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

const cases = (['ar', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale })));

test.each(cases)('Today, the plan by plan week and a stale plan scale ($language, $fontScale×)', async (setting) => {
  const { language, fontScale } = setting;
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
  await show(<Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, await withPrimary(), language);
  expect(has('today-band-morning')).toBe(true);
  expectScales();
  await show(<ClassPlan courseId="a-1" onEditList={jest.fn()} />, await withPrimary(), language);
  expect(has('plan-week-1')).toBe(true);
  expectScales();
  await show(<ClassPlan courseId="a-1" onEditList={jest.fn()} onAsk={jest.fn()} />, await withStale(), language);
  await pressSettings('plan-stale-care');
  expect(has('plan-stale-note')).toBe(true);
  expectScales();
  await show(<StaleQuestion courseId="a-1" />, await withStale(), language);
  expect(has('stale-question-sheet')).toBe(true);
  expectScales();
});

test.each(cases)('a primary slot and «الدوامان» scale ($language, $fontScale×)', async ({ language, fontScale }) => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
  await show(<WeekDraw onDone={jest.fn()} onLetter={jest.fn()} onRules={jest.fn()} />, await withPrimary(), language);
  await pressSettings('option-doubleShift');
  expect(has('shift-card')).toBe(true);
  expect(weeksStacked()).toBe(fontScale === 2);
  expectScales();
  await pressSettings('pen-details');
  await pressSettings('draw-4-m1');
  expect(has('slot-0-activity')).toBe(true);
  expectScales();
});
