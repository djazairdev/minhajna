// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The books' line once a pupil's data is erased (#248, Pupil-erase, answer
// 473): «حُذفت بيانات تلميذ واحد» under the roll-call book's month and yearly
// summary, on screen and printed, and under the grade book and the mark
// sheet, for every period that began before the pupil left, however late
// the erasure; none for a later period, nor for another class; and the line
// in French and English. The teacher has 4م1; made-up records only.

import { parseDay, type Day, type TermExport } from '@minhajna/core';
import { Text, useWindowDimensions, type TextProps } from 'react-native';
import type { TestData } from '../jest/app-data';
import { mount, root, texts, unmount } from '../jest/components-screen';
import { marked } from '../jest/marked-book';
import { withPupils } from '../jest/roll-class';
import type { DocumentData } from '../src/documents/document-data';
import { erasedLine } from '../src/documents/erased-line';
import { gradeBookPages } from '../src/documents/grade-book-pages';
import { markSheetPages } from '../src/documents/mark-sheet-pages';
import { rollBooks, rollSpreadPages } from '../src/documents/roll-spread-pages';
import { rollYearPages } from '../src/documents/roll-year-pages';
import { MarksBook } from '../src/marks/MarksBook';
import { RollMonth } from '../src/rollbook/RollMonth';
import { i18n, missingKeys } from '../src/text/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }));

beforeEach(() => {
  missingKeys.length = 0;
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
});
afterEach(async () => {
  await unmount();
  await i18n.changeLanguage('ar');
});

const t = i18n.getFixedT('ar');
const LINE = 'حُذفت بيانات تلميذ واحد';
const ERASED_ON = parseDay('2026-10-15');

/** The data with p-3 leaving on 11 October, confirmed, and their data erased on `on`, 15 October by default. */
async function erased(data: TestData, on: Day = ERASED_ON): Promise<TestData> {
  await data.book.record(parseDay('2026-10-12'), {
    kind: 'pupil.moved',
    pupilId: 'p-3',
    movement: { day: parseDay('2026-10-11'), kind: 'out', reason: 'transfer', confirmed: true },
  });
  await data.book.erasePupil(on, 'p-3');
  expect(data.book.state.pupils.has('p-3')).toBe(false);
  return data;
}

const documentData = (data: TestData, day: Day = ERASED_ON): DocumentData => ({
  state: data.book.state,
  profile: data.profile,
  year: data.year,
  calendar: data.calendar,
  calendarRelease: data.calendarRelease,
  packs: data.packs,
  bells: data.bells,
  day,
  today: parseDay('2026-10-18'),
  lang: 'ar',
  dir: 'rtl',
});

const screenLine = () =>
  root()
    .findAllByType(Text)
    .filter((node) => node.props.testID === 'book-erased')
    .map((node) => (node.props as TextProps).children);

test('the roll-call book says it under each month that began before, and under the year', async () => {
  const data = await erased(await withPupils());
  const book = rollBooks(documentData(data))[0];
  expect(book).toBeDefined();
  for (const month of ['2026-09', '2026-10']) {
    expect(rollSpreadPages(documentData(data), t, false, month, book && [book])).toContain(LINE);
  }
  expect(rollYearPages(documentData(data), t, false)).toContain(LINE);
  const props = { courseId: 'c-1', onMonth: jest.fn(), onRoll: jest.fn(), onRules: jest.fn() };
  for (const month of ['2026-09', '2026-10', 'year']) {
    await mount(data, <RollMonth {...props} month={month} />, '2026-10-18');
    expect(screenLine()).toEqual([LINE]);
    await unmount();
  }
});

test('no line on a book whose period began once the pupil left, however late the erasure', async () => {
  const data = await erased(await withPupils(), parseDay('2026-12-05'));
  const { state } = data.book;
  const book = rollBooks(documentData(data))[0];
  expect(rollSpreadPages(documentData(data), t, false, '2026-10', book && [book])).toContain(LINE);
  expect(rollSpreadPages(documentData(data), t, false, '2026-11', book && [book])).not.toContain('حُذفت');
  expect(erasedLine(t, state, 'k-1', parseDay('2026-10-10'))).toBe(LINE);
  expect(erasedLine(t, state, 'k-1', parseDay('2026-10-11'))).toBe('');
  expect(erasedLine(t, state, 'k-1', parseDay('2026-12-01'))).toBe('');
  expect(erasedLine(t, state, 'k-2', parseDay('2026-09-01'))).toBe('');
  const untouched = await withPupils();
  expect(rollYearPages(documentData(untouched), t, false)).not.toContain('حُذفت');
  await mount(
    untouched,
    <RollMonth courseId="c-1" month="year" onMonth={jest.fn()} onRoll={jest.fn()} onRules={jest.fn()} />,
  );
  expect(screenLine()).toEqual([]);
});

test('the grade book and the mark sheet say it for the term', async () => {
  const data = await erased(await marked());
  expect(gradeBookPages(documentData(data), t, false, { courseId: 'c-1', term: 1 })).toContain(
    `<p class="figures">${LINE}</p>`,
  );
  const sheet: TermExport = {
    parts: [],
    averaged: false,
    scale: 20,
    rows: [],
    missingMarks: [],
    missingAppreciations: [],
    ready: true,
  };
  expect(markSheetPages(documentData(data), t, 'c-1', 1, sheet)).toContain(`<p class="erased">${LINE}</p>`);
  await mount(data, <MarksBook courseId="c-1" term={1} onJustify={jest.fn()} onSignature={jest.fn()} />);
  expect(screenLine()).toEqual([LINE]);
  expect(texts()).not.toContain('تلميذة ثالثة');
});

test('the line in French and English, by count', async () => {
  const data = await erased(await withPupils());
  for (const [language, one, two] of [
    ['fr', 'Données d’un élève effacées', 'Données de 2 élèves effacées'],
    ['en', 'One pupil’s data erased', '2 pupils’ data erased'],
  ] as const) {
    const fixed = i18n.getFixedT(language);
    expect(erasedLine(fixed, data.book.state, 'k-1', parseDay('2026-09-01'))).toBe(one);
    expect(fixed('documents.erased', { count: 2 })).toBe(two);
  }
  expect(t('documents.erased', { count: 2 })).toBe('حُذفت بيانات تلميذين');
  expect(missingKeys).toEqual([]);
});
