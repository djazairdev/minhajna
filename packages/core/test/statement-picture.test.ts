// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's picture of a school (#246, R-Picture, answer 490): the latest
// school year only, one part per grade with the statements and keys in its
// cells counted, each cell the latest statement for its class and subject,
// rows by section name, and rows grouped by school only when two schools are
// named, else a sign that rows may merge; a statement dated after it came, or
// outside its school year, left out and counted. Made-up keys and statements
// only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDay, statementPicture, type ProgressStatement, type Received, type TeacherName } from '../src/index.ts';

let kept = 0;
function received(
  spki: string,
  day: string,
  section: string,
  subject = 'arabic',
  grade = '4am',
  year = '2026-2027',
  came = day,
) {
  kept += 1;
  const statement = {
    day: parseDay(day),
    class: { level: 'cem', grade, section, subject, year },
  } as unknown as ProgressStatement;
  return { id: `r-${kept}`, day: parseDay(came), how: 'qr', text: `t-${kept}`, spki, statement } satisfies Received;
}
const named = (entries: [string, string, string?][]) =>
  new Map<string, TeacherName>(
    entries.map(([spki, name, school]) => [spki, { spki, name, ...(school !== undefined && { school }) }]),
  );
const cell = (row: { readonly cells: ReadonlyMap<string, Received> } | undefined, subject: string) =>
  row?.cells.get(subject)?.id;

test('the latest year, one part per grade, each cell the latest statement for its class and subject', () => {
  const list = [
    received('k-1', '2026-06-01', '4M1', 'arabic', '4am', '2025-2026'),
    received('k-1', '2026-10-01', '4M10'),
    received('k-1', '2026-10-08', '4M10'),
    received('k-2', '2026-10-08', '4M2'),
    received('k-1', '2026-10-08', '4M10'),
    received('k-3', '2026-10-05', '4M2', 'math'),
    received('k-3', '2026-10-05', '1M1', 'math', '1am'),
  ];
  const picture = statementPicture(list, new Map());
  assert.equal(picture.year, '2026-2027');
  assert.deepEqual(
    picture.grades.map((grade) => [grade.grade, grade.subjects, grade.statements, grade.teachers, grade.groups.length]),
    [
      ['4am', ['arabic', 'math'], 3, 3, 1],
      ['1am', ['math'], 1, 1, 1],
    ],
  );
  const [group] = picture.grades[0]!.groups;
  assert.equal(group!.school, null);
  assert.deepEqual(
    group!.rows.map((row) => [row.section, cell(row, 'arabic') ?? null, cell(row, 'math') ?? null]),
    [
      ['4M2', 'r-4', 'r-6'],
      ['4M10', 'r-5', null],
    ],
  );
  assert.deepEqual([picture.latest, picture.leftOut, picture.mayMerge], ['2026-10-08', 0, true]);
  assert.deepEqual(statementPicture([], new Map()), {
    year: null,
    grades: [],
    latest: null,
    leftOut: 0,
    mayMerge: false,
  });
});

test('a statement dated after it came, or outside its school year, is left out and counted', () => {
  const list = [
    received('k-1', '2026-10-01', '4M1'),
    received('k-2', '2099-10-01', '4M1', 'arabic', '4am', '2099-2100', '2026-10-02'),
    received('k-2', '2026-10-09', '4M1', 'arabic', '4am', '2026-2027', '2026-10-02'),
    received('k-2', '2026-10-01', '4M1', 'arabic', '4am', '2027-2028'),
    received('k-2', '2026-10-01', '4M1', 'arabic', '4am', '2026-2028'),
  ];
  const picture = statementPicture(list, new Map());
  assert.deepEqual([picture.year, picture.leftOut, picture.latest], ['2026-2027', 4, '2026-10-01']);
  assert.equal(cell(picture.grades[0]!.groups[0]!.rows[0], 'arabic'), list[0]!.id);
});

test('rows are grouped by school only when the teachers were named with two schools', () => {
  const list = [
    received('k-1', '2026-10-01', '4M1'),
    received('k-2', '2026-10-01', '4M1'),
    received('k-3', '2026-10-01', '4M2', 'math'),
  ];
  const one = statementPicture(list, named([['k-1', 'Teacher A', 'School B']]));
  assert.equal(one.mayMerge, true);
  assert.deepEqual(
    one.grades[0]!.groups.map((group) => [group.school, group.rows.map((row) => row.section)]),
    [[null, ['4M1', '4M2']]],
  );
  const two = statementPicture(
    list,
    named([
      ['k-1', 'Teacher A', 'School B'],
      ['k-2', 'Teacher C', 'School A'],
      ['k-3', 'Teacher D'],
    ]),
  );
  assert.deepEqual(
    two.grades[0]!.groups.map((group) => [group.school, group.rows.map((row) => [row.section, [...row.cells.keys()]])]),
    [
      ['School A', [['4M1', ['arabic']]]],
      ['School B', [['4M1', ['arabic']]]],
      [null, [['4M2', ['math']]]],
    ],
  );
  assert.equal(two.mayMerge, false);
  assert.equal(statementPicture(list.slice(0, 1), new Map()).mayMerge, false);
});
