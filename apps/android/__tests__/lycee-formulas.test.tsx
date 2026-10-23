// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Lycée's practical work and oral on the screens (#240, L-Marks, answer 463):
// «كشف النقاط» offers the formula the administration set, the level's first;
// choosing «مع الأعمال التطبيقية» records it, and the hub then names that
// formula and shows «الأعمال التطبيقية», which opens its entry; the entry is
// the exam's, with «غائب عن الأعمال التطبيقية»; the book shows «التطبيقي» in
// each row, «غ» leaving the average empty, and the formula with the pupil's
// values, on screen and printed; the justification shows it beside the test and
// the exam; the oral likewise, and with no exam window its row is disabled; a
// middle-school class has no choice, and an archived one takes none; and every
// text is found in each language. Made-up records only.

import { marksFor, setMark, type MarkTarget, type MarkValue } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { context, DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { withTest } from '../jest/marks-class';
import type { DocumentData } from '../src/documents/document-data';
import { gradeBookPages } from '../src/documents/grade-book-pages';
import { justifyPage } from '../src/marks/justify-rules';
import { Marks } from '../src/marks/Marks';
import { MarksBook } from '../src/marks/MarksBook';
import { MarksEntry } from '../src/marks/MarksEntry';
import { assessmentData, courseMarks } from '../src/marks/marks-rules';
import { i18n, missingKeys } from '../src/text/i18n';

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

const mark = (target: MarkTarget, pupilId: string, value: MarkValue, max = 20) =>
  setMark({ courseId: 'c-1', term: 1, target, pupilId }, value, max);

/** 4م1 made a first-year lycée class, each pupil with every component in full, the test at 10 and the exam at 14. */
async function lycee(archived = false): Promise<TestData> {
  const data = await withTest();
  const room = data.book.state.classes.get('k-1')!;
  await data.book.record(DAY, {
    kind: 'class.set',
    schoolClass: { ...room, level: 'lycee', grade: '1as', ...(archived && { archivedFrom: DAY }) },
  });
  const lines = courseMarks(data.book.state, assessmentData(data.profile)!, 'c-1', 1)?.assessment?.lines ?? [];
  await data.book.recordAll(
    DAY,
    ['p-1', 'p-2', 'p-3'].flatMap((id) => [
      ...lines.map((line) => mark({ kind: 'component', componentId: line.id }, id, line.points, line.points)),
      mark({ kind: 'test', testId: 't-1' }, id, 10),
      mark({ kind: 'exam' }, id, 14),
    ]),
  );
  return data;
}

const documentData = (data: TestData): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  calendarRelease: data.calendarRelease,
  packs: data.packs,
  bells: data.bells,
  day: DAY,
  lang: 'ar',
  dir: 'rtl',
});
const onPart = jest.fn();
const hub = () => (
  <Marks
    courseId="c-1"
    onTerm={jest.fn()}
    onSetup={jest.fn()}
    onTests={jest.fn()}
    onCapture={jest.fn()}
    onComponents={jest.fn()}
    onBook={jest.fn()}
    onEntry={jest.fn()}
    onPart={onPart}
    onObservations={jest.fn()}
    onAppreciations={jest.fn()}
  />
);
const book = <MarksBook courseId="c-1" term={1} onJustify={jest.fn()} onSignature={jest.fn()} />;
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;
const label = (pupilId: string) =>
  (root().findByProps({ testID: `book-row-${pupilId}` }).props as { accessibilityLabel: string }).accessibilityLabel;

/** Picks a choice of the formula. */
async function choose(value: string) {
  await ReactTestRenderer.act(async () => {
    (root().findByProps({ testID: 'book-formula-choice' }).props as { onSelect: (one: string) => void }).onSelect(
      value,
    );
    await Promise.resolve();
  });
}

test('the book offers the administration’s formula, and the hub then shows the practical work', async () => {
  const data = await lycee();
  await mount(data, hub());
  expect(texts()).toContain('(التقويم + الفرض + 2 × الاختبار) ÷ 4');
  expect(has('marks-practical')).toBe(false);
  await unmount();
  await mount(data, book);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'صيغة المعدل، كما تحددها الإدارة للمادة',
      'دون أعمال تطبيقية ولا شفهي',
      'مع الأعمال التطبيقية',
      'مع الشفهي',
      '(التقويم + الفرض + الأعمال التطبيقية + 2 × الاختبار) ÷ 5',
    ]),
  );
  expect(accessibilityProblems(root())).toEqual([]);
  await choose('lycee-practical');
  expect(data.book.state.formulas.get('c-1')).toBe('lycee-practical');
  await choose('lycee-practical');
  expect(data.book.entries.filter((entry) => entry.kind === 'formula.set')).toHaveLength(1);
  await unmount();
  await mount(data, hub());
  expect(texts()).toContain('(التقويم + الفرض + الأعمال التطبيقية + 2 × الاختبار) ÷ 5');
  expect(has('marks-oral')).toBe(false);
  await press('marks-practical');
  expect(onPart).toHaveBeenCalledWith(1, 'practical');
});

