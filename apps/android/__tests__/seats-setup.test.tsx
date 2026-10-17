// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The seating plan's setup (#41, Roll-seats-setup): the first use, filling
// the seats in list order, placing, moving and unseating a pupil, the
// room's shape, emptying the seats with an undo, a plan per group, the
// link from the roll call, the given names on seats, and every text in
// each language. Made-up pupils only.

import { parseDay, type SeatingPlan } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withPupils } from '../jest/roll-class';
import { key } from '../jest/today-day';
import { Roll } from '../src/roll/Roll';
import { keepMarks } from '../src/roll/roll-rules';
import { givenName } from '../src/seats/seat-names';
import { SeatsSetup } from '../src/seats/SeatsSetup';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  keepMarks(`session:${key(1)}`, null);
});

async function mount(data: TestData, element: React.ReactElement) {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, '2026-10-15')}</LocaleDirContext.Provider>,
    );
  });
}

const settle = () => ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
const node = (id: string) =>
  root().findAll((one) => one.props.testID === id && typeof (one.props as PressableProps).onPress === 'function')[0];
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (node(id)?.props as PressableProps).onPress?.({} as never);
  });
  await settle();
};
const spoken = (id: string) => node(id)?.props.accessibilityLabel as string;
const setup = (data: TestData, groupId = 'k-1-w') => mount(data, <SeatsSetup classId="k-1" groupId={groupId} />);
const plan = (data: TestData, groupId = 'k-1-w'): SeatingPlan | null =>
  data.book.state.seating.get(`k-1/${groupId}`) ?? null;
const seated = (one: SeatingPlan | null) =>
  [...(one?.seats ?? [])].sort((a, b) => a.row - b.row || a.column - b.column).map((seat) => seat.pupilId);

test('starts empty, then fills the seats in list order from the board', async () => {
  const data = await withPupils();
  await setup(data);
  expect(shown()).toEqual(
    expect.arrayContaining([
      `4م1 · ${text.seats.firstUse}`,
      '45 تلميذاً · لحصص القسم كله',
      '36 مقعداً · فارغ منها 36. يتّسع المخطط حتى 120 تلميذاً: 12 صفاً من 10 مقاعد.',
      'دون مقعد بعد: 45',
    ]),
  );
  expect(spoken('seats-grid-0-0')).toBe('الصف 1، المقعد 1: فارغ');
  expect(accessibilityProblems(root())).toEqual([]);
  await press('seats-fill');
  expect(seated(plan(data))).toHaveLength(36);
  expect(seated(plan(data)).slice(0, 2)).toEqual(['p-1', 'p-2']);
  expect(spoken('seats-grid-0-1')).toBe('الصف 1، المقعد 2: 2 مختلق آية');
  expect(shown()).toEqual(
    expect.arrayContaining([
      '2',
      'آية',
      'دون مقعد بعد: 9',
      '36 مقعداً · فارغ منها 0. يتّسع المخطط حتى 120 تلميذاً: 12 صفاً من 10 مقاعد.',
    ]),
  );
  expect(shown()).not.toContain(`4م1 · ${text.seats.firstUse}`);
});

test('places a chosen pupil, moves one seated, and empties a seat', async () => {
  const data = await withPupils();
  await setup(data);
  await press('seats-unseated-p-7');
  expect(shown()).toContain('اختير «تجريبي آية»: لمسة على مقعد، أو على الاسم نفسه للتراجع.');
  await press('seats-grid-2-3');
  await press('seats-unseated-p-8');
  await press('seats-grid-0-0');
  expect(plan(data)?.seats).toEqual(
    expect.arrayContaining([
      { row: 2, column: 3, pupilId: 'p-7' },
      { row: 0, column: 0, pupilId: 'p-8' },
    ]),
  );
  await press('seats-grid-2-3');
  expect(node('seats-grid-2-3')?.props.accessibilityState).toEqual({ selected: true });
  await press('seats-grid-0-0');
  expect(seated(plan(data))).toEqual(['p-7', 'p-8']);
  expect(plan(data)?.seats).toEqual(expect.arrayContaining([{ row: 0, column: 0, pupilId: 'p-7' }]));
  await press('seats-grid-0-0');
  await press('seats-grid-0-0');
  expect(seated(plan(data))).toEqual(['p-8']);
});

