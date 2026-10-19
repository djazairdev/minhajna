// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مخطط الجلوس» (#217, Roll-print, answers 254 and 265): every plan of the
// class, the whole class's first, one page each, the board on top, seats
// with full names, aisles, and empty boxes for empty seats and pupils who
// left; landscape for a wide room; the choice only for a class with a plan;
// and the seating setup screen's print icon, which prints its plan alone.
// 4م1 has 45 made-up pupils; today is Sunday 18 October 2026.

import { parseDay, type SeatingPlan } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withPupils } from '../jest/roll-class';
import pdf from '../src/native/NativeMinhajnaPdf';
import { SeatsSetupScreen } from '../src/navigation/RecordScreens';
import { RollPrint, type RollPrintProps } from '../src/rollbook/RollPrint';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const makePdf = jest.spyOn(pdf, 'makePdf');
const savePdf = jest.spyOn(pdf, 'savePdf');
const TODAY = '2026-10-18';
let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  jest.clearAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(data: TestData, props: RollPrintProps) {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <RollPrint {...props} />, TODAY)}
      </LocaleDirContext.Provider>,
    );
    await settle();
  });
}

const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;

async function save(): Promise<{ html: string; made: string; landscape: boolean }> {
  await ReactTestRenderer.act(async () => {
    const button = tree!.root.findAll(
      (node) => node.props.testID === 'roll-print-save' && typeof (node.props as PressableProps).onPress === 'function',
    )[0];
    (button?.props as PressableProps).onPress?.({} as never);
    await settle();
  });
  const [html, made, landscape] = makePdf.mock.calls.at(-1)!;
  return { html, made, landscape };
}

const plan = (groupId: string, columns: number, seats: [number, number, string][]): SeatingPlan => ({
  classId: 'k-1',
  groupId,
  rows: 2,
  columns,
  aisleEvery: 2,
  seats: seats.map(([row, column, pupilId]) => ({ row, column, pupilId })),
});

/** 4م1 with a half group k-1-a of p-2, p-3 gone since 12 October, and the plans given. */
async function withPlans(plans: SeatingPlan[]): Promise<TestData> {
  const data = await withPupils();
  const schoolClass = data.book.state.classes.get('k-1')!;
  const gone = data.book.state.pupils.get('p-3')!;
  const half = data.book.state.pupils.get('p-2')!;
  await data.book.recordAll(parseDay('2026-10-11'), [
    {
      kind: 'class.set',
      schoolClass: { ...schoolClass, groups: [...schoolClass.groups, { id: 'k-1-a', kind: 'half', name: 'الفوج 1' }] },
    },
    { kind: 'pupil.set', pupil: { ...half, groups: ['k-1-a'] } },
    {
      kind: 'pupil.set',
      pupil: { ...gone, movements: [{ day: parseDay('2026-10-12'), kind: 'out', reason: 'تحويل', confirmed: true }] },
    },
    ...plans.map((one) => ({ kind: 'seating.set' as const, plan: one })),
  ]);
  return data;
}

const name = (data: TestData, id: string) => data.book.state.pupils.get(id)!.name;
const seats = (page: string) => [...page.matchAll(/<td class="seat">([^<]*)<\/td>/g)].map((match) => match[1]);

test('every plan prints on its own page, the whole class’s first, with names, aisles and empty boxes', async () => {
  const data = await withPlans([
    plan('k-1-a', 4, [[0, 0, 'p-2']]),
    plan('k-1-w', 4, [
      [0, 0, 'p-1'],
      [0, 1, 'p-2'],
      [1, 0, 'p-3'],
      [1, 3, 'p-45'],
    ]),
  ]);
  await mount(data, { courseId: 'c-1', choice: 'seats' });
  expect(has('roll-print-version')).toBe(false);
  expect(has('roll-print-signature')).toBe(false);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  const { html, made, landscape } = await save();
  expect([made, landscape]).toEqual(['roll-seats', false]);
  const pages = html.split('<section class="page"').slice(1);
  expect(pages).toHaveLength(2);
  expect(pages[0]).toContain(`<div class="board">${text.seats.board}</div>`);
  expect(seats(pages[0])).toEqual([name(data, 'p-1'), name(data, 'p-2'), '', '', '', '', '', name(data, 'p-45')]);
  expect(pages[0].match(/<td class="aisle"><\/td>/g)).toHaveLength(2);
  expect(pages[1]).toContain('الفوج 1');
  expect(seats(pages[1])).toEqual([name(data, 'p-2'), '', '', '', '', '', '', '']);
  expect(html).toContain(text.documents.confidential);
});

test('a room more than six seats wide prints landscape, and a class with no plan has no seating choice', async () => {
  await mount(await withPlans([plan('k-1-w', 8, [])]), { courseId: 'c-1', choice: 'seats' });
  expect((await save()).landscape).toBe(true);
  await ReactTestRenderer.act(() => tree?.unmount());
  await mount(await withPupils(), { courseId: 'c-1', choice: 'seats' });
  expect(has('roll-print-what-seats')).toBe(false);
  expect(tree!.root.findByProps({ testID: 'roll-print-what' }).props.selected).toBe('spread');
});

test('the seating setup screen’s icon prints its plan alone, and shows only once the plan exists', async () => {
  let options: { headerRight?: () => React.ReactElement } | undefined;
  const navigation = {
    setOptions: (next: typeof options) => {
      options = next;
    },
    navigate: jest.fn(),
    goBack: jest.fn(),
  };
  const open = async (data: TestData, groupId: string) => {
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <LocaleDirContext.Provider value="rtl">
          {withData(
            data,
            <SeatsSetupScreen
              navigation={navigation as never}
              route={{ key: 's', name: 'SeatsSetup', params: { classId: 'k-1', groupId } } as never}
            />,
            TODAY,
          )}
        </LocaleDirContext.Provider>,
      );
      await settle();
    });
  };
  const data = await withPlans([plan('k-1-w', 4, [[0, 0, 'p-1']]), plan('k-1-a', 4, [[0, 0, 'p-2']])]);
  await open(data, 'k-1-a');
  const icon = options?.headerRight?.().props as PressableProps & { accessibilityLabel: string };
  expect(icon.accessibilityLabel).toBe(text.rollPrint.seats.open);
  icon.onPress?.({} as never);
  expect(navigation.navigate).toHaveBeenCalledWith('RollPrint', { classId: 'k-1', plan: 'k-1-a', choice: 'seats' });
  await ReactTestRenderer.act(() => tree?.unmount());
  await mount(data, { classId: 'k-1', plan: 'k-1-a', choice: 'seats' });
  const pages = (await save()).html.split('<section class="page"').slice(1);
  expect(savePdf.mock.calls.at(-1)?.[1]).toContain('مخطط الجلوس الفوج 1');
  expect(pages).toHaveLength(1);
  expect(pages[0]).toContain('الفوج 1');
  await ReactTestRenderer.act(() => tree?.unmount());
  await open(await withPupils(), 'k-1-w');
  expect(options?.headerRight).toBeUndefined();
});
