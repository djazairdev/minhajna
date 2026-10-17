// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Correcting one pupil's roll call (#39): the names on a roll call already
// taken open the correction, but not before it is taken or while a change
// is pending; the screen shows what was recorded, the mark it becomes and a
// coded reason, the change log line and the month's totals, saves a new
// version with its reason, marks an absence justified without its cause,
// and the roll call follows. Made-up pupils only.

import { current, rollCallUnits, takeRollCall, type RollCallUnit } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { unitKey, withPupils } from '../jest/roll-class';
import { key } from '../jest/today-day';
import { Correct } from '../src/roll/Correct';
import { Roll } from '../src/roll/Roll';
import { keepMarks } from '../src/roll/roll-rules';
import { coreContext } from '../src/storage/core-context';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onDone = jest.fn();
const onCorrect = jest.fn();
const thursday = '2026-10-15';

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onDone.mockReset();
  onCorrect.mockReset();
  keepMarks(unitKey(1), null);
});

async function mount(data: TestData, element: React.ReactElement, today = '2026-10-18') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, today)}</LocaleDirContext.Provider>,
    );
  });
}

const context = (data: TestData) => coreContext({ ...data, state: data.book.state });
const unitOne = (data: TestData): RollCallUnit => {
  const unit = rollCallUnits(context(data), 'k-1', thursday as never, thursday as never)[0];
  if (unit === undefined) throw new Error('No unit');
  return unit;
};

/** 45 made-up pupils, with p-1 absent and p-2 late on Thursday's first session. */
async function taken(): Promise<TestData> {
  const data = await withPupils();
  await data.book.record(
    thursday as never,
    takeRollCall(context(data), unitOne(data), { absent: [{ pupilId: 'p-1', justified: false }], late: ['p-2'] }),
  );
  return data;
}

const roll = (data: TestData) =>
  mount(data, <Roll sessionKey={key(1)} day={thursday as never} onDone={onDone} onCorrect={onCorrect} />);
const correct = (data: TestData, pupilId = 'p-1') =>
  mount(data, <Correct unitKey={unitKey(1)} day={thursday as never} pupilId={pupilId} onDone={onDone} />);

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
const pressables = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof (node.props as PressableProps).onPress === 'function');
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (pressables(id)[0]?.props as PressableProps).onPress?.({} as never);
  });
};
const tap = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (
      root().findAll((node) => node.props.testID === id && node.props.accessibilityRole === 'checkbox')[0]
        ?.props as PressableProps
    ).onPress?.({} as never);
  });
};
const disabled = (id: string) =>
  (root().findAll((node) => node.props.testID === id)[0]?.props as { disabled?: boolean }).disabled;

test('opens a pupil from a roll call already taken, but not before, nor with a change pending', async () => {
  const data = await withPupils();
  await roll(data);
  expect(pressables('roll-1-name')).toHaveLength(0);
  await ReactTestRenderer.act(async () => {
    await data.book.record(
      thursday as never,
      takeRollCall(context(data), unitOne(data), { absent: [{ pupilId: 'p-1', justified: false }], late: [] }),
    );
  });
  await roll(data);
  const name = pressables('roll-1-name')[0];
  expect(name?.props.accessibilityLabel).toBe(`تصحيح مناداة ${data.book.state.pupils.get('p-1')?.name}`);
  await press('roll-1-name');
  expect(onCorrect).toHaveBeenCalledWith(expect.objectContaining({ key: unitKey(1) }), 'p-1');
  await tap('roll-3-late');
  expect(pressables('roll-1-name')).toHaveLength(0);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('shows what was recorded and saves the change only with a reason', async () => {
  const data = await taken();
  await correct(data);
  expect(shown()).toEqual(
    expect.arrayContaining([
      'الخميس 15 أكتوبر · ⁧08:00 – 09:00⁩',
      'المسجّل: غياب غير مبرر · سُجّل في 15/10/2026',
      'غياب غير مبرر، كما سُجّل',
      text.correct.justifyNote,
      text.correct.both,
    ]),
  );
  expect(disabled('correct-save')).toBe(true);
  await press('correct-late');
  expect(disabled('correct-save')).toBe(true);
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.correct.logTitle,
      '18/10/2026 · 15 أكتوبر: من غياب غير مبرر إلى تأخر، لا يُحسب غياباً · …',
      expect.stringMatching(/^أكتوبر: غ 1 ← 0 · النسبة .+ ← 100% · ويُضاف تأخر بتاريخه$/),
    ]),
  );
  await press('correct-reason-arrived-late');
  expect(shown()).toContain('18/10/2026 · 15 أكتوبر: من غياب غير مبرر إلى تأخر، لا يُحسب غياباً · الوصول بعد المناداة');
  expect(disabled('correct-save')).toBe(false);
  expect(accessibilityProblems(root())).toEqual([]);
  await press('correct-save');
  const versions = data.book.state.rollCalls.get(unitKey(1));
  expect(versions).toHaveLength(2);
  expect(versions?.[1]).toMatchObject({ day: '2026-10-18', reason: 'arrived-late', value: { absent: [] } });
  expect([...(versions?.[1]?.value.late ?? [])].sort()).toEqual(['p-1', 'p-2']);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('marks an absence justified without its cause', async () => {
  const data = await taken();
  await correct(data);
  await press('correct-justified');
  await press('correct-reason-administration');
  await press('correct-save');
  expect(current(data.book.state.rollCalls.get(unitKey(1)))?.absent).toEqual([{ pupilId: 'p-1', justified: true }]);
});

test('turns lateness into an absence, and leaving the mark as recorded saves nothing', async () => {
  const data = await taken();
  await correct(data, 'p-2');
  expect(shown()).toContain('تأخر، لا يُحسب غياباً، كما سُجّل');
  await press('correct-late');
  await press('correct-reason-entry-error');
  expect(disabled('correct-save')).toBe(true);
  await press('correct-unjustified');
  expect(shown()).toEqual(expect.arrayContaining([expect.stringContaining(text.correct.lateRemoved)]));
});

test('follows a correction saved while the roll call is open', async () => {
  const data = await taken();
  await mount(
    data,
    <>
      <Roll sessionKey={key(1)} day={thursday as never} onDone={onDone} onCorrect={onCorrect} />
      <Correct unitKey={unitKey(1)} day={thursday as never} pupilId="p-1" onDone={onDone} />
    </>,
  );
  const absent = () =>
    root().findAll((node) => node.props.testID === 'roll-1-absent' && node.props.accessibilityRole === 'checkbox')[0]
      ?.props.accessibilityState as { checked: boolean };
  expect(absent()).toEqual({ checked: true });
  await press('correct-present');
  await press('correct-reason-other');
  await press('correct-save');
  for (let tries = 0; tries < 20 && absent().checked; tries += 1) {
    await ReactTestRenderer.act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  }
  expect(data.book.state.rollCalls.get(unitKey(1))).toHaveLength(2);
  expect(absent()).toEqual({ checked: false });
  expect(pressables('roll-1-name')).not.toHaveLength(0);
});

test('says when the pupil has no roll call there', async () => {
  await correct(await withPupils());
  expect(shown()).toEqual([text.correct.unavailable]);
});

test.each(['en', 'fr'] satisfies Language[])('has every correction text in %s', (language) => {
  const keys = (section: object): string[] =>
    Object.entries(section as Record<string, unknown>).flatMap(([name, value]) =>
      typeof value === 'object' && value !== null ? keys(value).map((one) => `${name}.${one}`) : [name],
    );
  expect(keys(catalogues[language].correct).sort()).toEqual(keys(text.correct).sort());
});
