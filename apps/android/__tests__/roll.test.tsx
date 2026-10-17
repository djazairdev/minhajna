// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Roll screen (#38): everyone present by default, a tap for an absence
// or a lateness and the figures following, absent and late excluding each
// other, one save that records the exceptions only, the marks kept when the
// screen is left, a past session entered from the paper sheet on its own
// date, a roll call already taken corrected with a reason, a session with
// no roll call, and the strip on Today's cards but for a session not held.
// Made-up pupils only.

import { current } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { unitKey, withPupils } from '../jest/roll-class';
import { key } from '../jest/today-day';
import { Roll } from '../src/roll/Roll';
import { keepMarks } from '../src/roll/roll-rules';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onDone = jest.fn();
const onRoll = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onDone.mockReset();
  onRoll.mockReset();
  keepMarks(unitKey(1), null);
});

async function mount(data: TestData, element: React.ReactElement, today = '2026-10-15', direction = 'rtl' as const) {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>{withData(data, element, today)}</LocaleDirContext.Provider>,
    );
  });
}

const roll = (data: TestData, slot = 1, today = '2026-10-15') =>
  mount(data, <Roll sessionKey={key(slot)} day={'2026-10-15' as never} onDone={onDone} />, today);

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
const control = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof (node.props as PressableProps).onPress === 'function')[0];
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (control(id).props as PressableProps).onPress?.({} as never);
  });
};
const toggle = (id: string) =>
  root().findAll((node) => node.props.testID === id && node.props.accessibilityRole === 'checkbox')[0];
const tap = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (toggle(id).props as PressableProps).onPress?.({} as never);
  });
};
const figures = () =>
  ['present', 'absent', 'late'].map(
    (id) => root().findAll((node) => node.props.testID === `roll-stats-${id}`)[0].props.accessibilityLabel as string,
  );
const disabled = (id: string) =>
  (root().findAll((node) => node.props.testID === id)[0].props as { disabled?: boolean }).disabled;

test('starts with everyone present, and the figures follow each tap', async () => {
  await roll(await withPupils());
  expect(figures()).toEqual([`45 ${text.roll.present}`, `0 ${text.roll.absentStat}`, `0 ${text.roll.lateStat}`]);
  expect(shown()).toEqual(expect.arrayContaining([text.roll.hint, text.roll.official, text.roll.save]));
  await tap('roll-1-absent');
  await tap('roll-2-late');
  expect(figures()).toEqual([`44 ${text.roll.present}`, `1 ${text.roll.absentStat}`, `1 ${text.roll.lateStat}`]);
  expect(toggle('roll-1-absent').props.accessibilityState).toEqual({ checked: true });
  await tap('roll-1-late');
  expect(toggle('roll-1-absent').props.accessibilityState).toEqual({ checked: false });
  expect(figures()).toEqual([`45 ${text.roll.present}`, `0 ${text.roll.absentStat}`, `2 ${text.roll.lateStat}`]);
  expect(accessibilityProblems(root())).toEqual([]);
});

test('records only the exceptions in one save, on the session it belongs to', async () => {
  const data = await withPupils();
  await roll(data);
  const entries = data.book.entries.length;
  await tap('roll-3-absent');
  await tap('roll-4-late');
  await press('roll-save');
  expect(data.book.entries.length).toBe(entries + 1);
  expect(current(data.book.state.rollCalls.get(unitKey(1)))).toMatchObject({
    day: '2026-10-15',
    absent: [{ pupilId: 'p-3', justified: false }],
    late: ['p-4'],
  });
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('keeps the marks when the screen is left before saving', async () => {
  const data = await withPupils();
  await roll(data);
  await tap('roll-5-absent');
  await roll(data);
  expect(figures()[1]).toBe(`1 ${text.roll.absentStat}`);
  expect(data.book.state.rollCalls.size).toBe(0);
});

test("enters a past session's roll call from the paper sheet on the session's date", async () => {
  const data = await withPupils();
  await roll(data, 1, '2026-10-18');
  expect(root().findAll((node) => node.props.testID === 'roll-past').length).toBeGreaterThan(0);
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.roll.pastTitle,
      'تُسجَّل الغيابات بتاريخ الحصة، 15/10/2026، لا بتاريخ اليوم. ويحفظ السجل يوم إدخالها، 18/10/2026، دون ساعة.',
      text.roll.pastHint,
      'حفظ مناداة 15 أكتوبر',
    ]),
  );
  await tap('roll-1-absent');
  await press('roll-save');
  const versions = data.book.state.rollCalls.get(unitKey(1));
  expect(versions?.[0]).toMatchObject({ day: '2026-10-18', value: { day: '2026-10-15' } });
});

test('corrects a roll call already taken only with a reason, and keeps both versions', async () => {
  const data = await withPupils();
  await roll(data);
  await tap('roll-1-absent');
  await press('roll-save');
  await roll(data);
  expect(shown()).toEqual(
    expect.arrayContaining([
      'سُجّلت هذه المناداة في 15/10/2026. يُحفظ التعديل تصحيحاً مع سببه، وتبقى النسختان في السجل.',
      text.roll.saveFix,
    ]),
  );
  expect(toggle('roll-1-absent').props.accessibilityState).toEqual({ checked: true });
  expect(disabled('roll-save')).toBe(true);
  await tap('roll-1-late');
  expect(disabled('roll-save')).toBe(true);
  await press('roll-reason-arrived-late');
  expect(disabled('roll-save')).toBe(false);
  await press('roll-save');
  const versions = data.book.state.rollCalls.get(unitKey(1));
  expect(versions).toHaveLength(2);
  expect(versions?.[1]).toMatchObject({ reason: 'arrived-late', value: { absent: [], late: ['p-1'] } });
});

test('says when a session has no roll call', async () => {
  await mount(
    await withPupils(),
    <Roll sessionKey="c-9/2026-10-15/m1/x" day={'2026-10-15' as never} onDone={onDone} />,
  );
  expect(shown()).toEqual([text.roll.unavailable]);
});

test("puts the roll call in the session's card on Today, before and after it is taken", async () => {
  const data = await withPupils();
  await mount(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={onRoll} />);
  expect(shown()).toEqual(expect.arrayContaining([text.roll.none, text.roll.title]));
  await press(`today-${key(1)}-roll-open`);
  expect(onRoll).toHaveBeenCalledWith(expect.objectContaining({ key: key(1) }));
  await roll(data);
  await tap('roll-2-absent');
  await press('roll-save');
  await mount(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={onRoll} />);
  expect(shown()).toContain('المناداة محفوظة · غياب: 1 · تأخر: 0');
});

test('leaves the roll call out of a session recorded as not held', async () => {
  const data = await withPupils();
  await mount(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={onRoll} />);
  await press(`today-${key(1)}-other`);
  await press('outcome-not-held');
  expect(root().findAll((node) => node.props.testID === `today-${key(1)}-roll`)).toHaveLength(0);
  expect(root().findAll((node) => node.props.testID === `today-${key(2)}-roll`).length).toBeGreaterThan(0);
});

test.each(['en', 'fr'] satisfies Language[])('has every Roll text in %s', (language) => {
  const roll = catalogues[language].roll as Record<string, unknown>;
  expect(Object.keys(roll).sort()).toEqual(Object.keys(text.roll).sort());
});
