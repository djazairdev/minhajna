// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A seeded school's share of the totals (#596, answer 628): prepared from the
// term generator's weeks, never signed, it is the share the school's signed
// copies of the same weeks give, ID included: each course's weeks in the term
// up to the day, at their latest version, and none outside it; and, with the
// school's plans, how far each grade got, each class's position taken over the
// year's weeks up to the day, an item no class reached left out and a subject
// without plans giving no grades (#601, answer 631); the last subjects' grades
// left out when the share would be heavier than the server takes; a week naming
// a subject or item as an object's own left out; and plans written otherwise,
// an item twice or a name an object holds among them, or a year starting after
// the term, are refused. Every world, school, teacher, class and week is made
// up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  certificateRequest,
  issueCertificate,
  newId,
  parseDay,
  MOST_GRADE_ITEMS,
  prepareShare,
  seededShare,
  SHARE_BYTES,
  signWeek,
  startKeyring,
  WEEK_FORMAT,
  type WeekForTotals,
  type WeekTotals,
} from '../src/index.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';

const WORLD = 'K7QF5';
const [from, day] = [parseDay('2026-09-20'), parseDay('2026-12-10')];
const STAFFING = { math: { teachers: 2, vacantPosts: 1, hoursWithoutTeacher: 4 } };

const totals = (subject: string, reached: number, item: string): WeekTotals => ({
  subject,
  items: [{ item, sessions: 2, outcome: 'taught' }],
  reached,
  runsLong: reached > 500,
  covered: 1,
  closed: 0,
});

