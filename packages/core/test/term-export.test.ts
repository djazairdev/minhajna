// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The term export (#242, answer 466): each pupil in list order with the parts
// the formula weighs, the average and the appreciation; not ready while a part
// or an appreciation is missing, an absence counting as a value; the CSV file,
// with its byte-order mark, marking line, header, two decimals and «غائب», a
// name a spreadsheet would run as a formula made safe and a comma quoted; the
// file read back by its own separator, quotes and line breaks included; and the
// check setting the register beside the file, a comma decimal read as a point,
// a value that differs, a line or a column missing. Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkExport,
  exportCsv,
  parseCsv,
  setMark,
  termExport,
  type AppreciationEntry,
  type AssessmentData,
  type CsvLabels,
  type MarkTarget,
  type MarkValue,
  type RecordEvent,
  type TermExport,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const data: AssessmentData = {
  country: 'dz',
  release: 'test.1',
  presets: [
    {
      level: 'cem',
      scale: 20,
      circular: '270',
      rulesYear: '2025-2026',
      components: [{ id: 'a', name: { ar: 'a' }, capture: 'manual', points: 20, min: 1, max: 20 }],
      source: 'Made up.',
    },
  ],
  formulas: [{ level: 'cem', id: 'cem', weights: { T: 1, F: 1, E: 4 } }],
};

const PUPILS = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10'];
const mark = (target: MarkTarget, pupilId: string, value: MarkValue) =>
  setMark({ courseId: 'c-math', term: 1, target, pupilId }, value, 20);
const marks = (pupilId: string, exam: MarkValue): RecordEvent[] => [
  mark({ kind: 'component', componentId: 'a' }, pupilId, 15),
  mark({ kind: 'test', testId: 't-1' }, pupilId, 12),
  mark({ kind: 'exam' }, pupilId, exam),
];
const phrase = (pupilId: string): RecordEvent => {
  const appreciation: AppreciationEntry = {
    courseId: 'c-math',
    term: 1,
    pupilId,
    phrase: { id: 'good-1', text: 'نتائج حسنة تستحق المواصلة', release: '2026.1' },
  };
  return { kind: 'appreciation.set', appreciation };
};
const testOn: RecordEvent = {
  kind: 'test.set',
  test: {
    id: 't-1',
    courseId: 'c-math',
    day: d('2026-11-08'),
    slot: { half: 'morning', index: 1 },
    groupId: 'g-all',
    title: 't-1',
  },
};

test('the export is ready once every part and appreciation is there, an absence counting as a value', async () => {
  const book = await openBook(cemEvents());
  await book.recordAll(d('2026-12-10'), [testOn, ...marks('p01', 14), ...marks('p02', 'absent'), phrase('p01')]);
  const first = termExport(contextOf(book), data, 'c-math', 1);
  assert.ok(first);
  assert.deepEqual([first.parts, first.averaged, first.scale, first.rows.length], [['T', 'F', 'E'], true, 20, 10]);
  assert.deepEqual(first.rows[0], {
    pupilId: 'p01',
    number: 1,
    values: { T: 15, F: 12, E: 14 },
    average: 83 / 6,
    appreciation: 'نتائج حسنة تستحق المواصلة',
  });
  assert.deepEqual([first.rows[1]?.values.E, first.rows[1]?.average], ['absent', null]);
  assert.equal(first.missingMarks.length, 24);
  assert.deepEqual(first.missingMarks.slice(0, 3), [
    { pupilId: 'p03', part: 'T' },
    { pupilId: 'p03', part: 'F' },
    { pupilId: 'p03', part: 'E' },
  ]);
  assert.deepEqual(first.missingAppreciations, PUPILS.slice(1));
  assert.equal(first.ready, false);
  await book.recordAll(d('2026-12-11'), [
    ...PUPILS.slice(2).flatMap((id) => marks(id, 10)),
    ...PUPILS.slice(1).map(phrase),
  ]);
  const done = termExport(contextOf(book), data, 'c-math', 1);
  assert.deepEqual([done?.missingMarks, done?.missingAppreciations, done?.ready], [[], [], true]);
  assert.equal(termExport(contextOf(book), data, 'c-none', 1), null);
});

