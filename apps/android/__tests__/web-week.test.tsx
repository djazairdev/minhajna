// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The week on a PC (#251, answers 526 and 527): the week's title, its count and
// its days, today's named; the week opening on the first session still to
// confirm, shown in the side pane with what the plan proposes; another session
// chosen; a recorded one in ink, with what it wrote and that it can be
// corrected; the weeks after and before, a later session proposed and a
// holiday's taken by the calendar with nothing to count; the week's print, from
// the current week only; the weeks stopping at the school year's edges; a
// continued lesson's note; a chosen session that is gone giving way; the week a
// tab on a PC only, after Today; and every new text in French and English.
// Made-up records.

import { confirmSessions, parseDay, todayView } from '@minhajna/core';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Platform } from 'react-native';
import { context, mount, press, root, texts, unmount } from '../jest/components-screen';
import { withPupils } from '../jest/roll-class';
import { HomeTabs } from '../src/navigation/HomeTabs';
import { BottomNav } from '../src/navigation/NavigationChrome';
import text from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { i18n } from '../src/text/i18n';
import { bundledReference, readReference } from '../src/reference';
import { dayAndMonth } from '../src/today/DayMark';
import { PcWeek } from '../src/week/pc/PcWeek';
import { WeekPane } from '../src/week/pc/WeekPane';

jest.mock('../src/navigation/RecordScreens', () => ({ TodayTab: () => null, ClassesTabScreen: () => null }));
jest.mock('../src/navigation/DocumentScreens', () => ({ DocumentsTabScreen: () => null }));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});
afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

const DAY = parseDay('2026-10-15');
const reference = readReference(bundledReference);
const profile = reference.ok ? reference.profile : null!;
const key = (course: string, day: string, slot: number) =>
  `${course}/${day}/m${slot}/${course === 'c-1' ? 'k-1' : 'k-2'}-w`;
const cell = (sessionKey: string) => `week-cell-${sessionKey}`;
const selected = (sessionKey: string) =>
  root().findAll((node) => node.props.testID === cell(sessionKey) && node.props['aria-checked'] !== undefined)[0]
    ?.props['aria-checked'] as boolean | undefined;
const disabled = (testID: string) =>
  (
    root().findAll((node) => node.props.testID === testID && node.props.accessibilityState !== undefined)[0]?.props
      .accessibilityState as { disabled?: boolean } | undefined
  )?.disabled === true;
const pane = () =>
  root()
    .findAll((node) => node.props.testID === 'week-pane')[0]
    .findAll((node) => typeof node.props.children === 'string')
    .map((node) => node.props.children as string);
/** The week's title, from the day of the month to a day with its month and year. */
const title = (from: string, to: string) =>
  i18n.t('pcWeek.title', { from, to: `${dayAndMonth(parseDay(to), 'ar', profile)} ${to.slice(0, 4)}` });
const heading = () => title('11', '2026-10-15');

test('the week opens on its first session to confirm, shown in the pane with its proposal', async () => {
  await mount(await withPupils(), <PcWeek onPrint={jest.fn()} />);
  expect(texts()).toEqual(
    expect.arrayContaining([
      heading(),
      i18n.t('pcWeek.summary', { sessions: i18n.t('count.sessions', { count: 3 }), recorded: 0 }),
      `${text.week.days[0]} 11`,
      `${text.week.days[4]} 15 · ${text.navigation.today}`,
    ]),
  );
  const first = key('c-1', '2026-10-15', 1);
  expect(selected(first)).toBe(true);
  expect(selected(key('c-1', '2026-10-15', 2))).toBe(false);
  expect(pane()).toContain(text.pcWeek.state.awaiting);
  expect(root().findAll((node) => node.props.testID === 'week-pane-proposal').length).toBeGreaterThan(0);
});

test('another session chosen shows in the pane', async () => {
  await mount(await withPupils(), <PcWeek onPrint={jest.fn()} />);
  const other = key('c-2', '2026-10-15', 3);
  await press(cell(other));
  expect(selected(other)).toBe(true);
  expect(selected(key('c-1', '2026-10-15', 1))).toBe(false);
  expect(pane()).toContain(text.today.noProposal);
});

test('a recorded session reads in ink, with what it wrote and that it can be corrected', async () => {
  const data = await withPupils();
  const view = todayView(context(data), DAY);
  const [first] = view.sessions;
  await data.book.recordAll(
    DAY,
    confirmSessions(context(data), [{ session: first.session, choice: { outcome: 'not-held' } }]),
  );
  await mount(data, <PcWeek onPrint={jest.fn()} />);
  expect(texts()).toContain(
    i18n.t('pcWeek.summary', { sessions: i18n.t('count.sessions', { count: 3 }), recorded: 1 }),
  );
  expect(selected(key('c-1', '2026-10-15', 2))).toBe(true);
  await press(cell(first.session.key));
  expect(pane()).toEqual(expect.arrayContaining([text.today.notHeld, text.pcWeek.state.recorded, text.pcWeek.fixNote]));
});

