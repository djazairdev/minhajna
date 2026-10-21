// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Special days on Today (#224, Today-special, answer 335): a seminar or a
// duty takes only its part of the day and shows a line and a card instead
// of the banner, and a school event takes no session. Made-up data only.

import { parseDay, type CalendarEntry } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { calendarEntry } from '../jest/calendar-data';
import { closeSettingsScreen, settingsRoot, settingsTexts, showSettingsScreen } from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { calendarCatalogues } from '../src/calendar/catalogues';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const show = async (entry: CalendarEntry, language: 'ar' | 'fr' | 'en' = 'ar') => {
  const data = await withDay();
  const version = data.book.state.timetables.at(-1)!.version;
  const afternoon = { ...version.entries[0], id: 'e-pm', slot: { half: 'afternoon', index: 1 } } as const;
  await data.book.recordAll(parseDay('2026-10-15'), [
    { kind: 'timetable.set', version: { ...version, entries: [...version.entries, afternoon] } },
    { kind: 'calendar.set', entry },
  ]);
  await showSettingsScreen(<Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, data, language);
  return data;
};
const seminar = (fields: Partial<CalendarEntry> = {}) =>
  calendarEntry('seminar', { layer: 'teacher', effect: 'closure', half: 'afternoon', ...fields });
const lesson = (slot: string) =>
  settingsRoot()
    .findAll((node) => node.props.testID === `today-c-1/2026-10-15/${slot}/k-1-w`)
    .map((node) => node.props.lesson as unknown)[0];
const taken = (slot: string, entry: string) => lesson(slot) === `موعد تجريبي ${entry}`;

beforeEach(() => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)(
  'an afternoon seminar keeps the morning, with a special-day line and its card, not a banner (%s)',
  async (language) => {
    await show(seminar(), language);
    const text = catalogues[language];
    expect(has('day-mark')).toBe(false);
    expect(has('heading-special')).toBe(true);
    expect(settingsTexts().some((one) => one.startsWith(text.special.line.split('{{')[0]))).toBe(true);
    expect(has('special-seminar')).toBe(true);
    expect(settingsTexts()).toContain(text.special.kinds.training);
    expect(has('day-next')).toBe(false);
    if (language === 'ar') {
      expect(taken('m1', 'seminar')).toBe(false);
      expect(taken('a1', 'seminar')).toBe(true);
    }
    expect(accessibilityProblems(settingsRoot())).toEqual([]);
    expect(missingKeys).toEqual([]);
  },
);

test('a whole-day seminar takes every session, each showing its name, still without a banner', async () => {
  const entry = seminar({ half: undefined });
  await show(entry);
  expect(has('day-mark')).toBe(false);
  expect(taken('m1', 'seminar')).toBe(true);
  expect(taken('a1', 'seminar')).toBe(true);
  expect(settingsTexts()).toContain(catalogues.ar.calendarView.periods.all);
  expect(settingsTexts()).toContain(i18n.t('daymark.lost', { count: 4 }));
  expect(has('day-next')).toBe(true);
  const heading = settingsRoot().find((node) => node.props.testID === 'today-heading');
  const facts = heading
    .findAll((node) => typeof node.props.children === 'string')
    .map((node) => String(node.props.children));
  expect(facts.some((one) => one.includes(i18n.t('count.sessions', { count: 4 })))).toBe(false);
});

test('a duty says it is a duty, and a school event takes no session', async () => {
  await show(seminar({ name: { ar: calendarCatalogues.ar.edit.kinds.duty } }));
  expect(settingsTexts()).toContain(catalogues.ar.special.kinds.duty);
  await closeSettingsScreen();
  await show(calendarEntry('event', { layer: 'school', schoolId: 's-1', effect: 'marker' }));
  expect(settingsTexts()).toContain(catalogues.ar.special.kinds.event);
  const card = settingsRoot().find((node) => node.props.testID === 'special-event');
  const where = `${catalogues.ar.calendarView.periods.all} · متوسطة النجاح`;
  expect(card.findAll((node) => node.props.children === where).length).toBeGreaterThan(0);
  expect(taken('m1', 'event')).toBe(false);
  expect(taken('a1', 'event')).toBe(false);
  expect(has('day-lost')).toBe(false);
});

test('a school closure still shows its banner, and Ramadan has its own line, not a special-day card', async () => {
  await show(calendarEntry('closed', { layer: 'school', schoolId: 's-1', effect: 'closure' }));
  expect(has('day-mark')).toBe(true);
  expect(has('heading-special')).toBe(false);
  await closeSettingsScreen();
  await show(calendarEntry('ramadan', { effect: 'marker', times: 'ramadan', confidence: 'expected' }));
  expect(has('special-ramadan')).toBe(false);
  const line = String(settingsRoot().find((node) => node.props.testID === 'heading-special').props.children);
  expect(line).toBe(catalogues.ar.ramadanToday.first);
});

test('two special entries are joined in the language of the screen, and a national marker is not one', async () => {
  const data = await show(seminar(), 'en');
  await data.book.recordAll(parseDay('2026-10-15'), [
    { kind: 'calendar.set', entry: calendarEntry('event', { layer: 'school', schoolId: 's-1', effect: 'marker' }) },
    { kind: 'calendar.set', entry: calendarEntry('national-marker', { effect: 'marker' }) },
  ]);
  await closeSettingsScreen();
  await showSettingsScreen(<Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} />, data, 'en');
  const line = String(settingsRoot().find((node) => node.props.testID === 'heading-special').props.children);
  expect(line).toContain(', ');
  expect(line).not.toContain('،');
  expect(has('special-national-marker')).toBe(false);
});
