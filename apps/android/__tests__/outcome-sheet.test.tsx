// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «نتيجة أخرى» on Today (#32): an item without stages goes on, is finished
// or merged; the last stage reached on a lesson with stages; skipping and a
// session not held with a private reason; closing chooses nothing. Made-up
// schools, classes and timetables only.

import { current } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextInputProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { key, withDay } from '../jest/today-day';
import { i18n } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { Today } from '../src/today/Today';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onHelp = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  await i18n.changeLanguage('ar');
  onHelp.mockReset();
});

async function show(data: TestData, direction: 'rtl' | 'ltr' = 'rtl', day = '2026-10-15') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>
        {withData(data, <Today onHelp={onHelp} />, day)}
      </LocaleDirContext.Provider>,
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
const pressable = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof (node.props as PressableProps).onPress === 'function');
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (pressable(id)[0].props as PressableProps).onPress?.({} as never);
  });
  await settle();
};

const sheetOpen = () =>
  root().findAll((node) => node.props.testID === 'outcome-sheet' && node.props.visible === true).length > 0;

test('«نتيجة أخرى» for an item without stages: it goes on, and closing chooses nothing', async () => {
  const data = await withDay();
  await show(data);
  await press(`today-${key(1)}-other`);
  expect(sheetOpen()).toBe(true);
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.outcome.title,
      '4م1 · ⁧08:00 – 09:00⁩ · تقويم تشخيصي (مثال)',
      text.outcome.noStages,
      text.outcome.goesOn,
      'ويُقترح بعده «الوضعية المشكلة الانطلاقية 1 (مثال)».',
      text.outcome.merged,
      text.outcome.skip,
      text.outcome.notHeld,
      text.outcome.reassurance,
    ]),
  );
  expect(shown()).not.toContain(text.outcome.retaught);
  expect(accessibilityProblems(root())).toEqual([]);
  await press('sheet-close');
  expect(sheetOpen()).toBe(false);
  expect(data.book.state.sessions.size).toBe(0);
  await press(`today-${key(1)}-other`);
  await press('outcome-goes-on');
  expect(sheetOpen()).toBe(false);
  expect(current(data.book.state.sessions.get(key(1)))).toMatchObject({
    outcome: 'partial',
    coverage: [{ op: 'taught', item: 'd1', from: 0, to: 0 }],
  });
  expect(shown()).toContain(text.outcome.snackPartial);
});

test('merged with the next item, then the last stage reached on a lesson with stages', async () => {
  const data = await withDay();
  await show(data);
  await press(`today-${key(1)}-other`);
  await press('outcome-merged');
  expect(current(data.book.state.sessions.get(key(1)))?.outcome).toBe('merged');
  await press(`today-${key(2)}-other`);
  expect(shown()).toEqual(
    expect.arrayContaining([text.outcome.reached, 'تهيئة', 'بناء', 'تطبيق', 'تقويم', text.outcome.carry]),
  );
  expect(shown()).toContain(text.outcome.retaught);
  expect(shown()).toContain('الوضعية المشكلة الانطلاقية 1 (مثال)');
  await press('outcome-stage-2');
  expect(current(data.book.state.sessions.get(key(2)))).toMatchObject({
    outcome: 'partial',
    coverage: [{ op: 'taught', item: 'u1-2', from: 0, to: 2 }],
  });
});

test('a lesson taught again shows on its done card', async () => {
  const data = await withDay();
  await show(data);
  await press(`today-${key(1)}-other`);
  await press('outcome-merged');
  await press(`today-${key(2)}-other`);
  await press('outcome-retaught');
  expect(current(data.book.state.sessions.get(key(2)))).toMatchObject({
    outcome: 'retaught',
    coverage: [{ op: 'retaught', item: 'u1-1' }],
  });
  expect(shown()).toContain('الوضعية المشكلة الانطلاقية 1 (مثال)');
});

test('a session not held keeps its reason private, in the note only', async () => {
  const data = await withDay();
  await show(data);
  await press(`today-${key(1)}-other`);
  await press('outcome-not-held');
  expect(shown()).toEqual(
    expect.arrayContaining([
      'يبقى «تقويم تشخيصي (مثال)» أول القائمة، فيُقترح في الحصة القادمة.',
      text.outcome.private,
      text.outcome.statement,
    ]),
  );
  expect(data.book.state.sessions.size).toBe(0);
  expect(accessibilityProblems(root())).toEqual([]);
  await press('outcome-reason-other');
  await ReactTestRenderer.act(() => {
    root()
      .findAll((node) => node.props.testID === 'outcome-reason-text' && typeof node.props.onChangeText === 'function')
      .map((node) => node.props as TextInputProps)[0]
      ?.onChangeText?.('سبب مختلق');
  });
  await press('outcome-done');
  const record = current(data.book.state.sessions.get(key(1)));
  expect(record).toMatchObject({ outcome: 'not-held', coverage: [] });
  expect(JSON.stringify(record)).not.toContain('سبب مختلق');
  expect(data.book.state.notes.get(key(1))).toMatchObject({ reason: 'other', reasonText: 'سبب مختلق' });
  expect(shown()).toContain(text.outcome.snackNotHeld);
});

test('skipping goes back to the other outcomes on «نتيجة أخرى»', async () => {
  const data = await withDay();
  await show(data);
  await press(`today-${key(1)}-other`);
  await press('outcome-skip');
  expect(shown()).toContain(
    'يُترك «تقويم تشخيصي (مثال)»، ويُقترح «الوضعية المشكلة الانطلاقية 1 (مثال)» في الحصة القادمة.',
  );
  expect(shown()).not.toContain(text.outcome.statement);
  await press('outcome-back');
  expect(shown()).toContain(text.outcome.noStages);
  await press('outcome-skip');
  await press('outcome-reason-holiday');
  await press('outcome-done');
  expect(current(data.book.state.sessions.get(key(1)))).toMatchObject({ outcome: 'skipped' });
  expect(data.book.state.notes.get(key(1))).toMatchObject({ reason: 'holiday' });
  expect(shown()).toContain('تُرك: تقويم تشخيصي (مثال)');
});