test('the practical work is entered like the exam, with its own «غائب»', async () => {
  const data = await lycee();
  await data.book.record(DAY, { kind: 'formula.set', courseId: 'c-1', formula: 'lycee-practical' });
  await mount(data, <MarksEntry courseId="c-1" term={1} part="practical" onDone={jest.fn()} />);
  expect(texts().some((one) => one.startsWith('\u2068الأعمال التطبيقية\u2069 · '))).toBe(true);
  expect(texts()).toContain('غائب عن الأعمال التطبيقية');
  await press('entry-absent');
  expect(marksFor(data.book.state, 'c-1', 1, { kind: 'practical' }).get('p-1')).toBe('absent');
  expect(marksFor(data.book.state, 'c-1', 1, { kind: 'exam' }).get('p-1')).toBe(14);
});

test('the book shows «التطبيقي», «غ» leaves the average empty, and the justification shows it', async () => {
  const data = await lycee();
  await data.book.recordAll(DAY, [
    { kind: 'formula.set', courseId: 'c-1', formula: 'lycee-practical' },
    mark({ kind: 'practical' }, 'p-1', 16),
    mark({ kind: 'practical' }, 'p-2', 'absent'),
  ]);
  await mount(data, book);
  expect(label('p-1')).toBe(
    '1. \u2068تلميذة أولى\u2069، التقويم 20.00، الفرض 10.00، التطبيقي 16.00، الاختبار 14.00، المعدل 14.80',
  );
  expect(label('p-2')).toMatch(/التطبيقي غ، الاختبار 14.00، المعدل —$/);
  await press('book-row-p-1');
  expect(texts()).toContain('(20.00 + 10.00 + 16.00 + 2 × 14.00) ÷ 5 = 14.80');
  const page = justifyPage(i18n.getFixedT('ar'), context(data), assessmentData(data.profile)!, {
    courseId: 'c-1',
    term: 1,
    month: undefined,
    pupilId: 'p-2',
    today: DAY,
    profile: data.profile,
  });
  expect(page?.parts).toBe('الفرض 10.00 · التطبيقي: غائب · الاختبار 14.00');
  const printed = gradeBookPages(documentData(data), i18n.getFixedT('ar'), false, { courseId: 'c-1', term: 1 });
  expect(printed).toContain('<th>التطبيقي</th><th>الاختبار</th><th>المعدل</th>');
  expect(printed).toContain('<td>20.00</td><td>10.00</td><td>16.00</td><td>14.00</td><td>14.80</td>');
  expect(printed).toContain('المعدل = (التقويم + الفرض + الأعمال التطبيقية + 2 × الاختبار) ÷ 5');
});

test('the oral has its row, entry and justification line; with no exam window its row is disabled', async () => {
  const data = await lycee();
  await data.book.recordAll(DAY, [
    { kind: 'formula.set', courseId: 'c-1', formula: 'lycee-oral' },
    mark({ kind: 'oral' }, 'p-1', 12),
  ]);
  await mount(data, hub());
  expect(has('marks-practical')).toBe(false);
  await press('marks-oral');
  expect(onPart).toHaveBeenLastCalledWith(1, 'oral');
  await unmount();
  await mount(data, <MarksEntry courseId="c-1" term={1} part="oral" onDone={jest.fn()} />);
  expect(texts().some((one) => one.startsWith('\u2068الشفهي\u2069 · '))).toBe(true);
  expect(texts()).toContain('غائب عن الشفهي');
  const page = justifyPage(i18n.getFixedT('ar'), context(data), assessmentData(data.profile)!, {
    courseId: 'c-1',
    term: 1,
    month: undefined,
    pupilId: 'p-1',
    today: DAY,
    profile: data.profile,
  });
  expect(page?.parts).toBe('الفرض 10.00 · الشفهي 12.00 · الاختبار 14.00 · المعدل 14.00');
  await unmount();
  await mount({ ...data, calendar: data.calendar.filter((entry) => entry.effect !== 'exam') }, hub());
  const row = root().findByProps({ testID: 'marks-oral' }).props as { disabled?: boolean; description?: string };
  expect([row.disabled, row.description]).toEqual([true, 'لا موعد للاختبار في رزنامة هذا الفصل']);
});

test('a middle-school class has no choice, and an archived lycée class takes none', async () => {
  await mount(await withTest(), book);
  expect(has('book-formula-choice')).toBe(false);
  await unmount();
  await mount(await lycee(true), book);
  expect((root().findByProps({ testID: 'book-formula-choice' }).props as { disabled?: boolean }).disabled).toBe(true);
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  missingKeys.length = 0;
  const data = await lycee();
  await data.book.record(DAY, { kind: 'formula.set', courseId: 'c-1', formula: 'lycee-oral' });
  await mount(data, book);
  await unmount();
  await mount(data, hub());
  expect(has('marks-oral')).toBe(true);
  await unmount();
  await mount(data, <MarksEntry courseId="c-1" term={1} part="oral" onDone={jest.fn()} />);
  expect(missingKeys).toEqual([]);
});
