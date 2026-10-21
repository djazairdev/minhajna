// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { formatDay, parseDay, type CalendarUpdate, type RecordEvent } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { makeTestKey } from '../../../packages/core/test/signed-fixtures';
import { accessibilityProblems } from '../jest/accessibility';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { Calendar } from '../src/calendar/Calendar';
import { CalendarEntry } from '../src/calendar/Entry';
import { UpdateChanges } from '../src/calendar/UpdateChanges';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import { TodayUpdate } from '../src/today/TodayUpdate';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const key = makeTestKey();
const text = catalogues.ar.calendarView.update;
const closure = (id: string, zone: string, day = '2026-10-22') => ({
  id,
  layer: 'zone' as const,
  zone,
  from: parseDay(day),
  to: parseDay(day),
  effect: 'closure' as const,
  name: { ar: 'تعليق تجريبي', en: 'Example suspension', fr: 'Suspension fictive' },
  source: 'إعلان تجريبي غير رسمي',
  confidence: 'announced' as const,
  moved: { from: parseDay('2026-10-21'), to: parseDay('2026-10-21'), reason: 'سبب تجريبي' },
});
const update = (
  release: string,
  entries = [closure('example-mine', '16'), closure('example-elsewhere', '31')],
): CalendarUpdate => ({
  country: 'dz',
  year: '2026-2027',
  release,
  published: parseDay('2026-10-15'),
  entries,
  removed: [],
});
const applied = (release: string, entries?: Parameters<typeof update>[1]): RecordEvent => ({
  kind: 'calendar.updated',
  applied: { update: update(release, entries), key: key.trusted.id, file: '{}' },
});
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const withUpdate = async (release = '2026.5') => {
  const data = { ...(await withDay()), keys: [key.trusted] };
  await data.book.record(parseDay('2026-10-15'), applied(release));
  return data;
};

beforeEach(() => {
  jest.clearAllMocks();
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as const)('shows what an applied update changed (%s)', async (language) => {
  const onCalendar = jest.fn();
  const data = await withUpdate();
  await showSettingsScreen(<UpdateChanges release="2026.5" onCalendar={onCalendar} />, data, language);
  const own = catalogues[language].calendarView.update;
  expect(settingsTexts()).toContain(own.changed.title);
  expect(settingsTexts()).toContain(own.changed.sessions);
  expect(has('update-applied-on')).toBe(true);
  expect(has('update-change-example-mine')).toBe(true);
  expect(has('update-change-example-elsewhere')).toBe(false);
  expect(has('update-others')).toBe(true);
  expect(has('calendar-impact')).toBe(true);
  expect(has('update-bundled')).toBe(false);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
  await pressSettings('update-to-calendar');
  expect(onCalendar).toHaveBeenCalledTimes(1);
});

test('an update the bundled calendar already holds says so and changes nothing', async () => {
  const data = await withUpdate('2026.2');
  await showSettingsScreen(<UpdateChanges release="2026.2" onCalendar={jest.fn()} />, data);
  expect(has('update-bundled')).toBe(true);
  expect(has('calendar-impact')).toBe(false);
  expect(has('update-change-example-mine')).toBe(false);
});

test('Today shows the card on the day the update is applied, until it is hidden', async () => {
  const open = jest.fn();
  const data = await withUpdate();
  await showSettingsScreen(<TodayUpdate day={parseDay('2026-10-14')} open={open} />, data);
  expect(has('today-update')).toBe(false);
  await showSettingsScreen(<TodayUpdate day={parseDay('2026-10-15')} open={open} />, data);
  expect(has('today-update')).toBe(true);
  expect(settingsTexts()).toContain(text.today.title);
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  await pressSettings('today-update-open');
  expect(open).toHaveBeenCalledWith('2026.5');
  await pressSettings('today-update-hide');
  expect(has('today-update')).toBe(false);
});

test('Today shows the latest update of the day that concerns the teacher, past the hidden one', async () => {
  const open = jest.fn();
  const data = { ...(await withDay()), keys: [key.trusted] };
  const day = parseDay('2026-10-15');
  await data.book.record(day, applied('2026.7', [closure('example-friday', '16', '2026-10-23')]));
  await data.book.record(day, applied('2026.8', [closure('example-elsewhere', '31')]));
  await showSettingsScreen(<TodayUpdate day={day} open={open} />, data, 'en');
  const own = catalogues.en.calendarView.update.today;
  expect(settingsTexts()).toContain(own.none);
  expect(settingsTexts().some((one) => /\b0\b/.test(one))).toBe(false);
  await pressSettings('today-update-open');
  expect(open).toHaveBeenCalledWith('2026.7');
  await pressSettings('today-update-hide');
  expect(has('today-update')).toBe(false);
  await data.book.record(day, applied('2026.9', [closure('example-mine', '16')]));
  await showSettingsScreen(<TodayUpdate day={day} open={open} />, data, 'en');
  await pressSettings('today-update-open');
  expect(open).toHaveBeenLastCalledWith('2026.9');
  expect(settingsTexts()).not.toContain(own.none);
});

test('the Calendar names its latest update, and an entry the update it comes from and its first dates', async () => {
  const onUpdate = jest.fn();
  const data = await withUpdate();
  await showSettingsScreen(<Calendar onEntry={jest.fn()} onUpdate={onUpdate} />, data);
  expect(settingsTexts()).toContain(text.footnote.replace('{{day}}', formatDay(parseDay('2026-10-15'))));
  await pressSettings('calendar-last-update');
  expect(onUpdate).toHaveBeenCalledWith('2026.5');
  await showSettingsScreen(<CalendarEntry id="example-mine" origin="bundled" schoolId="s-1" />, data);
  const origin = settingsRoot().find((node) => node.props.testID === 'calendar-entry-origin');
  expect(String(origin.props.children)).toContain('2026.5');
  expect(String(origin.props.children)).toContain('Example holder');
  expect(has('calendar-entry-first')).toBe(true);
});
