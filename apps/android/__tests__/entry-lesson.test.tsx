// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «درس آخر لهذه الحصة» (#34, Entry-lesson): the plan around the class's
// position, a search, another item, an item taught again and content from
// outside the plan, each written instead of the proposal, which stays first.
// Made-up schools, classes and timetables only.

import { confirmSessions, current, parseDay, todayView } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextInputProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { key, withDay } from '../jest/today-day';
import { Entry } from '../src/entry/Entry';
import { coreContext } from '../src/storage/core-context';
import text from '../src/text/ar.json';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

let tree: ReactTestRenderer.ReactTestRenderer | undefined;
const root = () => tree!.root;
const onDone = jest.fn();

afterEach(async () => {
  await ReactTestRenderer.act(() => tree?.unmount());
  tree = undefined;
  onDone.mockReset();
});

async function show(data: TestData, sessionKey = key(1)) {
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <Entry sessionKey={sessionKey} day={parseDay('2026-10-15')} onDone={onDone} />)}
      </LocaleDirContext.Provider>,
    );
  });
}

const shown = () =>
  root()
    .findAllByType(Text)
    .map((node) =>
      [node.props.children as unknown]
        .flat()
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(''),
    );
const book = () =>
  String(
    root().findAll((node) => node.props.testID === 'entry-book' && node.props.accessibilityLabel !== undefined)[0]
      ?.props.accessibilityLabel,
  );
const control = (id: string) =>
  root().findAll((node) => node.props.testID === id && typeof node.props.onPress === 'function')[0];
const press = async (id: string) => {
  await ReactTestRenderer.act(() => {
    (control(id)?.props as PressableProps).onPress?.({} as never);
  });
};
const type = async (id: string, value: string) => {
  await ReactTestRenderer.act(() => {
    root()
      .findAll((node) => node.props.testID === id && typeof node.props.onChangeText === 'function')
      .map((node) => node.props as TextInputProps)[0]
      ?.onChangeText?.(value);
  });
};
const sheetOpen = () =>
  root().findAll((node) => node.props.testID === 'lesson-sheet' && node.props.visible === true).length > 0;

test('the plan around the class, with the days it would reach each item', async () => {
  const data = await withDay();
  await show(data);
  await press('entry-change');
  expect(sheetOpen()).toBe(true);
  expect(shown()).toEqual(
    expect.arrayContaining([
      text.lesson.title,
      text.lesson.main,
      'تقويم تشخيصي (مثال)',
      text.lesson.proposed,
      'الوضعية المشكلة الانطلاقية 1 (مثال)',
      'التالي · الخميس 15/10',
      'فهم المنطوق 1 (مثال)',
      'الخميس 22/10',
      'ما يُختار يُكتب في دفتر النصوص مكان المقترح. ويبقى «تقويم تشخيصي (مثال)» أول قائمته، فيُقترح الخميس 15/10.',
    ]),
  );
  expect(accessibilityProblems(root())).toEqual([]);
  expect((control('lesson-choose')?.props as PressableProps).disabled).toBe(true);
  await type('lesson-search', 'الإنتاج');
  expect(shown()).toContain('الإنتاج الكتابي 1 (مثال)');
  expect(shown()).not.toContain('فهم المنطوق 1 (مثال)');
  await press('sheet-close');
  expect(sheetOpen()).toBe(false);
  expect(data.book.state.sessions.size).toBe(0);
});

test('another item is written instead, and the proposed one stays first', async () => {
  const data = await withDay();
  await show(data);
  await press('entry-change');
  await press('lesson-u1-2');
  await press('lesson-choose');
  expect(sheetOpen()).toBe(false);
  expect(book()).toContain('الموضوع: فهم المنطوق 1 (مثال)');
  expect(shown()).not.toContain(text.entry.stages);
  await press('entry-confirm');
  expect(current(data.book.state.sessions.get(key(1)))).toMatchObject({
    outcome: 'changed',
    coverage: [{ op: 'taught', item: 'u1-2', from: 0, to: 4 }],
  });
  const context = coreContext({ ...data, state: data.book.state });
  expect(todayView(context, parseDay('2026-10-15')).sessions[1]?.proposal?.item.id).toBe('d1');
});

test('an item taught before is taught again', async () => {
  const data = await withDay();
  const context = coreContext({ ...data, state: data.book.state });
  const [first] = todayView(context, parseDay('2026-10-15')).sessions;
  await data.book.recordAll(
    parseDay('2026-10-15'),
    confirmSessions(context, [{ session: first.session, choice: { outcome: 'partial', reached: 1 } }]),
  );
  await show(data, key(2));
  await press('entry-change');
  expect(shown()).toEqual(expect.arrayContaining([text.lesson.position]));
  await press('lesson-d1');
  await press('lesson-choose');
  expect(book()).toContain('إعادة: تقويم تشخيصي (مثال)');
  await press('entry-confirm');
  expect(current(data.book.state.sessions.get(key(2)))).toMatchObject({
    outcome: 'retaught',
    coverage: [{ op: 'retaught', item: 'd1' }],
  });
});

test('content from outside the plan needs its words before «تأكيد الحصة»', async () => {
  const data = await withDay();
  await show(data);
  await press('entry-change');
  await press('lesson-unplanned');
  await press('lesson-choose');
  expect((control('entry-confirm')?.props as PressableProps).disabled).toBe(true);
  await type('entry-unplanned', 'زيارة مختلقة');
  expect(book()).toBe('2026/10/15. ⁧08سا – 09سا⁩. زيارة مختلقة');
  await press('entry-confirm');
  expect(current(data.book.state.sessions.get(key(1)))).toMatchObject({
    outcome: 'changed',
    coverage: [],
    unplanned: 'زيارة مختلقة',
  });
});
