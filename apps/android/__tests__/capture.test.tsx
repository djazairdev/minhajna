// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تقويم أثناء الحصة» (#239, Capture, answers 441, 449 and 450): today's
// first session not yet recorded, its pupils' tiles; taps counting up,
// homework and the notebook cycling through their states, each recorded at
// once; quick taps counting from what was just tapped; «تراجع» and «تم»; a
// chip for each of today's sessions, and «تراجع» going back to the last
// tap's session and item; a day without a session; the hub's row with
// today's session, disabled on a day without one; the homework counts the
// taps propose, written only once confirmed; and every text found in each
// language. Made-up records only.

import {
  confirmSessions,
  homeworkCaptured,
  parseDay,
  refOf,
  sessionCaptures,
  sessionsBetween,
  setCapture,
} from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import type React from 'react';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withTest } from '../jest/marks-class';
import { HomeworkBook } from '../src/homework/HomeworkBook';
import { Capture } from '../src/marks/Capture';
import { Marks } from '../src/marks/Marks';
import { useAppData, type AppData } from '../src/storage/AppData';
import { coreContext } from '../src/storage/core-context';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
});

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const KEY = 'c-1/2026-10-15/m1/k-1-w';

async function mount(data: TestData, element: React.ReactElement, day = '2026-10-15') {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, element, day)}</LocaleDirContext.Provider>,
    );
    await settle();
  });
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

async function press(...testIDs: string[]) {
  for (const testID of testIDs) {
    await ReactTestRenderer.act(async () => {
      (control(testID)?.props as PressableProps).onPress?.({} as never);
      await settle();
    });
  }
}

async function choose(item: string, testID = 'capture-item') {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID }).props as { onSelect: (value: string) => void }).onSelect(item);
    await settle();
  });
}

const selected = (testID: string) => (tree!.root.findByProps({ testID }).props as { selected: string }).selected;

const kept = (data: TestData) => Object.fromEntries(sessionCaptures(data.book.state, KEY));

