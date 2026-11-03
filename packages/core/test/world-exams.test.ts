// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world's exams (#601, answer 631): the calendar's term exam windows as
// school exams, a grade's window running from its term's first exam day to its
// last and the grades with one window sitting one exam, an entry naming levels
// covering their grades, one naming no one covering everyone, and a zone's or a
// school's entry making that place's own exam; IDs that name the term, the
// place and what the exam covers, so they stay as entries move; the
// directorate's mock exam for the CEM's last grade four weeks before the week
// of its term 3 exams, and the BEM on the first Sunday of June, each within
// term 3 and moved off national days without school and the exams that grade
// sits; each with its figures day on the Thursday ten days before its week,
// earlier past a holiday or a break between terms, and its signing deadline
// five days before it; and the exams a class sits. Every calendar entry is made
// up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { examsFor, worldExams, type CalendarEntry, type SchoolYear } from '../src/index.ts';
import { d } from './fixtures.ts';

const year: SchoolYear = {
  id: '2026-2027',
  from: d('2026-09-20'),
  to: d('2027-07-08'),
  terms: [
    { number: 1, from: d('2026-09-20'), to: d('2026-12-17') },
    { number: 2, from: d('2027-01-03'), to: d('2027-03-18') },
    { number: 3, from: d('2027-04-04'), to: d('2027-07-08') },
  ],
  source: 'made up',
};

const window = (
  id: string,
  term: number,
  from: string,
  to: string,
  more: Partial<CalendarEntry> = {},
): CalendarEntry => ({
  id,
  layer: 'national',
  from: d(from),
  to: d(to),
  effect: 'exam',
  term,
  name: { en: id },
  source: 'made up',
  confidence: 'announced',
  ...more,
});

const closed = (id: string, from: string, to = from) =>
  ({
    id,
    layer: 'national',
    from: d(from),
    to: d(to),
    effect: 'no-school',
    name: { en: id },
    source: 'made up',
    confidence: 'announced',
  }) satisfies CalendarEntry;

const others = ['1am', '2am', '3am'];
const entries = [
  window('t1', 1, '2026-12-06', '2026-12-10', { grades: [...others, '4am'] }),
  window('t2a', 2, '2027-03-02', '2027-03-04', { grades: others }),
  window('t2a-4am', 2, '2027-03-02', '2027-03-04', { grades: ['4am'] }),
  window('t2b', 2, '2027-03-07', '2027-03-08', { grades: [...others, '4am'] }),
  window('t3-4am', 3, '2027-05-09', '2027-05-11', { grades: ['4am'] }),
  window('t3', 3, '2027-05-23', '2027-05-27', { grades: others }),
  window('primary', 3, '2027-05-30', '2027-06-01', { levels: ['primary'] }),
  window('zone', 2, '2027-02-14', '2027-02-15', { layer: 'zone', zone: '16', grades: ['1am'] }),
  closed('holiday', '2026-12-20', '2026-12-31'),
];

const ids = (list: readonly { id: string }[]) => list.map((one) => one.id);

