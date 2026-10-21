// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Ramadan on Today (#224, Today-ramadan, answer 336): «أول يوم من رمضان» and
// then the day's number under the date; the times notice and the rule card
// with its links until hidden, back when the lengths change. Made-up data.

import { addDays, parseDay, type CalendarEntry } from '@minhajna/core';
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

const day = parseDay('2026-10-15');
const open = { calendar: jest.fn(), book: jest.fn() };
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const line = () => String(settingsRoot().find((node) => node.props.testID === 'heading-special').props.children);
const ramadan = (fields: Partial<CalendarEntry> = {}) =>
  calendarEntry('ramadan', {
    from: day,
    to: addDays(day, 28),
    effect: 'marker',
    times: 'ramadan',
    confidence: 'expected',
    source: 'بيان تجريبي',
    hours: { confidence: 'announced', lengths: [{ level: 'cem', minutes: 45 }] },
    ...fields,
  });
const show = async (entries: readonly CalendarEntry[], language: 'ar' | 'fr' | 'en' = 'ar') => {
  const data = await withDay();
  await data.book.recordAll(
    day,
    entries.map((entry) => ({ kind: 'calendar.set', entry })),
  );
  await showSettingsScreen(
    <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onRamadan={open} />,
    data,
    language,
  );
  return data;
};

beforeEach(() => {
  missingKeys.length = 0;
  open.calendar.mockReset();
  open.book.mockReset();
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)(
  'Ramadan’s first day has its line, the times with their source, and the rule card with its links (%s)',
  async (language) => {
    await show([ramadan()], language);
    const text = catalogues[language].ramadanToday;
    expect(line()).toBe(text.first);
    expect(has('ramadan-notice')).toBe(true);
    expect(settingsTexts()).toContain(text.times);
    expect(settingsTexts()).toContain(i18n.t('calendarView.ramadanHours.lengthFrom', { minutes: 45, usual: 60 }));
    expect(settingsTexts().some((one) => one.includes('بيان تجريبي'))).toBe(true);
    expect(settingsTexts()).toContain(text.rule);
    expect(has('day-mark')).toBe(false);
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
  },
);

test('the links open the documents and Ramadan’s entry in the first school’s calendar', async () => {
  await show([ramadan()]);
  await pressSettings('ramadan-book');
  expect(open.book).toHaveBeenCalled();
  await pressSettings('ramadan-calendar');
  expect(open.calendar).toHaveBeenCalledWith('ramadan', 's-1');
});

test('a later day gives its number in Ramadan, and the cards stay until hidden', async () => {
  await show([ramadan({ from: addDays(day, -4), to: addDays(day, 24) })]);
  expect(line()).toBe(i18n.t('ramadanToday.day', { day: 5, days: 29 }));
  expect(has('ramadan-notice')).toBe(true);
});

test('without hours in the entry, the bundled length and its source show; with none, the usual one', async () => {
  const data = await show([ramadan({ hours: undefined })]);
  expect(settingsTexts()).toContain(i18n.t('calendarView.ramadanHours.lengthFrom', { minutes: 45, usual: 60 }));
  expect(settingsTexts().some((one) => one.includes(data.bells.ramadan[0].source))).toBe(true);
  await closeSettingsScreen();
  await showSettingsScreen(<Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onRamadan={open} />, {
    ...data,
    bells: { ...data.bells, ramadan: [] },
  });
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.ramadanHours.none);
  expect(has('ramadan-rule')).toBe(false);
  await pressSettings('ramadan-hide');
  expect(has('ramadan-notice')).toBe(false);
});

test('Ramadan’s line comes before a seminar’s; outside Ramadan neither card shows', async () => {
  await show([ramadan(), calendarEntry('seminar', { layer: 'teacher', effect: 'closure', half: 'afternoon' })]);
  expect(line().startsWith(`${catalogues.ar.ramadanToday.first} · `)).toBe(true);
  await closeSettingsScreen();
  await show([ramadan({ from: addDays(day, 1), to: addDays(day, 29) })]);
  expect(has('ramadan-notice')).toBe(false);
  expect(has('ramadan-rule')).toBe(false);
  expect(has('heading-special')).toBe(false);
});

test('hiding keeps the line and hides both cards, which come back with new lengths or another Ramadan', async () => {
  const entry = ramadan({ id: 'ramadan-hidden' });
  const data = await show([entry]);
  await pressSettings('ramadan-hide');
  expect(has('ramadan-notice')).toBe(false);
  expect(has('ramadan-rule')).toBe(false);
  expect(line()).toBe(catalogues.ar.ramadanToday.first);
  await closeSettingsScreen();
  await showSettingsScreen(
    <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onRamadan={open} />,
    data,
  );
  expect(has('ramadan-notice')).toBe(false);
  await data.book.record(day, {
    kind: 'calendar.set',
    entry: { ...entry, hours: { confidence: 'announced', lengths: [{ level: 'cem', minutes: 40 }] } },
  });
  await closeSettingsScreen();
  await showSettingsScreen(
    <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onRamadan={open} />,
    data,
  );
  expect(has('ramadan-notice')).toBe(true);
  expect(settingsTexts()).toContain(i18n.t('calendarView.ramadanHours.lengthFrom', { minutes: 40, usual: 60 }));
  await pressSettings('ramadan-hide');
  await data.book.record(day, {
    kind: 'calendar.set',
    entry: {
      ...entry,
      from: addDays(day, -1),
      to: addDays(day, 27),
      hours: { confidence: 'announced', lengths: [{ level: 'cem', minutes: 40 }] },
    },
  });
  await closeSettingsScreen();
  await showSettingsScreen(
    <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onRamadan={open} />,
    data,
  );
  expect(has('ramadan-notice')).toBe(true);
});