describe('a seeded school’s share', () => {
  it('is the share the same weeks give once signed, outside the term left out', async () => {
    const director = await device();
    const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    const [one, two] = [newId(random), newId(random)];
    const week = (course: string, first: string, version: number, figures: WeekTotals): WeekForTotals => ({
      course,
      week: parseDay(first),
      version,
      totals: figures,
    });
    const weeks = [
      { versions: [week(one, '2026-09-13', 0, totals('math', 10, 'u1.l1'))] },
      {
        versions: [
          week(one, '2026-10-04', 0, totals('math', 90, 'u1.l2')),
          week(one, '2026-10-04', 1, totals('math', 120, 'u1.l2')),
        ],
      },
      { versions: [week(one, '2026-10-11', 0, totals('math', 600, 'u1.l3'))] },
      { versions: [week(two, '2026-10-04', 0, totals('science', 40, 's1.l1'))] },
      { versions: [week(two, '2026-12-13', 0, totals('science', 80, 's1.l2'))] },
    ];
    const common = { school: opened, day, from, directorate: '16-east', staffing: STAFFING };
    const share = await seededShare({ ...common, weeks }, director.crypto);
    const ca = keySigner();
    const signer = keySigner();
    const request = await certificateRequest(WORLD, newId(random), signer);
    const certificate = await issueCertificate(request, from, newId(random), ca);
    const signed = await Promise.all(
      weeks.flatMap(({ versions }) =>
        versions.map(({ course, week: first, version, totals: figures }) => {
          const sessions = [{ day: first, lesson: 'lesson' }];
          const text = JSON.stringify({ format: WEEK_FORMAT, course, week: first, version, totals: figures, sessions });
          return signWeek(text, certificate, signer);
        }),
      ),
    );
    const signers = { [one]: [signer.publicKey], [two]: [signer.publicKey] };
    const caKey = { world: WORLD, key: ca.publicKey, checker: ca };
    assert.deepEqual(share, await prepareShare({ ...common, weeks: signed, signers, ca: caKey }, director.crypto));
    assert.deepEqual(
      [share.subjects['math']!.classes, share.subjects['math']!.reached, share.subjects['science']!.classes],
      [1, 600, 1],
    );
    assert.deepEqual(Object.keys(share.subjects['math']!.items), ['u1.l2', 'u1.l3']);
    assert.deepEqual(Object.keys(share.subjects['science']!.items), ['s1.l1']);
    assert.equal('grades' in share.subjects['math']!, false);
    const plans = { [one]: { grade: '1am', teacher: 'teacher-1', items: ['u1.l1', 'u1.l2', 'u1.l3', 'u1.l4'] } };
    const graded = { ...common, plans, yearFrom: parseDay('2026-09-06') };
    const reach = await seededShare({ ...graded, weeks }, director.crypto);
    assert.deepEqual(reach, await prepareShare({ ...graded, weeks: signed, signers, ca: caKey }, director.crypto));
    assert.deepEqual(reach.subjects['math']!.grades, {
      '1am': { teachers: 1, classes: 1, items: { 'u1.l1': 1, 'u1.l2': 1, 'u1.l3': 1 } },
    });
    assert.equal('grades' in reach.subjects['science']!, false);
    assert.deepEqual(
      { ...reach.subjects['math']!, grades: undefined },
      { ...share.subjects['math']!, grades: undefined },
    );
  });

  it('leaves out the last subjects’ grades when the share would be heavier than the server takes', async () => {
    const director = await device();
    const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    const items = Array.from(
      { length: MOST_GRADE_ITEMS },
      (_, at) => `unit-${String(at).padStart(4, '0')}.${'x'.repeat(54)}`,
    );
    const courses = ['math', 'science'].map((subject) => ({ subject, course: newId(random) }));
    const weeks = courses.map(({ subject, course }) => ({
      versions: [{ course, week: parseDay('2026-10-04'), version: 0, totals: totals(subject, 900, items.at(-1)!) }],
    }));
    const plans = Object.fromEntries(
      courses.map(({ course }) => [course, { grade: '4am', teacher: 'teacher-1', items }]),
    );
    const common = { school: opened, day, from, directorate: '16-east', staffing: STAFFING, plans };
    const share = await seededShare({ ...common, weeks }, director.crypto);
    assert.equal(Object.keys(share.subjects['math']!.grades!['4am']!.items).length, MOST_GRADE_ITEMS);
    assert.equal('grades' in share.subjects['science']!, false);
    assert.equal(JSON.stringify(share).length <= SHARE_BYTES, true);
  });

  it('leaves out a week naming a subject or item as an object’s own', async () => {
    const director = await device();
    const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    const course = newId(random);
    const week = (subject: string, item: string) => ({
      versions: [{ course, week: parseDay('2026-10-04'), version: 0, totals: totals(subject, 100, item) }],
    });
    const common = { school: opened, day, from, directorate: '16-east', staffing: {} };
    for (const weeks of [[week('constructor', 'u1.l1')], [week('math', '__proto__')]]) {
      const share = await seededShare({ ...common, weeks }, director.crypto);
      assert.deepEqual(share.subjects, {});
    }
  });

  it('refuses plans written otherwise, and a year that starts after the term', async () => {
    const director = await device();
    const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    const common = { school: opened, day, from, directorate: '16-east', staffing: STAFFING, weeks: [] };
    const plan = { grade: '1am', teacher: 'teacher-1', items: ['u1.l1'] };
    const refused = (changes: object) =>
      assert.rejects(seededShare({ ...common, ...changes }, director.crypto), RangeError);
    await refused({ plans: { 'not-a-course': plan } });
    await refused({ plans: { [newId(random)]: { ...plan, grade: '' } } });
    await refused({ plans: { [newId(random)]: { ...plan, items: ['bad item'] } } });
    await refused({ plans: [] });
    await refused({ plans: { [newId(random)]: { ...plan, items: ['u1.l1', 'u1.l1'] } } });
    await refused({ plans: { [newId(random)]: { ...plan, grade: 'constructor' } } });
    await refused({ plans: { [newId(random)]: { ...plan, items: ['__proto__'] } } });
    await refused({ yearFrom: parseDay('2026-10-01') });
  });
});
