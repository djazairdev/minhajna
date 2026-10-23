// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التقويم والنقاط» (#238, Marks, answers 435 and 436): a middle-school class
// open on the term holding today, its formula, release and rules year, the
// preset standing, and its rows and chips opening what they name; a chosen
// term; a primary subject with no continuous assessment, its row disabled and
// its capture row shown but no component row (answers 450 and 451); a class
// archived after a reorientation showing its setup but taking no new one; a
// joint class's course named with its year; and every text found in each
// language. Made-up records only.

import { parseDay } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { course, primaryClass } from '../jest/specialist-classes';
import { withDay } from '../jest/today-day';
import { Marks, type MarksProps } from '../src/marks/Marks';
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

async function mount(data: TestData, props: Partial<MarksProps> = {}) {
  const all = {
    courseId: 'c-1',
    onTerm: jest.fn(),
    onSetup: jest.fn(),
    onTests: jest.fn(),
    onCapture: jest.fn(),
    onComponents: jest.fn(),
    onBook: jest.fn(),
    onEntry: jest.fn(),
    onPart: jest.fn(),
    onObservations: jest.fn(),
    ...props,
  };
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value="rtl">{withData(data, <Marks {...all} />)}</LocaleDirContext.Provider>,
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

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (control(testID)?.props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

test('a middle-school class opens on today’s term, with its formula and the preset standing', async () => {
  const props = await mount(await withDay());
  expect(texts()).toEqual(
    expect.arrayContaining([
      '4م1 · اللغة العربية',
      text.marks.formulaTitle,
      text.marks.formula.cem,
      'الإصدار 2026.1 · قواعد 2025-2026 حتى صدور منشور السنة',
      text.marks.setupRow,
      '6 عناصر على 20 · الإعداد الرسمي',
      text.tests.open,
    ]),
  );
  expect(tree!.root.findByProps({ testID: 'marks-term' }).props.selected).toBe('1');
  await press('marks-setup');
  await press('marks-tests');
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID: 'marks-term' }).props as { onSelect: (value: string) => void }).onSelect('3');
    await settle();
  });
  expect(props.onSetup).toHaveBeenCalledWith(1);
  expect(props.onTests).toHaveBeenCalledTimes(1);
  expect(props.onTerm).toHaveBeenCalledWith(3);
  expect(accessibilityProblems(tree!.root)).toEqual([]);
});

test('a chosen term opens its own setup', async () => {
  const props = await mount(await withDay(), { term: 2 });
  expect(tree!.root.findByProps({ testID: 'marks-term' }).props.selected).toBe('2');
  await press('marks-setup');
  expect(props.onSetup).toHaveBeenCalledWith(2);
});

test('a primary subject with no continuous assessment says so, its row disabled, and still captures', async () => {
  const data = await withDay();
  await data.book.recordAll(parseDay('2026-10-15'), [
    primaryClass('p-1', 's-1', '5ap', '5 ابتدائي أ'),
    course('p-islamic', 'p-1', 'islamic'),
  ]);
  await mount(data, { courseId: 'p-islamic' });
  expect(texts()).toEqual(
    expect.arrayContaining([text.marks.formula.examOnly, 'الإصدار 2026.1', text.marks.noAssessment]),
  );
  expect(control('marks-setup')?.props.disabled).toBe(true);
  expect(control('marks-capture')).toBeDefined();
  expect(control('marks-components')).toBeUndefined();
});

test('an archived class shows its setup but takes no new one', async () => {
  const data = await withDay();
  const room = data.book.state.classes.get('k-1')!;
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'class.set',
    schoolClass: { ...room, archivedFrom: parseDay('2026-10-15') },
  });
  await mount(data);
  expect(texts()).toContain('6 عناصر على 20 · الإعداد الرسمي');
  expect(control('marks-setup')?.props.disabled).toBe(true);
});

test('a joint class’s course is named with its year', async () => {
  const data = await withDay();
  await data.book.recordAll(parseDay('2026-10-15'), [
    {
      kind: 'class.set',
      schoolClass: {
        id: 'j-1',
        schoolId: 's-1',
        level: 'primary',
        grade: '4ap',
        name: '4-5 أ',
        groups: [
          { id: 'j-1-w', kind: 'whole', name: '4-5 أ' },
          { id: 'j-1-4', kind: 'level', name: '4', grade: '4ap' },
          { id: 'j-1-5', kind: 'level', name: '5', grade: '5ap' },
        ],
      },
    },
    {
      kind: 'course.set',
      course: { id: 'j-math', classId: 'j-1', subject: 'math', year: '2026-2027', pack: null, grade: '5ap' },
    },
  ]);
  await mount(data, { courseId: 'j-math' });
  expect(texts()).toContain(`4-5 أ · ${text.joint.short.replace('{{n}}', '5')} · الرياضيات`);
  expect(texts()).toContain('4 عناصر على 10 · الإعداد الرسمي');
});

test.each(['ar', 'en', 'fr'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  await mount(await withDay());
  expect(texts().filter((line) => line.includes('marks.'))).toEqual([]);
});