test('the next week is proposed, a holiday week has nothing to count, and the week before comes back', async () => {
  await mount(await withPupils(), <PcWeek onPrint={jest.fn()} />);
  await press('week-after');
  expect(texts()).toContain(title('18', '2026-10-22'));
  expect(pane()).toContain(text.pcWeek.state.proposed);
  await press('week-after');
  expect(texts()).toContain(text.pcWeek.none);
  expect(pane()).toContain(text.pcWeek.state.calendar);
  await press('week-before', 'week-before');
  expect(texts()).toContain(heading());
});

test("the print opens the week's print set, from the current week only", async () => {
  const onPrint = jest.fn();
  await mount(await withPupils(), <PcWeek onPrint={onPrint} />);
  await press('week-print');
  expect(onPrint).toHaveBeenCalledTimes(1);
  await press('week-after');
  expect(root().findAll((node) => node.props.testID === 'week-print')).toHaveLength(0);
});

test("the weeks stop at the school year's edges", async () => {
  const data = await withPupils();
  await mount(data, <PcWeek onPrint={jest.fn()} />, data.year.from);
  expect(disabled('week-before')).toBe(true);
  expect(disabled('week-after')).toBe(false);
  await unmount();
  await mount(data, <PcWeek onPrint={jest.fn()} />, data.year.to);
  expect(disabled('week-after')).toBe(true);
});

test('a lesson continued says where it goes on from', async () => {
  const data = await withPupils();
  const view = todayView(context(data), DAY);
  const first = view.sessions[0];
  const item = {
    ...first,
    proposal: { ...first.proposal!, continued: true, from: 1, stageNames: ['Made-up stage 1', 'Made-up stage 2'] },
  };
  const words = {
    data: { state: data.book.state, profile: data.profile, bells: data.bells, calendar: data.calendar },
    context: context(data),
    t: i18n.t,
    direction: 'rtl' as const,
    language: 'ar' as const,
    today: DAY,
  };
  await mount(data, <WeekPane words={words} view={view} item={item} />);
  expect(pane()).toContain(i18n.t('today.continuedNote', { stage: 'Made-up stage 2' }));
});

test('a chosen session that is gone gives way to the first to confirm', async () => {
  await mount(await withPupils(), <PcWeek onPrint={jest.fn()} />);
  const other = key('c-2', '2026-10-15', 3);
  await press(cell(other));
  expect(selected(other)).toBe(true);
  await unmount();
  const data = await withPupils();
  await data.book.record(DAY, {
    kind: 'timetable.set',
    version: {
      ...data.book.state.timetables[0].version,
      id: 'v-2',
      from: parseDay('2026-10-11'),
      entries: data.book.state.timetables[0].version.entries.filter((entry) => entry.courseId === 'c-1'),
    },
  });
  await mount(data, <PcWeek onPrint={jest.fn()} />);
  expect(selected(other)).toBeUndefined();
  expect(selected(key('c-1', '2026-10-15', 1))).toBe(true);
});

test('the week is a tab on a PC, after Today, and not on the phone', async () => {
  await mount(
    await withPupils(),
    <NavigationContainer>
      <HomeTabs />
    </NavigationContainer>,
  );
  const rail = root()
    .findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('rail-'))
    .map((node) => node.props.testID as string)
    .filter((id, index, all) => all.indexOf(id) === index);
  expect(rail.slice(0, 3)).toEqual(['rail-Today', 'rail-PcWeek', 'rail-Classes']);
  expect(texts()).toContain(text.navigation.week);
  await unmount();
  jest.replaceProperty(Platform, 'OS', 'android');
  const routes = (['Today', 'Classes', 'Documents'] as const).map((name) => ({ key: name, name }));
  const props = {
    state: { index: 0, routes },
    descriptors: Object.fromEntries(routes.map((route) => [route.key, { options: { title: route.name } }])),
    navigation: { emit: () => ({ defaultPrevented: false }), navigate: jest.fn() },
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as BottomTabBarProps;
  await mount(await withPupils(), <BottomNav {...props} />);
  expect(root().findAll((node) => node.props.testID === 'tab-PcWeek')).toHaveLength(0);
});

test('every new text is in French and English', () => {
  const flat = (value: object, at = ''): [string, string][] =>
    Object.entries(value).flatMap(([name, one]) =>
      typeof one === 'string' ? [[`${at}${name}`, one] as [string, string]] : flat(one as object, `${at}${name}.`),
    );
  const arabic = new Map(flat(text.pcWeek));
  for (const other of [fr, en]) {
    expect(flat(other.pcWeek).map(([name]) => name)).toEqual([...arabic.keys()]);
    for (const [name, value] of flat(other.pcWeek)) {
      if (!value.startsWith('{{')) expect(value).not.toBe(arabic.get(name));
    }
    expect(other.navigation.week).not.toBe(text.navigation.week);
  }
});
