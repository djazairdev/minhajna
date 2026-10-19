// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The exam-window warning and its answers (#221, Exam-window): a card on
// Today for each class whose plan would push items past the exams, opening
// its answers; the items with the days they would fall on, and nothing
// applied before a choice; a merge ticked as a suggestion, what it leaves,
// then recorded, shown on the session that takes both, and taken back; the
// items postponed, which ends the warning and tags them in the plan; the
// make-up day and «لاحقاً»; every decision listed and taken back later; a
// class's warning kept while only another class's records change; every
// control named in each language.
// Made-up records only.

import { awaitingBetween, confirmSessions, parseDay, walkCourse, type TodaySession } from '@minhajna/core';
import { LocaleDirContext } from '@react-navigation/native';
import { Text, type PressableProps, type TextProps } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import { withData, type TestData } from '../jest/app-data';
import { withDay } from '../jest/today-day';
import { ClassPlan } from '../src/classes/ClassPlan';
import { ExamWindow } from '../src/exams/ExamWindow';
import { courseWarnings } from '../src/exams/window-rules';
import { catalogues, i18n, type Language } from '../src/text/i18n';
import text from '../src/text/ar.json';
import { coreContext } from '../src/storage/core-context';
import { Today } from '../src/today/Today';
import { lessonOf, proposalOf } from '../src/today/today-labels';

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

async function mount(data: TestData, element: React.ReactElement, direction: 'rtl' | 'ltr' = 'rtl') {
  await ReactTestRenderer.act(() => tree?.unmount());
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LocaleDirContext.Provider value={direction}>{withData(data, element)}</LocaleDirContext.Provider>,
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

const exists = (testID: string) => tree!.root.findAll((node) => node.props.testID === testID).length > 0;

async function press(testID: string) {
  await ReactTestRenderer.act(async () => {
    (control(testID).props as PressableProps).onPress?.({} as never);
    await settle();
  });
}

async function undo(testID: string) {
  await ReactTestRenderer.act(async () => {
    (tree!.root.findByProps({ testID }).props as { onUndo: () => void }).onUndo();
    await settle();
  });
}

const decisions = (data: TestData) => [...data.book.state.decisions.values()];
const quoted = (title: string) => `«\u2068${title}\u2069»`;
const past = `سيقع ${['الظاهرة اللغوية 2 (مثال)', 'الإنتاج الكتابي 2 (مثال)', 'الوضعية الإدماجية 2 (مثال)']
  .map(quoted)
  .join('، ')} بعد بداية الاختبارات، الأحد 6 ديسمبر.`;

const answers = (onMakeUp = jest.fn(), onLater = jest.fn()) => (
  <ExamWindow courseId="c-1" onMakeUp={onMakeUp} onLater={onLater} />
);

test('Today shows a card for each class with items past the exams, and opens its answers', async () => {
  const data = await withDay();
  const onExamWindow = jest.fn();
  await mount(data, <Today onHelp={jest.fn()} onDetails={jest.fn()} onRoll={jest.fn()} onExamWindow={onExamWindow} />);
  expect(exists('exam-warning-c-1')).toBe(true);
  expect(exists('exam-warning-c-2')).toBe(false);
  expect(texts()).toEqual(expect.arrayContaining([past, '4م1 · يبقى هذا التنبيه حتى تختار ما تفعل.']));
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  await press('exam-warning-open-c-1');
  expect(onExamWindow).toHaveBeenCalledWith('c-1');
});

test('lists the items with the days they would fall on, and applies nothing before a choice', async () => {
  const data = await withDay();
  await mount(data, answers());
  expect(texts().slice(0, 6)).toEqual([
    past,
    '\u2068الظاهرة اللغوية 2 (مثال)\u2069 · يقع الخميس 17 ديسمبر',
    '\u2068الإنتاج الكتابي 2 (مثال)\u2069 · يقع الخميس 17 ديسمبر',
    '\u2068الوضعية الإدماجية 2 (مثال)\u2069 · يقع الخميس 7 جانفي',
    'اختبارات الفصل الأول: من الأحد 6 ديسمبر إلى الخميس 10 ديسمبر، تاريخ تقديري.',
    'ما العمل في 4م1؟ لا يُطبَّق شيء قبل اختيارك.',
  ]);
  expect(exists('exam-window-confirm')).toBe(false);
  expect(decisions(data)).toEqual([]);
});

test('a merge comes ticked as a suggestion, shows what it leaves, is recorded, and undo takes it back', async () => {
  const data = await withDay();
  await mount(data, answers());
  await press('exam-window-answer-merge');
  const choice = tree!.root.findAll(
    (node) => node.props.testID === 'exam-window-choice-0' && typeof node.props.label === 'string',
  )[0];
  expect(choice?.props.checked).toBe(true);
  const after = `ويبقى بعد الاختبارات: ${quoted('الإنتاج الكتابي 2 (مثال)')}، ${quoted('الوضعية الإدماجية 2 (مثال)')}.`;
  expect(texts()).toContain(after);
  await press('exam-window-confirm');
  expect(decisions(data)).toEqual([
    { id: expect.any(String) as string, courseId: 'c-1', kind: 'merge', items: ['u1-4', 'u1-5'] },
  ]);
  expect(texts()).toContain(text.examWindow.decided);
  expect(texts()[0]).toBe(
    `سيقع ${quoted('الإنتاج الكتابي 2 (مثال)')}، ${quoted('الوضعية الإدماجية 2 (مثال)')} بعد بداية الاختبارات، الأحد 6 ديسمبر.`,
  );

  await undo('exam-window-said');
  expect(decisions(data)).toEqual([]);
  expect(texts()).toContain(past);
});

test('postponing ends the warning and tags the items in the plan until taught', async () => {
  const data = await withDay();
  await mount(data, answers());
  await press('exam-window-answer-postpone');
  await ReactTestRenderer.act(async () => {
    const button = control('exam-window-postpone').props as PressableProps;
    button.onPress?.({} as never);
    button.onPress?.({} as never);
    await settle();
  });
  expect(texts()).toContain('لا عنصر بعد الاختبارات الآن في 4م1.');
  expect(decisions(data)).toEqual([
    { id: expect.any(String) as string, courseId: 'c-1', kind: 'postpone', items: ['u2-4', 'u2-5', 'u2-6'], term: 1 },
  ]);

  await mount(data, <ClassPlan courseId="c-1" onExamWindow={jest.fn()} />);
  expect(exists('exam-warning-c-1')).toBe(false);
  const spoken = tree!.root.findAll(
    (node) => node.props.testID === 'plan-u2-4' && typeof node.props.accessibilityLabel === 'string',
  )[0]?.props.accessibilityLabel as string;
  expect(spoken).toContain(text.classPlan.postponed);
});

test('the class plan shows its own warning, and Today the make-up day and «لاحقاً»', async () => {
  const data = await withDay();
  const onExamWindow = jest.fn();
  await mount(data, <ClassPlan courseId="c-1" onExamWindow={onExamWindow} />);
  expect(exists('exam-warning-c-1')).toBe(true);
  await press('exam-warning-open-c-1');
  expect(onExamWindow).toHaveBeenCalled();

  const onMakeUp = jest.fn();
  const onLater = jest.fn();
  await mount(data, answers(onMakeUp, onLater));
  await press('exam-window-answer-make-up');
  await press('exam-window-make-up');
  expect(onMakeUp).toHaveBeenCalled();
  await press('exam-window-later');
  expect(onLater).toHaveBeenCalled();
  expect(decisions(data)).toEqual([]);
});

test('a merged session proposes both items, on its card and further down the day', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'plan.decided',
    decision: { id: 'x-1', courseId: 'c-1', kind: 'merge', items: ['u1-4', 'u1-5'] },
  });
  const context = coreContext({ ...data, state: data.book.state });
  const walk = walkCourse(context, 'c-1', parseDay('2026-12-31'));
  const proposal = [...walk.proposals.values()].find((one) => one?.item.id === 'u1-4');
  expect(proposal?.with?.item.id).toBe('u1-5');
  const t = i18n.getFixedT('ar');
  expect(proposalOf(t, null, proposal!).lines[1]).toEqual({
    label: text.today.merged,
    text: proposal!.with!.item.title,
  });
  const item = { proposal: proposal!, packMissing: false } as unknown as TodaySession;
  expect(lessonOf(t, item).lesson).toBe(
    `\u2068${proposal!.item.title}\u2069، مع \u2068${proposal!.with!.item.title}\u2069`,
  );
});

