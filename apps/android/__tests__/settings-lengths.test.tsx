// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { formatDay, parseDay } from '@minhajna/core';
import { accessibilityProblems } from '../jest/accessibility';
import { withDay } from '../jest/today-day';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { Lengths } from '../src/settings/Lengths';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
const onTimes = jest.fn();
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
  onTimes.mockReset();
});

test.each(['ar', 'fr', 'en'] as const)(
  'shows installed lengths, exact sources and provisional confidence (%s)',
  async (language) => {
    missingKeys.length = 0;
    const data = await withDay();
    const before = [...data.book.entries];
    await showSettingsScreen(<Lengths onTimes={onTimes} />, data, language);
    const words = settingsTexts();
    expect(words).toContain(catalogues[language].settings.confidence.projected);
    for (const source of data.bells.ramadan.map((rule) => rule.source)) {
      expect(words.some((text) => text.includes(source))).toBe(true);
    }
    expect(words).toContain(catalogues[language].settings.noRamadan);
    expect(words).toContain(catalogues[language].settings.noTemplate);
    expect(words.some((text) => text.includes('60'))).toBe(true);
    expect(words.some((text) => text.includes('45'))).toBe(true);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
    await pressSettings('lengths-times');
    expect(onTimes).toHaveBeenCalledTimes(1);
    expect(data.book.entries).toEqual(before);
  },
);

test('uses a newly supplied rule and its source, without inventing a primary profile', async () => {
  const data = await withDay();
  const changed = {
    ...data,
    bells: {
      ...data.bells,
      ramadan: [{ level: 'cem', minutes: 40, source: 'Synthetic published rule', confidence: 'announced' as const }],
    },
  };
  await showSettingsScreen(<Lengths onTimes={onTimes} />, changed);
  expect(settingsTexts()).toContain(catalogues.ar.settings.confidence.announced);
  expect(settingsTexts().some((text) => text.includes('40'))).toBe(true);
  expect(settingsTexts().some((text) => text.includes('Synthetic published rule'))).toBe(true);
  expect(settingsRoot().findAllByProps({ testID: 'lengths-no-ramadan-primary' }).length).toBeGreaterThan(0);
});

test('takes Ramadan’s dates and confidence from the calendar, not a date in the screen', async () => {
  const data = await withDay();
  const changed = {
    ...data,
    calendar: [
      {
        id: 'ramadan-synthetic',
        from: parseDay('2026-10-15'),
        to: parseDay('2026-10-20'),
        name: { ar: 'رمضان (مثال)', fr: 'Ramadan (exemple)', en: 'Ramadan (example)' },
        layer: 'national' as const,
        effect: 'marker' as const,
        confidence: 'announced' as const,
        source: 'Synthetic calendar',
        times: 'ramadan' as const,
      },
    ],
  };
  await showSettingsScreen(<Lengths onTimes={onTimes} />, changed);
  expect(settingsTexts()).toContain(catalogues.ar.times.ramadanNow);
  expect(settingsTexts().some((text) => text.includes(formatDay(parseDay('2026-10-20'))))).toBe(true);
});
