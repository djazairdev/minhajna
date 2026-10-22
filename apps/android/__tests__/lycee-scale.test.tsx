// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// #231's screens at large text: Today with a TD session's list and
// «تأكيد اليوم كله», Today with a half-group's pair, a hybrid plan's weekly
// targets, and «إعادة تشكيل الأقسام» with a class's pupils open, in Arabic
// and English, with text at 100% and 200%. Every control is named and every
// text grows and wraps. Made-up data only.

import type { ReactElement } from 'react';
import { Text, useWindowDimensions, type TextProps } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { withHalves } from '../jest/halves-class';
import { withHybrid } from '../jest/hybrid-lycee';
import { withReshape } from '../jest/reorient-lycee';
import { closeSettingsScreen, pressSettings, settingsRoot, showSettingsScreen } from '../jest/settings-screen';
import { withTd } from '../jest/td-class';
import { ClassPlan } from '../src/classes/ClassPlan';
import { Reorient } from '../src/reorient/Reorient';
import { i18n, missingKeys, type Language } from '../src/text/i18n';
import { Today } from '../src/today/Today';

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

async function show(element: ReactElement, data: TestData, language: Language): Promise<void> {
  await showSettingsScreen(element, data, language);
}

afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

const cases = (['ar', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale })));
const today = <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />;

test.each(cases)('Today’s TD list and half-group pair scale ($language, $fontScale×)', async (setting) => {
  const { language, fontScale } = setting;
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
  await show(today, await withTd(), language);
  expect(has('today-c-m/2026-10-15/m1/k-m-w-td')).toBe(true);
  expect(has('today-confirm-day')).toBe(true);
  expectScales();
  await show(today, await withHalves(), language);
  expect(has('today-c-1/2026-10-15/m2/k-1-a-pair')).toBe(true);
  expectScales();
});

test.each(cases)('weekly targets and the reshaping scale ($language, $fontScale×)', async ({ language, fontScale }) => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
  await show(<ClassPlan courseId="c-l" />, await withHybrid(), language);
  expect(has('plan-target')).toBe(true);
  expectScales();
  await show(<Reorient classId="k-a" onDone={jest.fn()} />, await withReshape(), language);
  await pressSettings('reorient-edit-k-a');
  expect(has('reorient-class-1')).toBe(true);
  expect(has('reorient-pupil-p-k-a-1')).toBe(true);
  expectScales();
});