test('taps count up or cycle through their states, recorded at once; «تراجع» takes the last back', async () => {
  const data = await withTest();
  const onDone = jest.fn();
  await mount(data, <Capture courseId="c-1" onDone={onDone} />);
  expect(texts()).toEqual(
    expect.arrayContaining([
      '4م1 · اللغة العربية',
      'حصة اليوم · 08:00 – 09:00',
      text.marks.during.hint.participation,
      'تلميذة أولى',
    ]),
  );
  expect(control('capture-undo')?.props.disabled).toBe(true);
  await press('capture-p-1', 'capture-p-1');
  expect(texts()).toContain('+2');
  await choose('homework');
  await press('capture-p-2');
  expect(texts()).toContain(text.marks.during.state.notDone);
  await press('capture-p-2', 'capture-p-3');
  expect(texts()).toContain(text.marks.during.state.helped);
  await choose('notebook');
  await press('capture-p-1');
  expect(kept(data)).toEqual({
    'p-1': { participation: 2, notebook: 1 },
    'p-2': { homework: 2 },
    'p-3': { homework: 1 },
  });
  await press('capture-undo', 'capture-undo');
  expect(kept(data)).toEqual({ 'p-1': { participation: 2 }, 'p-2': { homework: 2 } });
  await choose('homework');
  await press('capture-p-2');
  expect(kept(data)).toEqual({ 'p-1': { participation: 2 } });
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  await press('capture-done');
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('quick taps count from what was just tapped', async () => {
  const data = await withTest();
  await mount(data, <Capture courseId="c-1" onDone={jest.fn()} />);
  for (let n = 0; n < 3; n += 1) {
    void ReactTestRenderer.act(() => {
      (control('capture-p-1')?.props as PressableProps).onPress?.({} as never);
    });
  }
  await ReactTestRenderer.act(settle);
  expect(kept(data)).toEqual({ 'p-1': { participation: 3 } });
  const tile = tree!.root.findAll((node) => node.props.testID === 'capture-p-1')[0];
  expect(tile?.props.accessibilityLabel).toBe('1، \u2068تلميذة أولى\u2069، +3');
});

test('each of today’s sessions has its chip, and «تراجع» goes back to the last tap’s session and item', async () => {
  const data = await withTest();
  await mount(data, <Capture courseId="c-1" onDone={jest.fn()} />);
  expect(texts()).toEqual(expect.arrayContaining([text.marks.during.sessions, '08:00 – 09:00', '09:00 – 10:00']));
  expect(selected('capture-session')).toBe(KEY);
  const second = KEY.replace('/m1/', '/m2/');
  await choose(second, 'capture-session');
  expect(texts()).toContain('حصة اليوم · 09:00 – 10:00');
  await choose('behaviour');
  await press('capture-p-1');
  await choose(KEY, 'capture-session');
  await choose('participation');
  expect(Object.fromEntries(sessionCaptures(data.book.state, second))).toEqual({ 'p-1': { behaviour: 1 } });
  await press('capture-undo');
  expect([selected('capture-session'), selected('capture-item')]).toEqual([second, 'behaviour']);
  expect(Object.fromEntries(sessionCaptures(data.book.state, second))).toEqual({});
  expect(kept(data)).toEqual({});
});

test('with no session today the screen says so', async () => {
  await mount(await withTest(), <Capture courseId="c-1" onDone={jest.fn()} />, '2026-10-16');
  expect(texts()).toContain(text.marks.during.noSession);
  expect(control('capture-p-1')).toBeUndefined();
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('the hub’s row names today’s session, and is disabled on a day without one', async () => {
  const data = await withTest();
  const onCapture = jest.fn();
  const hub = (
    <Marks
      courseId="c-1"
      onTerm={jest.fn()}
      onSetup={jest.fn()}
      onTests={jest.fn()}
      onCapture={onCapture}
      onComponents={jest.fn()}
      onBook={jest.fn()}
      onEntry={jest.fn()}
      onPart={jest.fn()}
      onObservations={jest.fn()}
    />
  );
  await mount(data, hub);
  expect(texts()).toEqual(expect.arrayContaining([text.marks.during.title, 'حصة اليوم · 08:00 – 09:00']));
  await press('marks-capture');
  expect(onCapture).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(() => tree?.unmount());
  await mount(data, hub, '2026-10-16');
  expect(texts()).toContain(text.marks.during.noSession);
  expect(control('marks-capture')?.props.disabled).toBe(true);
});

test('homework taps propose the counts as they stood on opening, written only once confirmed', async () => {
  const data = await withTest();
  const context = () => coreContext({ ...data, state: data.book.state });
  const [first] = sessionsBetween(context(), parseDay('2026-10-15'), parseDay('2026-10-15'), new Set(['c-1']));
  const homework = { homework: { text: 'التمرين 2 ص 21', due: parseDay('2026-10-22') } };
  await data.book.recordAll(
    parseDay('2026-10-15'),
    confirmSessions(context(), [{ session: first, details: homework }]),
  );
  const [back] = sessionsBetween(context(), parseDay('2026-10-22'), parseDay('2026-10-22'), new Set(['c-1']));
  await data.book.recordAll(parseDay('2026-10-22'), [
    setCapture(refOf(back), 'p-1', 'homework', 1),
    setCapture(refOf(back), 'p-2', 'homework', 2),
  ]);
  let app: AppData | undefined;
  const Grab = () => {
    app = useAppData();
    return null;
  };
  await mount(
    data,
    <>
      <HomeworkBook courseId="c-1" />
      <Grab />
    </>,
    '2026-10-22',
  );
  const said = 'من تقويم الحصة · لم يُنجزه: 1 · بمساعدة الغير: 1. لا يُكتب العدّان إلا بعد التأكيد.';
  expect(texts()).toContain(said);
  expect(data.book.state.homeworkCounts.size).toBe(0);
  await ReactTestRenderer.act(async () => {
    app?.record(setCapture(refOf(back), 'p-3', 'homework', 1));
    await settle();
  });
  expect(homeworkCaptured(context(), { session: refOf(first), due: parseDay('2026-10-22') })?.notDone).toBe(2);
  expect(texts()).toContain(said);
  await press('homework-confirm');
  const [count] = [...data.book.state.homeworkCounts.values()].map((versions) => versions.at(-1)?.value);
  expect([count?.notDone, count?.reliedOn]).toEqual([1, 1]);
  expect(texts()).not.toContain(text.homework.proposed.replace('{{notDone}}', '1').replace('{{reliedOn}}', '1'));
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  await mount(await withTest(), <Capture courseId="c-1" onDone={jest.fn()} />);
  await press('capture-p-1');
  for (const item of ['homework', 'notebook', 'behaviour']) await choose(item);
  expect(texts().filter((one) => one.includes('marks.'))).toEqual([]);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});
