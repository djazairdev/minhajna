// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// An exam window moved by a signed update (#223, answers 322 to 325): the
// class plan shows the new dates with the first ones struck and why, Today's
// card names the move, «ما تغيّر» counts the spare sessions and the plan
// items past the exams with the class's plan to open, and a move under two
// weeks ahead is said to be late, by the release that first made it.
// Made-up data only.

import { parseDay, type CalendarUpdate, type RecordEvent } from '@minhajna/core';
import { StyleSheet, useWindowDimensions, type TextStyle } from 'react-native';
import { makeTestKey } from '../../../packages/core/test/signed-fixtures';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { CalendarEntry } from '../src/calendar/Entry';
import { UpdateChanges } from '../src/calendar/UpdateChanges';
import { ClassPlan } from '../src/classes/ClassPlan';
import { catalogues, i18n, missingKeys } from '../src/text/i18n';
import { TodayUpdate } from '../src/today/TodayUpdate';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const key = makeTestKey();
const text = catalogues.ar.calendarView.update;
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const withMove = async (published = '2026-10-15', repeat?: string) => {
  const data = { ...(await withDay()), keys: [key.trusted] };
  const exams = data.calendar.find((entry) => entry.id === 'term-1-exams-4am-3as')!;
  const update: CalendarUpdate = {
    country: 'dz',
    year: '2026-2027',
    release: '2026.5',
    published: parseDay(published),
    entries: [
      {
        ...exams,
        from: parseDay('2026-10-26'),
        to: parseDay('2026-10-28'),
        source: 'إعلان تجريبي غير رسمي',
        confidence: 'announced',
        moved: { from: exams.from, to: exams.to, reason: 'سبب تجريبي' },
      },
    ],
    removed: [],
  };
  const applied: RecordEvent = { kind: 'calendar.updated', applied: { update, key: key.trusted.id, file: '{}' } };
  await data.book.record(parseDay(published), applied);
  if (repeat !== undefined) {
    const again = {
      ...update,
      release: '2026.6',
      published: parseDay(repeat),
      entries: update.entries.map((entry) => ({ ...entry, source: 'إعلان تجريبي ثانٍ' })),
    };
    await data.book.record(parseDay(repeat), {
      kind: 'calendar.updated',
      applied: { ...applied.applied, update: again },
    });
  }
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

test('the class plan shows the first exam dates struck, and why they moved', async () => {
  await showSettingsScreen(<ClassPlan courseId="c-1" />, await withMove());
  const moved = settingsRoot().find((node) => node.props.testID === 'plan-exam-moved');
  expect(String(moved.props.accessibilityLabel)).toContain('سبب تجريبي');
  const struck = moved.findAll(
    (node) =>
      (StyleSheet.flatten(node.props.style as TextStyle | undefined) ?? {}).textDecorationLine === 'line-through',
  );
  expect(struck.length).toBeGreaterThan(0);
  expect(missingKeys).toEqual([]);
});

test("Today's card names the move with its first dates and the reason", async () => {
  await showSettingsScreen(<TodayUpdate day={parseDay('2026-10-15')} open={jest.fn()} />, await withMove());
  expect(settingsTexts().some((one) => one.includes('سبب تجريبي'))).toBe(true);
});

test('«ما تغيّر» counts the spare sessions and the items past the exams, opens the plan, and says it came late', async () => {
  const onPlan = jest.fn();
  await showSettingsScreen(<UpdateChanges release="2026.5" onCalendar={jest.fn()} onPlan={onPlan} />, await withMove());
  expect(has('impact-course-c-1')).toBe(true);
  expect(has('impact-after-c-1')).toBe(true);
  expect(has('impact-later-c-1')).toBe(true);
  expect(has('update-late-term-1-exams-4am-3as')).toBe(true);
  expect(settingsTexts()).toContain(text.late);
  await pressSettings('impact-plan-c-1');
  expect(onPlan).toHaveBeenCalledWith('c-1');
  expect(missingKeys).toEqual([]);
});

test('the moved entry says it was announced late', async () => {
  await showSettingsScreen(
    <CalendarEntry id="term-1-exams-4am-3as" origin="bundled" schoolId="s-1" />,
    await withMove(),
  );
  expect(has('calendar-entry-late')).toBe(true);
});

test('a later release that keeps the move is not late news, and the entry dates the move by its first release', async () => {
  const data = await withMove('2026-10-01', '2026-10-20');
  await showSettingsScreen(<UpdateChanges release="2026.6" onCalendar={jest.fn()} onPlan={jest.fn()} />, data);
  expect(has('update-change-term-1-exams-4am-3as')).toBe(true);
  expect(has('update-late-term-1-exams-4am-3as')).toBe(false);
  expect(has('impact-after-c-1')).toBe(false);
  await closeSettingsScreen();
  await showSettingsScreen(<CalendarEntry id="term-1-exams-4am-3as" origin="bundled" schoolId="s-1" />, data);
  expect(has('calendar-entry-late')).toBe(false);
});
