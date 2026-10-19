// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's Month and Month-year screens (#217): the paper book's
// marks for each half-day missed, justified in brackets and «+م½» for a
// whole day half justified (answers 253 and 258); the month's head with its
// Hijri months, its session days up to today, each pupil's marks and totals
// and the class's; a day with two roll calls listing them, each saying
// whether it was taken (answer 255); the months up to today and the yearly
// summary ending at June (answer 255). The teacher has 4م1, with 45 made-up
// pupils, on Thursdays from 11 October 2026, with two sessions that day.

import { DEFAULT_COUNTING, parseDay, type Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { unitKey, withPupils } from '../jest/roll-class';
import { RollMonth, type RollMonthProps } from '../src/rollbook/RollMonth';
import text from '../src/text/ar.json';
import { i18n } from '../src/text/i18n';
import { dayMark } from '../src/rollbook/month-rules';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const DAY = '2026-10-15';
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(data: TestData, props: Partial<RollMonthProps> = {}, dir: 'rtl' | 'ltr' = 'rtl') {
  const all = { courseId: 'c-1', month: '', onMonth: jest.fn(), onRoll: jest.fn(), onRules: jest.fn(), ...props };
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={dir}>{withData(data, <RollMonth {...all} />, DAY)}</LocaleDirContext.Provider>,
    );
    await settle();
  });
  return all;
}

const texts = () =>
  tree!.root.findAllByType(Text).map((node) =>
    [(node.props as TextProps).children as unknown]
      .flat()
      .filter((part) => typeof part === 'string' || typeof part === 'number')
      .join(''),
  );

const control = (testID: string) =>
  tree!.root.findAll(
    (node) => node.props.testID === testID && typeof (node.props as PressableProps).onPress === 'function',
  )[0];

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (control(testID)?.props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

const rollCall = (slot: number, absent: { pupilId: string; justified: boolean }[], late: string[]) => ({
  kind: 'roll-call.taken' as const,
  rollCall: {
    unit: unitKey(slot),
    classId: 'k-1',
    groupId: 'k-1-w',
    day: DAY as Day,
    half: 'morning' as const,
    absent,
    late,
  },
});

const nameOf = (data: TestData, id: string) => data.book.state.pupils.get(id)?.name ?? '';

const label = (testID: string) =>
  (tree!.root.findByProps({ testID }).props as { accessibilityLabel?: string }).accessibilityLabel;

test('writes each half-day missed as the paper book does', () => {
  const m = (justified: boolean) => ({ half: 'morning' as const, justified });
  const a = (justified: boolean) => ({ half: 'afternoon' as const, justified });
  expect([
    dayMark([]),
    dayMark([m(false)]),
    dayMark([a(false)]),
    dayMark([m(true)]),
    dayMark([a(true)]),
    dayMark([m(false), a(false)]),
    dayMark([m(true), a(true)]),
    dayMark([m(true), a(false)]),
    dayMark([m(false), a(true)]),
  ]).toEqual([null, '-', 'ǀ', '(-)', '(ǀ)', '+', '(+)', '+م½', '+م½']);
});

test('shows the month so far with its Hijri months, each pupil marked and the totals in half-days', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay(DAY), [
    rollCall(1, [{ pupilId: 'p-3', justified: false }], ['p-4']),
    rollCall(
      2,
      [
        { pupilId: 'p-3', justified: false },
        { pupilId: 'p-5', justified: true },
      ],
      ['p-4'],
    ),
  ]);
  await mount(data);
  const rate = Math.round(((45 - 2) / 45) * 1000) / 10;
  expect(texts()).toEqual(
    expect.arrayContaining([
      'أكتوبر 2026 · ربيع الثاني – جمادى الأولى 1448',
      'سبتمبر',
      'أكتوبر',
      'الملخص السنوي',
      '15',
      'خ',
      '(-)',
      `ح-ك 1 لكل تلميذ · المجموع غيابان من 45 · الحضور \u2066${rate}%\u2069.`,
    ]),
  );
  expect(texts().filter((line) => line === '-')).toHaveLength(1);
  expect(tree!.root.findAllByProps({ testID: 'month-day-2026-10-22' })).toEqual([]);
  expect(label('month-pupil-p-3')).toBe(`3 ${nameOf(data, 'p-3')}: غياب واحد، لا تأخر. الخميس 15 أكتوبر صباحاً`);
  expect(label('month-pupil-p-4')).toBe(`4 ${nameOf(data, 'p-4')}: لا غياب، تأخران`);
  expect(label('month-pupil-p-5')).toBe(`5 ${nameOf(data, 'p-5')}: غياب واحد، لا تأخر. الخميس 15 أكتوبر صباحاً، مبرر`);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('a day with two roll calls lists them, each saying whether it was taken, and opens the one chosen', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay(DAY), [rollCall(1, [], [])]);
  const props = await mount(data);
  await press('month-day-2026-10-15');
  expect(tree!.root.findByProps({ testID: 'month-day-sheet' }).props.visible).toBe(true);
  expect(texts()).toEqual(expect.arrayContaining(['حصص الخميس 15 أكتوبر', 'المناداة محفوظة', 'لم تُؤخذ المناداة بعد']));
  await press(`month-unit-${unitKey(2)}`);
  expect(props.onRoll).toHaveBeenCalledWith(expect.objectContaining({ day: DAY, slot: { half: 'morning', index: 2 } }));
  expect(tree!.root.findByProps({ testID: 'month-day-sheet' }).props.visible).toBe(false);
});

