// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «التقديرات» (#241, Apprec, Apprec-conduct, answer 465): the hub's row with
// how many pupils have a phrase; one pupil at a time with the average in full,
// 9.995 never shown as 10.00, the phrase their band suggests confirmed or
// another from the list used, moving on to the next pupil without one, then
// «اكتملت التقديرات», a change in review moving on to the next pupil; a phrase
// that only restates the mark kept on the pupil with a warning, and cleared; by
// conduct too, the term's counts and the phrase for a concern first; a pupil
// with no average offered the whole list; an archived class's phrases shown
// without choices; no row for a term observations replace; and every text found
// in each language. The list here adds one phrase that restates the mark.
// Made-up records only.

import { appreciationsFor, refOf, sessionsBetween, setCapture, setMark, type MarkTarget } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { context, DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { pupil, withTest } from '../jest/marks-class';
import { Marks } from '../src/marks/Marks';
import { MarksAppreciations } from '../src/marks/MarksAppreciations';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock('@minhajna/data/dz/appreciations.json', () => {
  const actual = jest.requireActual<{ phrases: unknown[] }>('@minhajna/data/dz/appreciations.json');
  const restating = { id: 'fair-mark', band: 'fair', text: { ar: 'مقبول' }, restates: true };
  return { ...actual, phrases: [...actual.phrases, restating] };
});
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

beforeEach(() => {
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});

afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
});

const POINTS = { participation: 4, quizzes: 3, homework: 3, notebook: 3, attendance: 3, research: 4 } as const;
const mark = (target: MarkTarget, pupilId: string, value: number, max: number) =>
  setMark({ courseId: 'c-1', term: 1, target, pupilId }, value, max);

/** 4م1: the first pupil at 11.67, the second at 9.995, the third at 16.00. */
async function marked(): Promise<TestData> {
  const data = await withTest();
  const given = {
    'p-1': [3.5, 2, 3, 2.5, 3, 4],
    'p-2': [3, 2, 2, 2, 1.72, 2],
    'p-3': [4, 3, 3, 3, 3, 4],
  } as const;
  const tests = { 'p-1': [12, 10], 'p-2': [10.25, 9.25], 'p-3': [16, 15] } as const;
  await data.book.recordAll(DAY, [
    ...Object.entries(given).flatMap(([pupilId, values]) =>
      Object.entries(POINTS).map(([id, points], index) =>
        mark({ kind: 'component', componentId: id }, pupilId, values[index], points),
      ),
    ),
    ...Object.entries(tests).flatMap(([pupilId, [test, exam]]) => [
      mark({ kind: 'test', testId: 't-1' }, pupilId, test, 20),
      mark({ kind: 'exam' }, pupilId, exam, 20),
    ]),
  ]);
  return data;
}

const screen = <MarksAppreciations courseId="c-1" term={1} />;
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
const chosen = (data: TestData) =>
  [...appreciationsFor(data.book.state, 'c-1', 1)].map(([pupilId, phrase]) => `${pupilId} ${phrase.id}`);
const hub = (onAppreciations = jest.fn()) => (
  <Marks
    courseId="c-1"
    onTerm={jest.fn()}
    onSetup={jest.fn()}
    onTests={jest.fn()}
    onCapture={jest.fn()}
    onComponents={jest.fn()}
    onBook={jest.fn()}
    onEntry={jest.fn()}
    onPart={jest.fn()}
    onObservations={jest.fn()}
    onAppreciations={onAppreciations}
  />
);

async function pressSegment(testID: string, value: string) {
  await ReactTestRenderer.act(async () => {
    const [control] = root().findAll(
      (node) => node.props.testID === testID && typeof (node.props as { onSelect?: unknown }).onSelect === 'function',
    );
    (control?.props as { onSelect: (one: string) => void }).onSelect(value);
    await Promise.resolve();
  });
}

test('the hub’s row says how many pupils have a phrase, and opens the appreciations', async () => {
  const onAppreciations = jest.fn();
  await mount(await marked(), hub(onAppreciations));
  expect(texts()).toEqual(expect.arrayContaining(['التقديرات', '0 من 3 مختارة']));
  await press('marks-appreciations');
  expect(onAppreciations).toHaveBeenCalledWith(1);
});

