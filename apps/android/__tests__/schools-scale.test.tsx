// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// #232's screens at large text: Today with two schools' bands and the lines
// saying which sessions meet, the Classes tab by school with its merged-week
// card and register note, and Week-slot's clash panel with a day chosen to
// move one session, in Arabic and English, with text at 100% and 200%. Every
// control is named and every text grows and wraps. Made-up data only.

import { Text, useWindowDimensions, View, type TextProps } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { withClash } from '../jest/clash-schools';
import { closeSettingsScreen, pressSettings, settingsRoot, showSettingsScreen } from '../jest/settings-screen';
import { ClassesTab } from '../src/classes/ClassesTab';
import { i18n, missingKeys } from '../src/text/i18n';
import { Today } from '../src/today/Today';
import { WeekDraw } from '../src/week/WeekDraw';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const ids = () =>
  settingsRoot()
    .findAll((node) => typeof node.props.testID === 'string')
    .map((node) => node.props.testID as string);
const has = (id: string) => ids().includes(id);
const shownLines = () =>
  settingsRoot()
    .findAllByType(View)
    .map((node) => node.props.testID as unknown)
    .filter((id) => typeof id === 'string' && id.endsWith('-time'));

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

afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

const cases = (['ar', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale })));

test.each(cases)('Today’s bands and the Classes tab by school scale ($language, $fontScale×)', async (setting) => {
  const { language, fontScale } = setting;
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
  const data = await withClash();
  await showSettingsScreen(<Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, data, language);
  expect(has('today-band-s-1-morning')).toBe(true);
  expect(shownLines()).toEqual(['today-f-1/2026-10-15/m1/k-1-w-time', 'today-f-3/2026-10-15/m1/k-3-w-time']);
  expectScales();
  await showSettingsScreen(<ClassesTab onClass={jest.fn()} onBook={jest.fn()} onWeek={jest.fn()} />, data, language);
  expect(['classes-school-s-1', 'classes-school-s-2', 'classes-week', 'classes-register'].every(has)).toBe(true);
  expectScales();
});

test.each(cases)('the clash panel scales ($language, $fontScale×)', async ({ language, fontScale }) => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
  const week = <WeekDraw onDone={jest.fn()} openAt={{ weekday: 4, slot: { half: 'morning', index: 1 } }} />;
  await showSettingsScreen(week, await withClash(), language);
  expect(has('clash-keep')).toBe(true);
  await pressSettings('clash-move');
  await pressSettings('clash-day-2026-10-22');
  expect(has('clash-to-e-4/a2')).toBe(true);
  expectScales();
});