const labels: CsvLabels = {
  number: 'الرقم',
  name: 'الاسم واللقب',
  parts: { T: 'التقويم', F: 'الفرض', E: 'الاختبار', P: 'التطبيقي', O: 'الشفهي' },
  average: 'المعدل',
  appreciation: 'التقدير',
  absent: 'غائب',
};
const sheet: TermExport = {
  parts: ['T', 'F', 'E'],
  averaged: true,
  scale: 20,
  rows: [
    { pupilId: 'a', number: 1, values: { T: 16.5, F: 10.25, E: 13 }, average: 13.125, appreciation: 'نتائج "حسنة"' },
    { pupilId: 'b', number: 2, values: { T: 15, F: 11, E: 'absent' }, average: null, appreciation: 'نتائج مقبولة' },
  ],
  missingMarks: [],
  missingAppreciations: [],
  ready: true,
};
const names = new Map([
  ['a', 'أمين; رياض'],
  ['b', '=HYPERLINK("x")'],
]);
const csv = exportCsv(
  sheet,
  (id) => names.get(id) ?? id,
  ['داخلي · سري', '4م2', 'اللغة العربية', 'الفصل الأول', '2026-2027'],
  labels,
);

test('the CSV file has its mark, header and a line per pupil, safe for a spreadsheet', () => {
  assert.equal(
    csv,
    '\uFEFFداخلي · سري;4م2;اللغة العربية;الفصل الأول;2026-2027\r\n' +
      'الرقم;الاسم واللقب;التقويم;الفرض;الاختبار;المعدل;التقدير\r\n' +
      '1;"أمين; رياض";16,50;10,25;13,00;13,13;"نتائج ""حسنة"""\r\n' +
      `2;"'=HYPERLINK(""x"")";15,00;11,00;غائب;;نتائج مقبولة\r\n`,
  );
  const table = parseCsv(csv);
  assert.equal(table.length, 4);
  assert.deepEqual(table[2], ['1', 'أمين; رياض', '16,50', '10,25', '13,00', '13,13', 'نتائج "حسنة"']);
  assert.deepEqual(table[3]?.[1], `'=HYPERLINK("x")`);
  assert.deepEqual(parseCsv('a,"b,\nc",d\ne,f,g'), [
    ['a', 'b,\nc', 'd'],
    ['e', 'f', 'g'],
  ]);
  assert.deepEqual(parseCsv('a\tb\r\nc\td\r\n'), [
    ['a', 'b'],
    ['c', 'd'],
  ]);
  const dotted = exportCsv(sheet, (id) => id, ['x'], { ...labels, absent: 'Abs.' });
  assert.match(dotted, /;15,00;11,00;Abs\.;;/);
  assert.equal(checkExport(sheet, parseCsv(dotted), (id) => id, { ...labels, absent: 'Abs.' }).matched, 2);
  assert.deepEqual(parseCsv('title\n1;2;3\n4;5,5;6\n'), [['title'], ['1', '2', '3'], ['4', '5,5', '6']]);
});

const nameOf = (id: string) => names.get(id) ?? id;
const check = (text: string) => checkExport(sheet, parseCsv(text), nameOf, labels);

test('the check sets the register beside the file, and shows each value that differs', () => {
  const same = check(csv);
  assert.deepEqual([same.matched, same.missingColumns, same.extra, same.twice], [2, [], [], []]);
  assert.deepEqual(
    same.rows[1]?.cells.map((cell) => [cell.part, cell.register, cell.file]),
    [
      ['name', '=HYPERLINK("x")', `'=HYPERLINK("x")`],
      ['T', '15.00', '15,00'],
      ['F', '11.00', '11,00'],
      ['E', 'غائب', 'غائب'],
      ['average', '', ''],
    ],
  );
  const commas = check(
    csv
      .replace(/(\d),(\d)/g, '$1.$2')
      .replace(/;/g, ',')
      .replace('16.50,10.25', '"16,5",10.25')
      .replace('أمين, رياض', 'أمين;  رياض'),
  );
  assert.deepEqual(
    [commas.matched, commas.rows[0]?.cells.map((cell) => cell.same)],
    [2, [true, true, true, true, true]],
  );
  const wrong = check(csv.replace('15,00;11,00', '15,00;12,25').replace('16,50', '16.504'));
  assert.equal(wrong.matched, 0);
  assert.deepEqual(wrong.rows[1]?.cells[2], { part: 'F', register: '11.00', file: '12,25', same: false });
  assert.deepEqual(wrong.rows[0]?.cells[1], { part: 'T', register: '16.50', file: '16.504', same: false });
  const renamed = check(csv.replace('أمين; رياض', 'رياض أمين'));
  assert.deepEqual([renamed.matched, renamed.rows[0]?.cells[0]?.same], [1, false]);
  const lines = csv.split('\r\n');
  const short = check(lines.slice(0, 3).join('\r\n'));
  assert.deepEqual([short.matched, short.rows[1]?.cells[1]?.file], [1, null]);
  const more = check([...lines.slice(0, 4), lines[3], lines[3]?.replace(/^2;/, '3;')].join('\r\n'));
  assert.deepEqual([more.matched, more.extra, more.twice], [2, [3], [2]]);
  const noExam = check(csv.replace('الاختبار', 'Exam'));
  assert.deepEqual([noExam.matched, noExam.missingColumns], [0, ['E']]);
});