test('one pupil at a time: the suggestion confirmed or another used, then «اكتملت التقديرات»', async () => {
  const data = await marked();
  await mount(data, screen);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'التقديرات · 4م1 · اللغة العربية · الفصل الأول',
      '0 من 3 مختارة',
      '1. \u2068تلميذة أولى\u2069',
      'المعدل 11.67',
      'مقترح حسب المعدل',
      'نتائج مقبولة، والتحسن ممكن',
      'قائمة مؤقتة يحرّرها «منهاجنا»، في انتظار قائمة المنشور 244 · الإصدار 2026.1',
      'لا تعبئة جماعية: تُختار العبارة لكل تلميذ على حدة.',
    ]),
  );
  expect(['fair-2', 'fair-3', 'fair-mark'].every((id) => has(`apprec-use-${id}`))).toBe(true);
  expect(has('apprec-use-weak-1')).toBe(false);
  expect(accessibilityProblems(root())).toEqual([]);
  await press('apprec-confirm');
  expect(texts()).toEqual(
    expect.arrayContaining(['2. \u2068تلميذة ثانية\u2069', 'المعدل 10.00، والقيمة الكاملة 9.995', '1 من 3 مختارة']),
  );
  expect(texts()).toContain('نتائج ضعيفة، تحتاج إلى مراجعة منتظمة ومتابعة');
  await press('apprec-use-weak-2');
  expect(texts()).toEqual(expect.arrayContaining(['3. \u2068تلميذة ثالثة\u2069', 'المعدل 16.00']));
  await press('apprec-confirm');
  expect(chosen(data)).toEqual(['p-1 fair-1', 'p-2 weak-2', 'p-3 excellent-1']);
  expect(texts()).toEqual(expect.arrayContaining(['اكتملت التقديرات', '3 من 3 مختارة']));
  expect(has('apprec-pupil')).toBe(false);
  await press('apprec-review');
  expect(texts()).toContain('مختارة: \u2068نتائج مقبولة، والتحسن ممكن\u2069');
  await press('apprec-use-fair-2');
  expect(texts()).toContain('2. \u2068تلميذة ثانية\u2069');
  expect(has('apprec-complete')).toBe(false);
});

test('a phrase that only restates the mark is warned about, and a phrase can be cleared', async () => {
  const data = await marked();
  await mount(data, screen);
  await press('apprec-use-fair-mark');
  expect(texts()).toContain('1. \u2068تلميذة أولى\u2069');
  expect(texts()).toEqual(
    expect.arrayContaining([
      'مختارة: \u2068مقبول\u2069',
      'العبارة تكرّر النقطة وحدها، ولا تضيف تقديراً.',
      '1 من 3 مختارة',
    ]),
  );
  await press('apprec-clear');
  expect(chosen(data)).toEqual([]);
  expect(has('apprec-chosen')).toBe(false);
  expect(texts()).toContain('0 من 3 مختارة');
});

test('by conduct too, the term’s counts and the phrase for a concern come first', async () => {
  const data = await marked();
  const [session] = sessionsBetween(context(data), DAY, DAY, new Set(['c-1']));
  await data.book.record(DAY, setCapture(refOf(session), 'p-1', 'behaviour', 2));
  await mount(data, screen);
  await pressSegment('apprec-by', 'conduct');
  expect(texts()).toEqual(
    expect.arrayContaining([
      'في الفصل: لا غياب · لا تأخر · ملاحظتا سلوك',
      'مقترح حسب المعدل والسلوك والمواظبة',
      'نتائج مقبولة، والمواظبة تساعد على التحسن',
    ]),
  );
  expect(has('apprec-use-fair-1')).toBe(true);
  await press('apprec-next');
  expect(texts()).toContain('في الفصل: لا غياب · لا تأخر · لا ملاحظة سلوك');
  expect(texts()).toContain('نتائج ضعيفة، تحتاج إلى مراجعة منتظمة ومتابعة');
});

test('a pupil with no average gets no suggestion and the whole list', async () => {
  const data = await marked();
  await data.book.record(DAY, pupil('p-4', 'تلميذة رابعة'));
  await mount(data, screen);
  await press('apprec-previous');
  expect(texts()).toEqual(
    expect.arrayContaining([
      '4. \u2068تلميذة رابعة\u2069',
      'لا معدل بعد، فلا اقتراح: تُختار العبارة من القائمة كاملة.',
    ]),
  );
  expect(has('apprec-confirm')).toBe(false);
  const uses = root().findAll((node) => /^apprec-use-/.test(String(node.props.testID)));
  expect(new Set(uses.map((node) => node.props.testID as string)).size).toBe(19);
});

test('an archived class shows its phrases without choices', async () => {
  const data = await marked();
  const room = data.book.state.classes.get('k-1')!;
  await data.book.recordAll(DAY, [
    {
      kind: 'appreciation.set',
      appreciation: {
        courseId: 'c-1',
        term: 1,
        pupilId: 'p-1',
        phrase: { id: 'x', text: 'نتائج حسنة', release: '2026.1' },
      },
    },
    { kind: 'class.set', schoolClass: { ...room, archivedFrom: DAY } },
  ]);
  await mount(data, screen);
  expect(texts()).toContain('هذا القسم مؤرشف بعد إعادة التشكيل: تظهر عباراته ولا تُختار عبارات جديدة.');
  expect(['apprec-confirm', 'apprec-by', 'apprec-use-weak-2', 'apprec-chosen'].filter(has)).toEqual([]);
  await press('apprec-previous');
  expect(texts()).toContain('مختارة: \u2068نتائج حسنة\u2069');
  expect(has('apprec-clear')).toBe(false);
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  missingKeys.length = 0;
  const data = await marked();
  await mount(data, screen);
  await pressSegment('apprec-by', 'conduct');
  await press('apprec-confirm', 'apprec-confirm', 'apprec-confirm');
  await unmount();
  await mount(data, hub());
  expect(missingKeys).toEqual([]);
});
