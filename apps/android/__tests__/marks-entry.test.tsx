// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Entering a test's or the exam's marks (#239, Marks-test, Marks-exam,
// answers 440 and 447): marks typed on the keypad and recorded with
// «التالي», a quick quarter and «غائب عن الفرض»; a mark over the maximum
// refused and said; the summary's counts and checks; going back to the
// previous pupil, reviewing from the start and clearing an erased mark; a
// mark shown at once on going back before the history's write ends; «مسح»
// clearing «غائب»; what TalkBack hears of a cell; a mark of a pupil not on
// the list said and cleared; the exam's own sheet; and every text found in
// each language. Made-up records only.

import { marksFor, parseDay, type MarkTarget } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { pupil, withTest } from '../jest/marks-class';
import { MarksEntry, type MarksEntryProps } from '../src/marks/MarksEntry';
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

async function mount(data: TestData, props: Partial<MarksEntryProps> = {}) {
  const all = { courseId: 'c-1', term: 1, testId: 't-1', onDone: jest.fn(), ...props };
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, <MarksEntry {...all} />)}</LocaleDirContext.Provider>,
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

async function press(...testIDs: string[]) {
  for (const testID of testIDs) {
    await ReactTestRenderer.act(async () => {
      (control(testID)?.props as PressableProps).onPress?.({} as never);
      await settle();
    });
  }
}

const shown = () => texts()[tree!.root.findAllByType(Text).findIndex((node) => node.props.testID === 'entry-shown')];

const T1: MarkTarget = { kind: 'test', testId: 't-1' };
const kept = (data: TestData, target: MarkTarget = T1) =>
  Object.fromEntries(marksFor(data.book.state, 'c-1', 1, target));

test('marks typed on the keypad are recorded with «التالي», a quarter and an absence', async () => {
  const data = await withTest();
  const props = await mount(data);
  expect(texts()).toEqual(
    expect.arrayContaining([
      '\u2068الفرض الأول\u2069 · \u20684م1 · اللغة العربية\u2069',
      'الأحد 8 نوفمبر · على 20',
      '0 من 3',
      'تلميذة أولى',
      'تلميذة ثانية',
      '/ 20',
    ]),
  );
  await press('pad-1', 'pad-2');
  expect(shown()).toBe('12');
  await press('entry-next', 'pad-9', 'pad-.5');
  expect(shown()).toBe('9.5');
  await press('entry-next', 'entry-absent');
  expect(kept(data)).toEqual({ 'p-1': 12, 'p-2': 9.5, 'p-3': 'absent' });
  expect(texts()).toEqual(
    expect.arrayContaining([
      text.marks.entry.summary,
      'النقاط: 2 · الغياب: 1',
      'لا نقطة فوق 20',
      text.marks.entry.noEmpty,
      text.marks.entry.allListed,
      text.marks.entry.stays,
      '3 من 3',
    ]),
  );
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  await press('entry-done');
  expect(props.onDone).toHaveBeenCalledTimes(1);
});

test('a mark over the maximum is said and not saved', async () => {
  const data = await withTest();
  await mount(data);
  await press('pad-2', 'pad-5');
  expect(texts()).toContain('النقطة أكبر من 20، ولا تُحفظ.');
  const current = tree!.root.findAll((node) => node.props.testID === 'entry-current')[0];
  expect(current.props.accessibilityLabel).toBe('\u2068تلميذة أولى\u2069: 25 على 20. النقطة أكبر من 20، ولا تُحفظ.');
  await press('entry-next');
  expect(kept(data)).toEqual({});
  expect(texts()).toContain('تلميذة أولى');
  await press('pad-erase');
  expect(texts()).not.toContain('النقطة أكبر من 20، ولا تُحفظ.');
  await press('entry-next');
  expect(kept(data)).toEqual({ 'p-1': 2 });
});

test('a skipped cell is counted empty; going back, reviewing and erasing clear a mark', async () => {
  const data = await withTest();
  await mount(data);
  await press('pad-1', 'pad-4', 'entry-next', 'entry-next', 'entry-previous');
  expect(shown()).toBe(text.marks.entry.empty);
  expect(texts()).toContain('تلميذة ثانية');
  await press('entry-next', 'entry-next');
  expect(texts()).toContain('خانات فارغة: 2');
  await press('entry-restart');
  expect(shown()).toBe('14');
  await press('pad-erase', 'pad-erase', 'entry-next');
  expect(kept(data)).toEqual({});
});

test('a mark just recorded shows on going back at once, and «مسح» clears «غائب»', async () => {
  const data = await withTest();
  await mount(data);
  await press('pad-1', 'pad-2');
  for (const testID of ['entry-next', 'entry-previous']) {
    void ReactTestRenderer.act(() => {
      (control(testID)?.props as PressableProps).onPress?.({} as never);
    });
  }
  expect(shown()).toBe('12');
  await press('entry-next');
  expect(kept(data)).toEqual({ 'p-1': 12 });
  await press('entry-absent', 'entry-previous');
  expect(shown()).toBe(text.marks.entry.absentShort);
  await press('pad-erase');
  expect(shown()).toBe(text.marks.entry.empty);
  expect(kept(data)).toEqual({ 'p-1': 12 });
  const current = tree!.root.findAll((node) => node.props.testID === 'entry-current')[0];
  expect(current.props.accessibilityLabel).toBe('\u2068تلميذة ثانية\u2069: فارغة على 20');
  expect(current.props.accessibilityLiveRegion).toBe('polite');
});

test('a mark of a pupil not on the list that day is said, and can be cleared', async () => {
  const data = await withTest();
  await data.book.recordAll(parseDay('2026-11-20'), [
    pupil('p-4', 'تلميذة وافدة', '2026-11-15'),
    { kind: 'mark.set', mark: { courseId: 'c-1', term: 1, target: T1, pupilId: 'p-4', value: 15 } },
  ]);
  await mount(data);
  await press('entry-next', 'entry-next', 'entry-next');
  expect(texts()).toEqual(
    expect.arrayContaining(['تلميذة وافدة', text.marks.entry.notListed, text.marks.entry.notListedNote]),
  );
  expect(texts()).not.toContain(text.marks.entry.allListed);
  await press('entry-clear-p-4');
  expect(kept(data)).toEqual({});
  expect(texts()).toContain(text.marks.entry.allListed);
});

test('the exam has its own sheet, from its window’s first day', async () => {
  const data = await withTest();
  await mount(data, { testId: undefined });
  expect(texts()).toEqual(expect.arrayContaining(['الأحد 6 ديسمبر · على 20', text.marks.entry.absentExam, '0 من 3']));
  await press('entry-absent', 'pad-8', 'entry-next', 'entry-next');
  expect(kept(data, { kind: 'exam' })).toEqual({ 'p-1': 'absent', 'p-2': 8 });
  expect(texts()).not.toContain(text.marks.entry.stays);
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  await mount(await withTest());
  await press('pad-2', 'pad-5');
  await press('pad-erase', 'entry-next', 'entry-next', 'entry-next');
  expect(texts().filter((one) => one.includes('marks.'))).toEqual([]);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});
