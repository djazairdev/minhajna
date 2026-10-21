// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class council on Today (#224, Today-council, answer 334): a special-day
// line with its time, a card with the class and «انعقد المجلس», which
// records it held; it takes no session and shows no banner. Made-up data.

import { parseDay, type CalendarEntry } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { calendarEntry } from '../jest/calendar-data';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const council = (fields: Partial<CalendarEntry> = {}) =>
  calendarEntry('council', {
    layer: 'school',
    schoolId: 's-1',
    council: { classId: 'k-2', term: 1, at: '14:00' },
    name: { ar: 'مجلس القسم 4م2 للفصل الأول', fr: 'Conseil de classe 4م2', en: 'Class council 4م2' },
    ...fields,
  });
const show = async (entry: CalendarEntry, language: 'ar' | 'fr' | 'en' = 'ar') => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), { kind: 'calendar.set', entry });
  await showSettingsScreen(<Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, data, language);
  return data;
};

beforeEach(() => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)(
  'a council shows its line, its card and the held button, takes no session and no banner (%s)',
  async (language) => {
    const data = await show(council(), language);
    expect(has('day-mark')).toBe(false);
    expect(has('day-lost')).toBe(false);
    expect(has('special-council')).toBe(true);
    expect(has('special-held-council')).toBe(true);
    expect(settingsTexts()).toContain(catalogues[language].special.kinds.council);
    expect(data.book.state.calendar[0].council?.held).toBeUndefined();
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
  },
);

test('the line gives the time, the card the class, and «انعقد المجلس» records it held', async () => {
  const data = await show(council());
  const line = String(settingsRoot().find((node) => node.props.testID === 'heading-special').props.children);
  expect(line).toContain('14سا');
  const card = settingsRoot().find((node) => node.props.testID === 'special-council');
  expect(card.findAll((node) => node.props.children === '14سا · 4م2').length).toBeGreaterThan(0);
  const note = 'مجلس القسم 4م2 للفصل الأول. لا يمسّ حصص اليوم، ويُكتب في الدفتر اليومي حين يُؤكَّد.';
  expect(card.findAll((node) => node.props.children === note).length).toBeGreaterThan(0);
  await pressSettings('special-held-council');
  expect(data.book.state.calendar[0].council).toEqual({ classId: 'k-2', term: 1, at: '14:00', held: true });
  expect(has('special-held-council')).toBe(false);
  expect(settingsTexts()).toContain(catalogues.ar.special.kept);
});

test('a council whose class is gone cannot be marked held, and says so', async () => {
  const data = await show(council({ council: { classId: 'k-gone', term: 1, at: '14:00' } }));
  await pressSettings('special-held-council');
  expect(has('special-failed-council')).toBe(true);
  expect(data.book.state.calendar[0].council?.held).toBeUndefined();
});
