// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A week pack's plan (#230, Plan-primary, answer 381): its rows by plan
// week, «أسبوع المخطط 1» with its days and sequence; the class's plan week
// and the plan's; the sessions the calendar took, counted apart; and the
// weekly model; the weeks behind beyond the buffers; and «إعادة توزيع بقية
// الفصل» while it is offered. A pack paced in sessions keeps its units, and
// guided work stays in one list. Made-up data only.

import { awaitingBetween, confirmSessions, courseSetup, parseDay, planView } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import { accessibilityProblems } from '../jest/accessibility';
import { calendarEntry } from '../jest/calendar-data';
import { slot, withPrimary } from '../jest/primary-class';
import {
  closeSettingsScreen,
  pressSettings,
  settingsRoot,
  settingsTexts,
  showSettingsScreen,
} from '../jest/settings-screen';
import { withDay } from '../jest/today-day';
import { ClassPlan } from '../src/classes/ClassPlan';
import { PlanWeekLines, weeksBehindLine } from '../src/classes/PlanRows';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, missingKeys, type Language } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

const day = parseDay('2026-10-15');
const has = (id: string) => settingsRoot().findAll((node) => node.props.testID === id).length > 0;
const textOf = (id: string): string => {
  const [node] = settingsRoot().findAll((one) => one.props.testID === id && one.props.children !== undefined);
  return [node?.props.children as unknown].flat().join('');
};

beforeEach(() => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await closeSettingsScreen();
  await i18n.changeLanguage('ar');
});

test.each(['ar', 'fr', 'en'] as Language[])('shows a week pack’s plan by plan week (%s)', async (language) => {
  const data = await withPrimary();
  await data.book.record(day, {
    kind: 'calendar.set',
    entry: calendarEntry('closure', { layer: 'school', schoolId: 's-1', effect: 'closure' }),
  });
  await showSettingsScreen(<ClassPlan courseId="a-1" />, data, language);
  const text = catalogues[language];
  expect(has('plan-week-1')).toBe(true);
  const week = text.classPlan.weekHead.replace('{{week}}', '1');
  expect(settingsTexts().some((one) => one.startsWith(`${week} · `))).toBe(true);
  expect(textOf('plan-week-position')).toBe(text.classPlan.weekPositionSame.replace('{{week}}', '1'));
  const two = language === 'ar' ? 'حصتان' : language === 'fr' ? '2 séances' : '2 sessions';
  expect(textOf('plan-calendar-lost')).toBe(text.classPlan.calendarLost.replace('{{sessions}}', two));
  const model =
    language === 'ar' ? 'قراءة 1 · كتابة 1' : language === 'fr' ? 'Lecture 1 · Écriture 1' : 'Reading 1 · Writing 1';
  expect(textOf('plan-week-model')).toBe(text.classPlan.weekModel.replace('{{activities}}', model));
  expect(accessibilityProblems(settingsRoot())).toEqual([]);
  expect(missingKeys).toEqual([]);
});

test('keeps the units of a pack paced in sessions', async () => {
  await showSettingsScreen(<ClassPlan courseId="c-1" />, await withDay());
  expect(has('plan-week-position')).toBe(false);
  expect(has('plan-week-model')).toBe(false);
  expect(has('plan-calendar-lost')).toBe(false);
});

test('opens the re-pace draft while it is offered', async () => {
  const data = await withPrimary();
  const [version] = data.book.state.timetables;
  await data.book.record(day, {
    kind: 'timetable.set',
    version: { ...version.version, id: 'v-0', from: parseDay('2026-09-20') },
  });
  const context = () => coreContext({ ...data, state: data.book.state });
  const past = awaitingBetween(context(), parseDay('2026-09-20'), day).filter((one) => one.courseId === 'a-1');
  await data.book.recordAll(
    day,
    confirmSessions(
      context(),
      past.map((session) => ({ session, choice: { outcome: 'not-held' } })),
    ),
  );
  const onRepace = jest.fn();
  await showSettingsScreen(<ClassPlan courseId="a-1" onRepace={onRepace} />, data);
  await pressSettings('plan-repace');
  expect(onRepace).toHaveBeenCalledTimes(1);

  await showSettingsScreen(<ClassPlan courseId="a-1" onRepace={onRepace} />, await withPrimary());
  expect(has('plan-repace')).toBe(false);
});

test('words the weeks behind beyond the buffers', () => {
  const t = ((key: string, params?: Record<string, unknown>) =>
    `${key}${params === undefined ? '' : ` ${JSON.stringify(params)}`}`) as unknown as Parameters<
    typeof weeksBehindLine
  >[0];
  const paced = (weeksBehind: number | null) => ({ weeksBehind }) as Parameters<typeof weeksBehindLine>[1];
  expect(weeksBehindLine(t, paced(null))).toBeNull();
  expect(weeksBehindLine(t, paced(0.4))).toBeNull();
  expect(weeksBehindLine(t, paced(2))).toBe(t('classPlan.weeksBehind', { weeks: t('count.weeks', { count: 2 }) }));
  expect(weeksBehindLine(t, null)).toBeNull();
});

test('heads each plan week with its days, and says the class’s plan week and the plan’s', async () => {
  const data = await withPrimary();
  const [version] = data.book.state.timetables;
  const more = [3, 4].map((index) => slot(`e-m${index}`, 'morning', index, 'a-1'));
  await data.book.record(day, {
    kind: 'timetable.set',
    version: { ...version.version, entries: [...version.version.entries, ...more] },
  });
  const context = coreContext({ ...data, state: data.book.state });
  const today = awaitingBetween(context, day, day).filter((one) => one.courseId === 'a-1');
  await data.book.recordAll(
    day,
    confirmSessions(
      context,
      today.map((session) => ({ session })),
    ),
  );
  await showSettingsScreen(<ClassPlan courseId="a-1" />, data);
  const text = catalogues.ar.classPlan;
  const head = (week: number) => text.weekHead.replace('{{week}}', String(week));
  expect(settingsTexts()).toEqual(expect.arrayContaining([`${head(1)} · 15/10`, `${head(2)} · 15/10–22/10`]));
  expect(textOf('plan-week-position')).toBe(text.weekPositionSame.replace('{{week}}', '2'));

  const fresh = coreContext({ ...data, state: data.book.state });
  const pack = courseSetup(fresh, 'a-1').pack;
  const rows = planView(fresh, 'a-1', day)?.main ?? [];
  const moved = rows.map((one) => ({ ...one, expected: one.item.id === 'w3-1' }));
  if (pack !== null) await showSettingsScreen(<PlanWeekLines rows={moved} pack={pack} paced={null} />, data);
  expect(textOf('plan-week-position')).toBe(text.weekPosition.replace('{{week}}', '2').replace('{{expected}}', '3'));
});

test('keeps guided work in one list', async () => {
  const data = await withPrimary();
  const maths = data.book.state.courses.get('m-1');
  const pack = { id: 'dz.cem.1am.math.example', release: '2026.1' };
  if (maths !== undefined) await data.book.record(day, { kind: 'course.set', course: { ...maths, pack } });
  await showSettingsScreen(<ClassPlan courseId="m-1" />, data);
  expect(settingsTexts()).toContain(catalogues.ar.classPlan.td);
  expect(has('plan-u1-td')).toBe(true);
});