describe('a demo world’s exams', () => {
  const exams = worldExams(year, entries);
  const by = (id: string) => exams.find((one) => one.id === id)!;

  it('makes a school exam of each term’s window, joining the grades and parts that share one', () => {
    assert.deepEqual(
      exams.map((one) => [one.id, one.setBy, one.from, one.to]),
      [
        ['term-1', 'school', '2026-12-06', '2026-12-10'],
        ['term-2-zone-16', 'school', '2027-02-14', '2027-02-15'],
        ['term-2', 'school', '2027-03-02', '2027-03-08'],
        ['mock', 'directorate', '2027-04-11', '2027-04-13'],
        ['term-3-4am', 'school', '2027-05-09', '2027-05-11'],
        ['term-3-1am-2am-3am', 'school', '2027-05-23', '2027-05-27'],
        ['term-3-primary', 'school', '2027-05-30', '2027-06-01'],
        ['bem', 'national', '2027-06-06', '2027-06-08'],
      ],
    );
    assert.deepEqual(by('term-2').grades, ['1am', '2am', '3am', '4am']);
    assert.deepEqual([by('term-2-zone-16').zone, by('term-2-zone-16').grades], ['16', ['1am']]);
    assert.deepEqual([by('term-3-primary').levels, by('term-3-primary').grades], [['primary'], []]);
  });

  it('keeps each exam’s ID as entries are reordered or another place’s are added', () => {
    const own = window('own', 3, '2027-05-09', '2027-05-10', { layer: 'school', schoolId: 's1', zone: '16' });
    const more = worldExams(year, [own, ...entries].reverse());
    assert.deepEqual(ids(more.filter((one) => one.id !== 'term-3-school-s1')), ids(exams));
    const school = more.find((one) => one.id === 'term-3-school-s1')!;
    assert.deepEqual([school.schoolId, school.zone, school.grades, school.levels], ['s1', undefined, [], []]);
  });

  it('takes the figures on the Thursday ten days before the exam’s week, the signatures five days before it', () => {
    assert.deepEqual([by('term-2').figuresDay, by('term-2').signBy], ['2027-02-18', '2027-02-25']);
    assert.deepEqual([by('bem').figuresDay, by('bem').signBy], ['2027-05-27', '2027-06-01']);
    assert.equal(by('mock').figuresDay, '2027-03-18');
    const moved = worldExams(
      year,
      entries.map((one) => (one.id === 't1' ? { ...one, from: d('2026-12-13') } : one)),
    );
    assert.equal(moved.find((one) => one.id === 'term-1')?.figuresDay, '2026-12-03');
  });

  it('moves a figures day and the made-up exams off national days without school', () => {
    const after = window('t1', 1, '2027-01-03', '2027-01-05', { grades: ['4am'] });
    const off = [closed('h1', '2027-04-12'), closed('h2', '2027-06-08'), closed('h3', '2027-06-15')];
    const moved = worldExams(year, [after, ...entries.slice(1), ...off]);
    const of = (id: string) => moved.find((one) => one.id === id)!;
    assert.equal(of('term-1').figuresDay, '2026-12-17');
    assert.deepEqual([of('mock').from, of('bem').from], ['2027-04-04', '2027-06-20']);
  });

  it('keeps the made-up exams within term 3 and off the exams the CEM’s last grade sits', () => {
    const late = (from: string, to: string) => (one: CalendarEntry) =>
      one.id === 't3-4am' ? { ...one, from: d(from), to: d(to) } : one;
    assert.deepEqual(ids(worldExams(year, entries.map(late('2027-04-25', '2027-04-27')))).includes('mock'), false);
    const june = worldExams(year, entries.map(late('2027-06-06', '2027-06-08')));
    assert.equal(june.find((one) => one.id === 'bem')?.from, '2027-06-13');
    const cramped = worldExams(year, entries.map(late('2027-07-04', '2027-07-06')));
    const of = (id: string) => cramped.find((one) => one.id === id)?.from;
    assert.deepEqual([of('mock'), of('bem')], ['2027-06-06', '2027-06-13']);
  });

  it('takes the mock exam’s week from the first national term 3 exam the CEM’s last grade sits', () => {
    const everyone = window('all', 3, '2027-05-04', '2027-05-06');
    const moved = worldExams(year, [...entries, everyone]);
    const all = moved.find((one) => one.id === 'term-3-all')!;
    assert.deepEqual([all.grades, all.levels], [[], []]);
    assert.equal(moved.find((one) => one.id === 'mock')?.from, '2027-04-04');
  });

  it('gives a class the exams its grade, level, zone and school sit', () => {
    const sat = (place: Parameters<typeof examsFor>[1]) => ids(examsFor(exams, place));
    assert.deepEqual(sat({ grade: '4am', level: 'cem' }), ['term-1', 'term-2', 'mock', 'term-3-4am', 'bem']);
    assert.deepEqual(sat({ grade: '1am', level: 'cem', zone: '16' }), [
      'term-1',
      'term-2-zone-16',
      'term-2',
      'term-3-1am-2am-3am',
    ]);
    assert.deepEqual(sat({ grade: '5ap', level: 'primary' }), ['term-3-primary']);
  });

  it('adds no mock exam without term 3 exams, and no BEM after the year', () => {
    const short: SchoolYear = {
      ...year,
      to: d('2027-05-31'),
      terms: [...year.terms.slice(0, 2), { ...year.terms[2]!, to: d('2027-05-31') }],
    };
    assert.deepEqual(ids(worldExams(short, entries.slice(0, 4))), ['term-1', 'term-2']);
  });
});
