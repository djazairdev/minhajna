// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today's special days together (#224): a seminar, a class council, a cover
// and Ramadan on one day, in Arabic and English, with text at 100% and 200%.
// Ramadan's line comes first, the heading stacks at 200%, every control is
// named and every text grows and wraps. Made-up data only.

import { addDays, parseDay } from '@minhajna/core';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { calendarEntry } from '../jest/calendar-data';
import { closeSettingsScreen, settingsRoot, showSettingsScreen } from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const day = parseDay('2026-10-15');
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;

afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each((['ar', 'en'] as const).flatMap((language) => [1, 2].map((fontScale) => ({ language, fontScale }))))(
  'a seminar, a council, a cover and Ramadan on one day have named controls and growing text ($language, $fontScale×)',
  async ({ language, fontScale }) => {
    missingKeys.length = 0;
    jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
    const data = await withDay();
    await data.book.recordAll(day, [
      {
        kind: 'calendar.set',
        entry: calendarEntry('seminar', { layer: 'teacher', effect: 'closure', half: 'afternoon' }),
      },
      {
        kind: 'calendar.set',
        entry: calendarEntry('council', {
          layer: 'school',
          schoolId: 's-1',
          council: { classId: 'k-2', term: 1, at: '14:00' },
        }),
      },
      {
        kind: 'calendar.set',
        entry: calendarEntry('ramadan', {
          to: addDays(day, 28),
          times: 'ramadan',
          confidence: 'expected',
          hours: { confidence: 'announced', lengths: [{ level: 'cem', minutes: 45 }] },
        }),
      },
      {
        kind: 'duty.set',
        duty: { id: 'cover', kind: 'cover', day, from: '11:00', to: '12:00', schoolId: 's-1', className: '3م4' },
      },
    ]);
    const open = { calendar: jest.fn(), book: jest.fn() };
    await showSettingsScreen(
      <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onRamadan={open} />,
      data,
      language,
    );
    for (const id of [
      'heading-special',
      'special-seminar',
      'special-council',
      'cover-cover',
      'ramadan-notice',
      'ramadan-rule',
    ])
      expect(has(id)).toBe(true);
    const line = String(settingsRoot().find((node) => node.props.testID === 'heading-special').props.children);
    expect(line.startsWith(`${catalogues[language].ramadanToday.first} · `)).toBe(true);
    expect(line).toContain(catalogues[language].calendarView.periods.afternoon);
    expect(line).toContain('14');
    const top = settingsRoot()
      .find((node) => node.props.testID === 'today-heading')
      .findAllByType(View)[1];
    expect(StyleSheet.flatten(top.props.style as StyleProp<ViewStyle>)?.flexDirection === 'column').toBe(
      fontScale >= 1.5,
    );
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    for (const node of settingsRoot().findAllByType(Text)) {
      const props = node.props as TextProps;
      expect(props.numberOfLines).toBeUndefined();
      expect(props.allowFontScaling).not.toBe(false);
      expect(props.maxFontSizeMultiplier).toBeUndefined();
    }
    expect(missingKeys).toEqual([]);
  },
);
