// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «عناصر التقويم المستمر» (#238, Marks-setup, Marks-setup-sum, answers 431 to
// 434): the preset's card and components, «حفظ» off with nothing changed;
// a lowered component leaving the total short and saying so, until another
// makes it up; attendance from the roll-call book, its caption following;
// a column added through its sheet, counted, and removed; the save applying
// from the term, kept with its components' names and the roll-call choice;
// saved points out of today's range brought back into it, said, and ready to
// save; primary music on 10 with its own preset and no roll-call row; and
// every text found in each language. Made-up records only.

import { parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { course, primaryClass } from '../jest/specialist-classes';
import { withDay } from '../jest/today-day';
import { MarksSetup } from '../src/marks/MarksSetup';
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

async function mount(data: TestData, term = 1, courseId = 'c-1') {
  const props = { onDirty: jest.fn(), onSaved: jest.fn() };
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">
        {withData(data, <MarksSetup courseId={courseId} term={term} {...props} />)}
      </LocaleDirContext.Provider>,
    );
    await settle();
  });
  return props;
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

async function act(run: () => void) {
  await ReactTestRenderer.act(async () => {
    run();
    await settle();
  });
}

const press = (testID: string) => act(() => (control(testID)?.props as PressableProps).onPress?.({} as never));

const points = (id: string) => tree!.root.findByProps({ testID: `setup-points-${id}-value` }).props.children as string;

const saveOff = () => control('setup-save')?.props.disabled as boolean;

test('the preset’s card and components, with nothing to save yet', async () => {
  const props = await mount(await withDay());
  expect(texts()).toEqual(
    expect.arrayContaining([
      'المرجع: المنشور رقم 270 · الإصدار 2026.1',
      'قواعد 2025-2026 حتى صدور منشور السنة',
      text.marks.curators,
      'المشاركة في القسم',
      text.marks.capture.periodic,
      'من 2 إلى 6',
      'المجموع 20 من 20',
    ]),
  );
  expect(texts()).toContain('\u20684م1 · اللغة العربية\u2069 · على 20 · من الفصل الأول');
  expect(saveOff()).toBe(true);
  expect(props.onDirty).toHaveBeenLastCalledWith(false);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('a short total says what is left until another component makes it up, then saves from the term', async () => {
  const data = await withDay();
  const props = await mount(data, 2);
  await press('setup-points-participation-decrease');
  expect(points('participation')).toBe('3');
  expect(texts()).toContain('المجموع 19 من 20');
  expect(texts()).toContain('يُحفظ الإعداد حين يبلغ المجموع 20: تبقى نقطة واحدة للتوزيع.');
  expect(saveOff()).toBe(true);
  expect(props.onDirty).toHaveBeenLastCalledWith(true);
  await press('setup-points-research-increase');
  expect(texts()).toContain('المجموع 20 من 20');
  expect(saveOff()).toBe(false);
  expect(texts()).toContain(text.marks.capture.manual);
  await act(() =>
    (
      tree!.root.findByProps({ testID: 'setup-roll-call' }).props as { onCheckedChange: (on: boolean) => void }
    ).onCheckedChange(true),
  );
  expect(texts()).toContain(text.marks.capture.rollCall);
  await press('setup-save');
  expect(props.onSaved).toHaveBeenCalledTimes(1);
  const [saved] = data.book.state.assessment.get('c-1') ?? [];
  expect(saved).toMatchObject({ courseId: 'c-1', term: 2, release: '2026.1', rollCall: true });
  expect(saved?.components.map((one) => [one.id, one.points])).toEqual([
    ['participation', 3],
    ['quizzes', 3],
    ['homework', 3],
    ['notebook', 3],
    ['attendance', 3],
    ['research', 5],
  ]);
  expect(props.onDirty).toHaveBeenLastCalledWith(false);
});

test('a column added through its sheet counts in the total, and can be removed', async () => {
  await mount(await withDay());
  await press('setup-add-column');
  expect(tree!.root.findByProps({ testID: 'marks-column-sheet' }).props.visible).toBe(true);
  expect(control('marks-column-add')?.props.disabled).toBe(true);
  await act(() =>
    (
      tree!.root.findByProps({ testID: 'marks-column-name' }).props as { onChangeText: (v: string) => void }
    ).onChangeText('  عروض شفهية '),
  );
  await press('marks-column-points-increase');
  await press('marks-column-add');
  expect(texts()).toEqual(expect.arrayContaining(['عروض شفهية', text.marks.capture.column, 'المجموع 22 من 20']));
  expect(texts()).toContain('يُحفظ الإعداد حين يبلغ المجموع 20: تُنقَص نقطتان.');
  const remove = tree!.root.findAll(
    (node) => String(node.props.testID).startsWith('setup-remove-') && typeof node.props.onPress === 'function',
  )[0];
  await act(() => (remove.props as PressableProps).onPress?.({} as never));
  expect(texts()).not.toContain('عروض شفهية');
  expect(texts()).toContain('المجموع 20 من 20');
});

test('saved points out of today’s range come back into it, said, and ready to save', async () => {
  const data = await withDay();
  const ids = ['participation', 'quizzes', 'homework', 'notebook', 'attendance', 'research'];
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'assessment.set',
    setup: {
      courseId: 'c-1',
      term: 1,
      release: '2025.9',
      components: [7, 3, 3, 3, 1, 4].map((one, index) => ({
        kind: 'preset' as const,
        id: ids[index],
        name: { ar: ids[index] },
        points: one,
      })),
      rollCall: false,
    },
  });
  const props = await mount(data);
  expect(points('participation')).toBe('6');
  expect(texts()).toEqual(expect.arrayContaining([text.marks.moved, 'المجموع 20 من 20']));
  expect(saveOff()).toBe(false);
  expect(props.onDirty).toHaveBeenLastCalledWith(true);
});

test('primary music is on 10, with its own preset and no roll-call row', async () => {
  const data = await withDay();
  await data.book.recordAll(parseDay('2026-10-15'), [
    primaryClass('p-1', 's-1', '5ap', '5 ابتدائي أ'),
    course('p-music', 'p-1', 'music'),
  ]);
  await mount(data, 1, 'p-music');
  expect(texts()).toEqual(
    expect.arrayContaining([
      'الإعداد الرسمي · ابتدائي · التربية الموسيقية، التربية التشكيلية، التربية البدنية والرياضية',
      'الأعمال التطبيقية',
      'المجموع 10 من 10',
    ]),
  );
  expect(tree!.root.findAll((node) => node.props.testID === 'setup-roll-call')).toEqual([]);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test.each(['ar', 'en', 'fr'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  await mount(await withDay());
  await press('setup-add-column');
  expect(texts().filter((line) => line.includes('marks.'))).toEqual([]);
});
