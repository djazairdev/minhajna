// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «ملاحظات وصفية» (#240, P-Obs, answer 464): in 1AP's first term the Marks hub
// says observations replace marks and shows their row in place of the rows of
// marks, tests, the exam, «كشف النقاط», «التقديرات» and «التصدير الفصلي», and
// the second term has marks again; the screen's line, chips for the class's
// observed subjects, the counts, and each pupil's three choices, a tap
// recording one and a second clearing it; an archived class's observations
// shown without choices; no printed grade book and no justification for an
// observed term; and every text found in each language. Made-up records only.

import { observationsFor, type RecordEvent } from '@minhajna/core';
import { useWindowDimensions } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { accessibilityProblems } from '../jest/accessibility';
import type { TestData } from '../jest/app-data';
import { DAY, mount, press, root, texts, unmount } from '../jest/components-screen';
import { withTest } from '../jest/marks-class';
import { course, primaryClass } from '../jest/specialist-classes';
import type { DocumentData } from '../src/documents/document-data';
import { bookCourses } from '../src/documents/grade-book-pages';
import { Marks } from '../src/marks/Marks';
import { MarksJustify } from '../src/marks/MarksJustify';
import { MarksObservations } from '../src/marks/MarksObservations';
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

const pupil = (id: string, name: string): RecordEvent => ({
  kind: 'pupil.set',
  pupil: { id, classId: 'k-p', name, sex: 'f', groups: [], movements: [] },
});

/** A 1AP class with Arabic and mathematics and three pupils. */
async function firstYear(archived = false): Promise<TestData> {
  const data = await withTest();
  const room = primaryClass('k-p', 's-1', '1ap', '1 ابتدائي ب');
  await data.book.recordAll(DAY, [
    room.kind === 'class.set' && archived ? { ...room, schoolClass: { ...room.schoolClass, archivedFrom: DAY } } : room,
    course('c-p', 'k-p', 'arabic'),
    course('c-m', 'k-p', 'math'),
    pupil('q-1', 'تلميذة أولى'),
    pupil('q-2', 'تلميذة ثانية'),
    pupil('q-3', 'تلميذة ثالثة'),
  ]);
  return data;
}

const onObservations = jest.fn();
const hub = (term?: number) => (
  <Marks
    courseId="c-p"
    {...(term !== undefined && { term })}
    onTerm={jest.fn()}
    onSetup={jest.fn()}
    onTests={jest.fn()}
    onCapture={jest.fn()}
    onComponents={jest.fn()}
    onBook={jest.fn()}
    onEntry={jest.fn()}
    onPart={jest.fn()}
    onObservations={onObservations}
    onAppreciations={jest.fn()}
    onExport={jest.fn()}
  />
);
const onCourse = jest.fn();
const screen = <MarksObservations courseId="c-p" term={1} onCourse={onCourse} />;
const has = (testID: string) => root().findAll((node) => node.props.testID === testID).length > 0;

test('in 1AP’s first term the hub shows observations in place of marks; the second has marks again', async () => {
  const data = await firstYear();
  await mount(data, hub());
  expect(texts()).toEqual(expect.arrayContaining(['الفصل الأول: ملاحظات بدل النقاط', 'الملاحظات: 0 من 3']));
  expect(
    ['marks-components', 'marks-book', 'marks-exam', 'marks-no-tests', 'marks-appreciations', 'marks-export'].filter(
      has,
    ),
  ).toEqual([]);
  expect(['marks-setup', 'marks-capture', 'marks-tests'].every(has)).toBe(true);
  expect(accessibilityProblems(root())).toEqual([]);
  await press('marks-observations');
  expect(onObservations).toHaveBeenCalledWith(1);
  await unmount();
  await mount(data, hub(2));
  expect(has('marks-observations')).toBe(false);
  expect(['marks-components', 'marks-exam', 'marks-appreciations', 'marks-export'].every(has)).toBe(true);
});

test('each pupil’s observation is chosen by hand, and a second tap clears it', async () => {
  const data = await firstYear();
  await mount(data, screen);
  expect(texts()).toEqual(
    expect.arrayContaining([
      'ملاحظات وصفية · 1 ابتدائي ب · اللغة العربية',
      'الفصل الأول: ملاحظات بدل النقاط',
      'مكتسب 0 · في طور الاكتساب 0 · غير مكتسب 0 · لم تُسجَّل 3',
      '1. \u2068تلميذة أولى\u2069',
    ]),
  );
  expect(accessibilityProblems(root())).toEqual([]);
  await press('observation-q-1-acquired', 'observation-q-2-not-acquired', 'observation-q-2-in-progress');
  expect([...observationsFor(data.book.state, 'c-p', 1)]).toEqual([
    ['q-1', 'acquired'],
    ['q-2', 'in-progress'],
  ]);
  expect(texts()).toContain('مكتسب 1 · في طور الاكتساب 1 · غير مكتسب 0 · لم تُسجَّل 1');
  await press('observation-q-1-acquired');
  expect(observationsFor(data.book.state, 'c-p', 1).has('q-1')).toBe(false);
  await ReactTestRenderer.act(async () => {
    (root().findByProps({ testID: 'observations-subject' }).props as { onSelect: (one: string) => void }).onSelect(
      'c-m',
    );
    await Promise.resolve();
  });
  expect(onCourse).toHaveBeenCalledWith('c-m');
  await unmount();
  await mount(data, hub());
  expect(texts()).toContain('الملاحظات: 1 من 3');
});

test('an archived class shows each pupil’s observation without choices', async () => {
  const data = await firstYear(true);
  await data.book.record(DAY, {
    kind: 'observation.set',
    observation: { courseId: 'c-p', term: 1, pupilId: 'q-2', value: 'acquired' },
  });
  await mount(data, screen);
  expect(texts()).toEqual(
    expect.arrayContaining(['1. \u2068تلميذة أولى\u2069: لم تُسجَّل', '2. \u2068تلميذة ثانية\u2069: مكتسب']),
  );
  expect(has('observation-q-1-acquired')).toBe(false);
});

test('the printed grade book leaves out the observed term, not the next', async () => {
  const data = await firstYear();
  const documents: DocumentData = {
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
  };
  const courses = (term: number) => bookCourses(documents, term).map((one) => one.courseId);
  expect(courses(1).filter((id) => id === 'c-p' || id === 'c-m')).toEqual([]);
  expect(courses(2)).toEqual(expect.arrayContaining(['c-p', 'c-m']));
});

test('the justification says the observed term has none, and the next term has its pages', async () => {
  const data = await firstYear();
  await mount(data, <MarksJustify courseId="c-p" term={1} />);
  expect(texts()).toContain('الفصل الأول: ملاحظات بدل النقاط');
  expect(has('justify-step')).toBe(false);
  await unmount();
  await mount(data, <MarksJustify courseId="c-p" term={2} />);
  expect(has('justify-step')).toBe(true);
});

test.each(['fr', 'en'] as const)('every text is found in %s', async (language) => {
  await i18n.changeLanguage(language);
  missingKeys.length = 0;
  const data = await firstYear();
  await mount(data, screen);
  await unmount();
  await mount(data, hub());
  expect(missingKeys).toEqual([]);
});