test('a roll call the timetable no longer gives keeps its day, listed but not opened; a start date is said', async () => {
  const data = await withPupils();
  const gone = { ...rollCall(1, [{ pupilId: 'p-3', justified: false }], []).rollCall };
  await data.book.recordAll(parseDay(DAY), [
    {
      kind: 'roll-call.taken',
      rollCall: { ...gone, unit: 'session:c-1/2026-10-14/m1/k-1-w', day: '2026-10-14' as Day },
    },
    { kind: 'counting.set', rules: { ...DEFAULT_COUNTING, from: parseDay('2026-10-12') } },
  ]);
  const props = await mount(data);
  expect(tree!.root.findAllByProps({ testID: 'month-day-2026-10-14' })).not.toEqual([]);
  expect(label('month-pupil-p-3')).toBe(`3 ${nameOf(data, 'p-3')}: غياب واحد، لا تأخر. الأربعاء 14 أكتوبر صباحاً`);
  expect(texts()).toContain('يبدأ العدّ في الإثنين 12 أكتوبر حسب قواعد العدّ، فلا تظهر الغيابات قبله.');
  await press('month-day-2026-10-14');
  expect(texts()).toEqual(expect.arrayContaining(['صباحاً', text.rollBook.gone]));
  expect(control('month-unit-session:c-1/2026-10-14/m1/k-1-w')?.props.disabled).toBe(true);
  await press('month-unit-session:c-1/2026-10-14/m1/k-1-w');
  expect(props.onRoll).not.toHaveBeenCalled();
});

test('switches month and opens the counting rules; a month with no session yet says so', async () => {
  const props = await mount(await withPupils(), { month: '2026-09' });
  expect(texts()).toContain('لا حصة للقسم في هذا الشهر حتى اليوم.');
  expect(texts()).toContain('سبتمبر 2026 · ربيع الأول – ربيع الثاني 1448');
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID: 'month-switch' }).props as { onSelect: (value: string) => void }).onSelect(
      'year',
    );
    await settle();
  });
  await press('month-rules');
  expect(props.onMonth).toHaveBeenCalledWith('year');
  expect(props.onRules).toHaveBeenCalledTimes(1);
});

test('the yearly summary gives each month and the year, ending in June, with the class totals', async () => {
  const data = await withPupils();
  await data.book.recordAll(parseDay(DAY), [
    rollCall(1, [{ pupilId: 'p-3', justified: false }], []),
    rollCall(2, [], []),
  ]);
  await mount(data, { month: 'year' });
  expect(texts()).toContain('الملخص السنوي · سبتمبر 2026 – جوان 2027');
  expect(tree!.root.findAllByProps({ testID: 'year-month-2027-06' })).not.toEqual([]);
  expect(tree!.root.findAllByProps({ testID: 'year-month-2027-07' })).toEqual([]);
  expect(label('year-pupil-p-3')).toBe(`3 ${nameOf(data, 'p-3')}: غياب واحد، الحضور الفعلي 0، النسبة 0%`);
  expect(label('year-pupil-p-1')).toBe(`1 ${nameOf(data, 'p-1')}: لا غياب، الحضور الفعلي 1، النسبة 100%`);
  const group = (month: string) =>
    tree!.root
      .findByProps({ testID: `year-month-${month}` })
      .findAllByType(Text)
      .map((node) => {
        const children = (node.props as TextProps).children;
        return typeof children === 'string' ? children : '';
      });
  const rate = String(Math.round((44 / 45) * 1000) / 10);
  expect(group('2026-10')).toEqual(expect.arrayContaining(['أكتوبر', '45', '1', '44', rate]));
  expect(group('2026-11').filter((figure) => figure !== '')).toEqual(['نوفمبر', 'ح-ك', 'غ', 'ح-ف', '%']);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('reads in French, left to right, with every control named', async () => {
  await i18n.changeLanguage('fr');
  const data = await withPupils();
  await data.book.recordAll(parseDay(DAY), [rollCall(1, [{ pupilId: 'p-3', justified: true }], [])]);
  await mount(data, {}, 'ltr');
  expect(texts()).toEqual(expect.arrayContaining(['octobre 2026 · Rabie Ethani – Djoumada El Oula 1448', '(-)', 'J']));
  expect(label('month-day-2026-10-15')).toBe('Jeudi 15 octobre, ouvrir l’appel');
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});