test('shapes the room: rows, seats in each row and aisles', async () => {
  const data = await withPupils();
  await setup(data);
  await press('seats-fill');
  await press('seats-rows-increase');
  expect(plan(data)?.rows).toBe(7);
  await press('seats-columns-decrease');
  expect([plan(data)?.columns, seated(plan(data)).length]).toEqual([5, 30]);
  await press('seats-aisles-3');
  expect(plan(data)?.aisleEvery).toBe(3);
  await press('seats-aisles-0');
  expect(plan(data)?.aisleEvery).toBe(0);
});

test('empties every seat, with an undo', async () => {
  const data = await withPupils();
  await setup(data);
  await press('seats-fill');
  await press('seats-empty');
  expect(seated(plan(data))).toEqual([]);
  expect(shown()).toContain(text.seats.emptied);
  await ReactTestRenderer.act(() => {
    const undo = root().findAll(
      (one) => one.props.accessibilityLabel === text.seats.undo && typeof one.props.onPress === 'function',
    )[0];
    (undo?.props as PressableProps).onPress?.({} as never);
  });
  expect(seated(plan(data))).toHaveLength(36);
  expect(shown()).not.toContain(text.seats.emptied);
});

test('keeps one plan per group', async () => {
  const data = await withPupils();
  const halves = [
    { id: 'k-1-w', kind: 'whole', name: '4م1' },
    { id: 'k-1-a', kind: 'half', name: 'الفوج 1' },
    { id: 'k-1-b', kind: 'half', name: 'الفوج 2' },
  ] as const;
  const schoolClass = data.book.state.classes.get('k-1')!;
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'class.set',
    schoolClass: { ...schoolClass, groups: halves },
  });
  for (const id of ['p-1', 'p-2', 'p-3']) {
    const pupil = data.book.state.pupils.get(id)!;
    await data.book.record(parseDay('2026-10-15'), { kind: 'pupil.set', pupil: { ...pupil, groups: ['k-1-a'] } });
  }
  await setup(data);
  await press('seats-group-k-1-a');
  expect(shown()).toContain('3 تلاميذ · لحصص الفوج 1');
  await press('seats-fill');
  expect(seated(plan(data, 'k-1-a'))).toEqual(['p-1', 'p-2', 'p-3']);
  expect(plan(data)).toBeNull();
});

test('opens from the roll call, for the unit’s group', async () => {
  const onSeats = jest.fn();
  await mount(
    await withPupils(),
    <Roll sessionKey={key(1)} day={'2026-10-15' as never} onDone={jest.fn()} onSeats={onSeats} />,
  );
  await press('roll-seats');
  expect(onSeats).toHaveBeenCalledWith('k-1', 'k-1-w');
});

test('shows the given name on a seat, after a family name and its particles', () => {
  expect(givenName('بوعلام زكرياء')).toBe('زكرياء');
  expect(givenName('بن عبد الرحمن فاطمة الزهراء')).toBe('فاطمة الزهراء');
  expect(givenName('عبد اللاوي رؤوف')).toBe('رؤوف');
  expect(givenName('زروقي محمد أمين')).toBe('محمد أمين');
  expect(givenName('Ait Messaoud Amina')).toBe('Amina');
  expect(givenName('ريان')).toBe('ريان');
});

test.each(['en', 'fr'] satisfies Language[])('has every seats text in %s', (language) => {
  const keys = (section: object) =>
    Object.keys(section)
      .map((name) => name.replace(/_(zero|one|two|few|many|other)$/, ''))
      .filter((name, index, all) => all.indexOf(name) === index)
      .sort();
  expect(keys(catalogues[language].seats)).toEqual(keys(text.seats));
});
