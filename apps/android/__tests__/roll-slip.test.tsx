// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «ورقة غياب الحصة» (#217, Roll-print, answers 254 and 264): the slip of one
// taken roll call lists only its absent and late pupils, in list order, on
// the top half of a page with a cut line, or says nobody was; Roll-print
// offers it for a class called per session, steps through taken days and
// picks the session by chips; the Roll screen's icon opens it once the roll
// call is taken. 4م1 has 45 made-up pupils and two sessions on Thursdays
// from 11 October 2026; today is Sunday 18 October.

import { parseDay, type Day } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type { PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { unitKey, withPupils } from '../jest/roll-class';
import pdf from '../src/native/NativeMinhajnaPdf';
import { RollScreen } from '../src/navigation/RecordScreens';
import { RollPrint, type RollPrintProps } from '../src/rollbook/RollPrint';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const makePdf = jest.spyOn(pdf, 'makePdf');
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

const control = (testID: string) =>
  tree!.root.findAll(
    (node) => node.props.testID === testID && typeof (node.props as PressableProps).onPress === 'function',
  )[0];

const has = (testID: string) => tree!.root.findAllByProps({ testID }).length > 0;

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (control(testID)?.props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function select(testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID }).props as { onSelect: (value: string) => void }).onSelect(value);
    await settle();
  });
}

const taken = (slot: number, absent: { id: string; justified: boolean }[], late: string[]) => ({
  kind: 'roll-call.taken' as const,
  rollCall: {
    unit: unitKey(slot),
    classId: 'k-1',
    groupId: 'k-1-w',
    day: '2026-10-15' as Day,
    half: 'morning' as const,
    absent: absent.map((one) => ({ pupilId: one.id, justified: one.justified })),
    late,
  },
});

async function withSlips(): Promise<TestData> {
  const data = await withPupils();
  await data.book.recordAll(parseDay('2026-10-15'), [
    taken(
      1,
      [
        { id: 'p-5', justified: true },
        { id: 'p-3', justified: false },
      ],
      ['p-2'],
    ),
    taken(2, [], []),
  ]);
  return data;
}

async function saved(): Promise<{ html: string; made: string }> {
  await press('roll-print-save');
  const [html, made] = makePdf.mock.calls.at(-1)!;
  return { html, made };
}

test('the slip lists only the absent and late pupils in list order, on the top half with a cut line', async () => {
  const data = await withSlips();
  const name = (id: string) => data.book.state.pupils.get(id)!.name;
  await mount(data, { courseId: 'c-1', choice: 'slip' });
  expect(has('roll-print-version')).toBe(false);
  expect(has('roll-print-signature')).toBe(false);
  expect(has('roll-print-slip')).toBe(true);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  const { html, made } = await saved();
  expect(made).toBe('roll-slip-2026-10-15-morning-1-k1w');
  const rows = [...html.matchAll(/<tr><td class="n">(\d+)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)];
  expect(rows.map((row) => [row[1], row[2], row[3]])).toEqual([
    ['2', name('p-2'), text.rollPrint.slip.late],
    ['3', name('p-3'), text.rollPrint.slip.absent],
    ['5', name('p-5'), text.rollPrint.slip.justified],
  ]);
  expect(html).not.toContain(name('p-1'));
  expect(html).toContain(text.rollPrint.slip.supervisor);
  expect(html).toContain('<div class="cut"></div>');
  expect(html).toContain('الخميس 15 أكتوبر 2026');
});

test('the day’s other session is picked by its chip, and a session with nobody marked says so', async () => {
  await mount(await withSlips(), { courseId: 'c-1', choice: 'slip' });
  expect(control('roll-print-slip-before')?.props.disabled).toBe(true);
  expect(control('roll-print-slip-after')?.props.disabled).toBe(true);
  await select('roll-print-slip-session', unitKey(2));
  const { html, made } = await saved();
  expect(made).toBe('roll-slip-2026-10-15-morning-2-k1w');
  expect(html).toContain(`<p class="none">${text.rollPrint.slip.none}</p>`);
  expect(html).not.toContain('<table class="slip-list"');
});

test('with no roll call taken the slip cannot print, and a class called by half-days has no slip', async () => {
  const data = await withPupils();
  await mount(data, { courseId: 'c-1', choice: 'slip' });
  expect(tree!.root.findByProps({ testID: 'roll-print-empty' }).props.message).toBe(text.rollPrint.slip.empty);
  expect(control('roll-print-save')?.props.disabled).toBe(true);
  const schoolClass = data.book.state.classes.get('k-1')!;
  await data.book.record(parseDay('2026-10-11'), {
    kind: 'class.set',
    schoolClass: { ...schoolClass, rollCallUnit: 'half-day' },
  });
  await ReactTestRenderer.act(() => tree?.unmount());
  await mount(data, { courseId: 'c-1', choice: 'slip' });
  expect(has('roll-print-what-slip')).toBe(false);
  expect(tree!.root.findByProps({ testID: 'roll-print-what' }).props.selected).toBe('spread');
});

test('once its roll call is taken, the Roll screen’s icon opens that session’s slip', async () => {
  let options: { headerRight: () => React.ReactElement } | undefined;
  const navigation = {
    setOptions: (next: typeof options) => {
      options = next;
    },
    navigate: jest.fn(),
    goBack: jest.fn(),
  };
  const params = { key: 'c-1/2026-10-15/m1/k-1-w', day: '2026-10-15', courseId: 'c-1' };
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(
          await withSlips(),
          <RollScreen navigation={navigation as never} route={{ key: 'r', name: 'Roll', params } as never} />,
          TODAY,
        )}
      </LocaleDirContext.Provider>,
    );
    await settle();
  });
  const icon = options?.headerRight().props as PressableProps & { accessibilityLabel: string };
  expect(icon.accessibilityLabel).toBe(text.rollPrint.slip.open);
  icon.onPress?.({} as never);
  expect(navigation.navigate).toHaveBeenCalledWith('RollPrint', {
    courseId: 'c-1',
    day: '2026-10-15',
    choice: 'slip',
    unit: unitKey(1),
  });
});