test('every decision is listed and can be taken back after its «تراجع» has gone', async () => {
  const data = await withDay();
  await data.book.record(parseDay('2026-10-15'), {
    kind: 'plan.decided',
    decision: { id: 'x-1', courseId: 'c-1', kind: 'postpone', items: ['u2-4', 'u2-5', 'u2-6'], term: 1 },
  });
  await mount(data, answers());
  expect(texts()).toEqual(
    expect.arrayContaining([
      'قراراتك في 4م1',
      `أُجّل إلى ما بعد اختبارات الفصل الأول: ${['الظاهرة اللغوية 2 (مثال)', 'الإنتاج الكتابي 2 (مثال)', 'الوضعية الإدماجية 2 (مثال)'].map(quoted).join('، ')}`,
    ]),
  );
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  await press('exam-decision-x-1');
  expect(decisions(data)).toEqual([]);
  expect(texts()).toContain(past);
  expect(exists('exam-decisions')).toBe(false);
  await undo('exam-window-said');
  expect(decisions(data)).toHaveLength(1);
});

test('a class’s warning is kept while only another class’s records change', async () => {
  const data = await withDay();
  const day = parseDay('2026-10-15');
  const before = courseWarnings(coreContext({ ...data, state: data.book.state }), day);
  const [other] = awaitingBetween(coreContext({ ...data, state: data.book.state }), day, day).filter(
    (session) => session.courseId === 'c-2',
  );
  await data.book.recordAll(
    day,
    confirmSessions(coreContext({ ...data, state: data.book.state }), [{ session: other }]),
  );
  const kept = courseWarnings(coreContext({ ...data, state: data.book.state }), day);
  expect(kept[0]).toBe(before[0]);
  const [own] = awaitingBetween(coreContext({ ...data, state: data.book.state }), day, day).filter(
    (session) => session.courseId === 'c-1',
  );
  await data.book.recordAll(day, confirmSessions(coreContext({ ...data, state: data.book.state }), [{ session: own }]));
  expect(courseWarnings(coreContext({ ...data, state: data.book.state }), day)[0]).not.toBe(before[0]);
});

test.each(
  (Object.keys(catalogues) as Language[]).flatMap((language) =>
    (['rtl', 'ltr'] as const).map((direction) => [language, direction] as const),
  ),
)('names every control (%s, %s)', async (language, direction) => {
  await i18n.changeLanguage(language);
  const data = await withDay();
  await mount(data, answers(), direction);
  await press('exam-window-answer-merge');
  expect(accessibilityProblems(tree!.root)).toEqual([]);
  expect(texts()).toContain(catalogues[language].examWindow.laterLine);
});
