// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Schools' marks (#626, answer 677): a school keeps one mark in a world for
// the run, another school another, each world apart, a later world of the same
// ID afresh; a mark shows nothing of its code; past a world's cap or every
// world's, a school is UNCOUNTED, and forgetting a world frees its marks; and a
// figure's schools are the most distinct marks of any one run, UNCOUNTED left
// out. Every code here is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MARK, SchoolMarks, schoolsIn, UNCOUNTED } from '../src/insights/school-marks.js';

const code = (school: number) => school.toString(16).padStart(64, 'c');

describe('schools’ marks', () => {
  it('gives a school one mark in a world for the run, and another school another', () => {
    const marks = new SchoolMarks();
    const first = marks.mark('AAAAA', 'start', code(1));
    assert.match(first, MARK);
    assert.equal(marks.mark('AAAAA', 'start', code(1)), first);
    const second = marks.mark('AAAAA', 'start', code(2));
    assert.notEqual(second, first);
    assert.equal(second.slice(0, 9), first.slice(0, 9));
    assert.equal(first.includes(code(1).slice(0, 8)), false);
    const elsewhere = marks.mark('BBBBB', 'start', code(1));
    assert.match(elsewhere, MARK);
    assert.notEqual(new SchoolMarks().mark('AAAAA', 'start', code(1)).slice(0, 8), first.slice(0, 8));
  });

  it('starts afresh for a later world of the same ID', () => {
    const marks = new SchoolMarks();
    marks.mark('AAAAA', 'start-1', code(1));
    const fresh = marks.mark('AAAAA', 'start-2', code(2));
    assert.equal(fresh.endsWith('.0'), true);
  });

  it('marks a school UNCOUNTED past a world’s cap or every world’s, and frees a world’s marks with it', () => {
    const marks = new SchoolMarks(2, 3);
    assert.match(marks.mark('AAAAA', 'start', code(1)), MARK);
    assert.match(marks.mark('AAAAA', 'start', code(2)), MARK);
    assert.equal(marks.mark('AAAAA', 'start', code(3)), UNCOUNTED);
    assert.match(marks.mark('BBBBB', 'start', code(1)), MARK);
    assert.equal(marks.mark('BBBBB', 'start', code(2)), UNCOUNTED);
    marks.forget(['AAAAA']);
    assert.match(marks.mark('BBBBB', 'start', code(2)), MARK);
  });

  it('counts a figure’s schools as the most distinct marks of any one run, UNCOUNTED left out', () => {
    assert.equal(schoolsIn([]), 0);
    assert.equal(schoolsIn([UNCOUNTED, UNCOUNTED]), 0);
    assert.equal(schoolsIn(['0000000a.0', '0000000a.1', '0000000a.0', UNCOUNTED]), 2);
    assert.equal(schoolsIn(['0000000a.0', '0000000a.1', '0000000b.0', '0000000b.1', '0000000b.2']), 3);
  });
});
