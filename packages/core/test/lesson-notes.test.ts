// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Lesson notes (#237, answers 416 to 418): the head and the proposed paragraphs
// the plan gives a note, an item taught before a move read as the one it was
// carried to, the notes of a class numbered across its subjects in the order
// made and read across the courses it continues, the newest written note of an
// earlier year's class of the same subject, grade and pack, the plan paragraphs
// kept in the plan's order before the teacher's own, and the notes kept
// private, printed by the teacher and sent nowhere else. Made-up records only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  earlierNote,
  layerOf,
  makeContext,
  mayTravelAs,
  nextNoteNumber,
  noteDraft,
  noteFor,
  notesOf,
  noteWithOwn,
  noteWithoutPlan,
  noteWithPlan,
  packKey,
  parsePlanPack,
  recordsForRoute,
  type LessonNote,
  type NoteKey,
  type OutboundRoute,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, contextOf, d, mathPack, mathPackSource, openBook, reference } from './fixtures.ts';
import { withFix } from './migration-fixtures.ts';

function note(id: string, courseId: string, itemId: string, number: number, paragraphs: LessonNote['paragraphs'] = []) {
  return { id, courseId, itemId, number, paragraphs };
}

function set(lessonNote: LessonNote): RecordEvent {
  return { kind: 'lesson-note.set', note: lessonNote };
}

const written = [{ key: 'objectives' as const, text: 'Compare numbers' }];

/** A class and its maths course of `year` and `grade`, or of another subject or pack. */
function earlierClass(id: string, year: string, grade: string, subject = 'math', packId = mathPack.id): RecordEvent[] {
  return [
    {
      kind: 'class.set',
      schoolClass: { id: `k-${id}`, schoolId: 's-cem', level: 'cem', grade, name: id, groups: [] },
    },
    {
      kind: 'course.set',
      course: {
        id: `c-${id}`,
        classId: `k-${id}`,
        subject,
        year,
        pack: { id: packId, release: mathPack.release },
      },
    },
  ];
}

const order: NoteKey[] = ['indicator', 'objectives', 'resources', 'stage-1', 'stage-2', 'stage-3', 'stage-4'];

describe('lesson notes', () => {
  it('drafts the head and the proposed paragraphs from the plan', async () => {
    const book = await openBook(cemEvents());
    assert.deepEqual(noteDraft(contextOf(book), 'c-math', 'l1'), {
      unit: 'Whole numbers',
      resource: 'Reading and writing whole numbers',
      minutes: 120,
      proposals: [
        { key: 'indicator', text: '' },
        { key: 'objectives', text: '' },
        { key: 'resources', text: '' },
        { key: 'stage-1', stage: 'Warm-up', text: '' },
        { key: 'stage-2', stage: 'Construction', text: '' },
        { key: 'stage-3', stage: 'Practice', text: '' },
        { key: 'stage-4', stage: 'Assessment', text: '' },
      ],
    });
    assert.equal(noteDraft(contextOf(book), 'c-math', 'd1')?.unit, undefined);
    assert.equal(noteDraft(contextOf(book), 'c-math', 'missing'), null);
  });

  it('drafts an item taught before the class moved from the item it was carried to', async () => {
    const book = await openBook(cemEvents());
    const move = { courseId: 'c-math', from: '2026.1', to: '2026.2' };
    await book.record(d('2026-09-25'), { kind: 'course.moved', move });
    assert.equal(noteDraft(withFix(book), 'c-math', 'l1')?.resource, 'Reading and writing whole numbers l1b');
    assert.equal(noteDraft(withFix(book), 'c-math', 'l2')?.resource, 'Comparing and ordering l2a');
  });

  it('names the domain and the textbook pages when the plan gives them', async () => {
    const reading = { code: 'reading', name: { ar: 'قراءة', en: 'Reading' }, sessions: 3 };
    const parsed = parsePlanPack({
      ...mathPackSource,
      anchor: { kind: 'weeks' },
      activities: [reading],
      items: [{ id: 'x', kind: 'lesson', title: 'Read', week: 1, activity: 'reading', pages: '12–13', stages: 'std' }],
      merges: [],
    });
    assert.ok(parsed.ok);
    const packs = new Map(reference.packs).set(packKey(mathPack.id, mathPack.release), parsed.value);
    const book = await openBook(cemEvents());
    const draft = noteDraft(makeContext({ ...reference, packs }, book.state), 'c-math', 'x');
    assert.deepEqual(draft?.domain, reading.name);
    assert.equal(draft?.pages, '12–13');
    assert.equal(draft?.minutes, 60);
    assert.equal(draft?.unit, undefined);
  });

  it('numbers the notes across the class’s subjects this year, each subject keeping its own', async () => {
    const book = await openBook([
      ...cemEvents(),
      {
        kind: 'course.set',
        course: { id: 'c-sci', classId: 'k-1am2', subject: 'science', year: '2026-2027', pack: null },
      },
      ...earlierClass('other', '2026-2027', '1am'),
      {
        kind: 'course.set',
        course: { id: 'c-next', classId: 'k-1am2', subject: 'math', year: '2027-2028', pack: null },
      },
      set(note('n-math', 'c-math', 'l1', 1)),
      set(note('n-sci', 'c-sci', 'l1', 2)),
      set(note('n-other', 'c-other', 'l2', 7)),
      set(note('n-next', 'c-next', 'l2', 9)),
    ]);
    assert.deepEqual(
      notesOf(book.state, 'c-sci').map((one) => one.id),
      ['n-math', 'n-sci'],
    );
    assert.equal(nextNoteNumber(book.state, 'c-math'), 3);
    assert.equal(nextNoteNumber(book.state, 'c-sci'), 3);
    assert.equal(nextNoteNumber(book.state, 'c-other'), 8);
    assert.equal(nextNoteNumber(book.state, 'c-next'), 10);
    assert.equal(noteFor(book.state, 'c-math', 'l1')?.id, 'n-math');
    assert.equal(noteFor(book.state, 'c-sci', 'l1')?.id, 'n-sci');
    assert.equal(noteFor(book.state, 'c-math', 'l2'), undefined);
  });

  it('reads the notes of the courses a class’s courses continue', async () => {
    const book = await openBook([
      ...cemEvents(),
      ...earlierClass('old', '2026-2027', '1am'),
      set(note('n-old', 'c-old', 'l1', 1)),
      set(note('n-2', 'c-math', 'l2', 2)),
    ]);
    assert.deepEqual(
      notesOf(book.state, 'c-math').map((one) => one.id),
      ['n-2'],
    );
    assert.equal(nextNoteNumber(book.state, 'c-math'), 3);
    assert.equal(noteFor(book.state, 'c-math', 'l1'), undefined);
    await book.record(d('2026-10-01'), {
      kind: 'course.set',
      course: {
        ...(book.state.courses.get('c-math') ?? assert.fail('no course')),
        continues: { courseId: 'c-old', from: d('2026-10-01') },
      },
    });
    assert.deepEqual(
      notesOf(book.state, 'c-math').map((one) => one.id),
      ['n-old', 'n-2'],
    );
    assert.equal(noteFor(book.state, 'c-math', 'l1')?.id, 'n-old');
    assert.equal(nextNoteNumber(book.state, 'c-math'), 3);
    assert.equal(nextNoteNumber(book.state, 'c-none'), 1);
  });

  it('finds the newest written note for the item in an earlier year of the same subject, grade and pack', async () => {
    const book = await openBook([
      ...cemEvents(),
      ...earlierClass('2024', '2024-2025', '1am'),
      ...earlierClass('2025', '2025-2026', '1am'),
      ...earlierClass('grade', '2025-2026', '2am'),
      ...earlierClass('subject', '2025-2026', '1am', 'physics'),
      ...earlierClass('pack', '2025-2026', '1am', 'math', 'dz.cem.1am.math.other'),
      ...earlierClass('later', '2027-2028', '1am'),
      set(note('n-2024', 'c-2024', 'l1', 4, written)),
      set(note('n-2025', 'c-2025', 'l1', 1, written)),
      set(note('n-2025-l2', 'c-2025', 'l2', 2, written)),
      set(note('n-2025-l3', 'c-2025', 'l3', 3, [{ key: 'indicator', text: ' ' }])),
      set(note('n-2024-l3', 'c-2024', 'l3', 3, [{ title: 'Homework', text: 'Exercise 3' }])),
      set(note('n-2025-l4', 'c-2025', 'l4', 4)),
      set(note('n-grade', 'c-grade', 'l1', 9, written)),
      set(note('n-subject', 'c-subject', 'l1', 9, written)),
      set(note('n-pack', 'c-pack', 'l1', 9, written)),
      set(note('n-later', 'c-later', 'l1', 9, written)),
      set(note('n-now', 'c-math', 'l1', 1, written)),
    ]);
    assert.equal(earlierNote(book.state, 'c-math', 'l1')?.id, 'n-2025');
    assert.equal(earlierNote(book.state, 'c-math', 'l2')?.id, 'n-2025-l2');
    assert.equal(earlierNote(book.state, 'c-math', 'l3')?.id, 'n-2024-l3');
    assert.equal(earlierNote(book.state, 'c-math', 'l4'), undefined);
    assert.equal(earlierNote(book.state, 'c-math', 'l5'), undefined);
    assert.equal(earlierNote(book.state, 'c-2024', 'l1'), undefined);
    assert.equal(earlierNote(book.state, 'c-none', 'l1'), undefined);
  });

  it('matches the level a joint class’s course follows', async () => {
    const joint: RecordEvent[] = [
      ...earlierClass('joint', '2025-2026', '2am'),
      {
        kind: 'course.set',
        course: {
          id: 'c-joint',
          classId: 'k-joint',
          subject: 'math',
          year: '2025-2026',
          grade: '1am',
          pack: { id: mathPack.id, release: mathPack.release },
        },
      },
    ];
    const book = await openBook([...cemEvents(), ...joint, set(note('n-joint', 'c-joint', 'l1', 1, written))]);
    assert.equal(earlierNote(book.state, 'c-math', 'l1')?.id, 'n-joint');
  });

  it('keeps the plan paragraphs in the plan’s order, before the teacher’s own', () => {
    let kept = note('n', 'c-math', 'l1', 1);
    kept = noteWithOwn(kept, 0, { title: 'Homework', text: 'Exercise 3' });
    kept = noteWithPlan(kept, 'stage-2', 'Build the idea', order);
    kept = noteWithPlan(kept, 'indicator', 'Reads numbers', order);
    assert.deepEqual(kept.paragraphs, [
      { key: 'indicator', text: 'Reads numbers' },
      { key: 'stage-2', text: 'Build the idea' },
      { title: 'Homework', text: 'Exercise 3' },
    ]);
    kept = noteWithPlan(kept, 'indicator', 'Reads and writes numbers', order);
    assert.deepEqual(kept.paragraphs[0], { key: 'indicator', text: 'Reads and writes numbers' });
    assert.equal(kept.paragraphs.length, 3);
    kept = noteWithoutPlan(kept, 'indicator');
    assert.deepEqual(
      kept.paragraphs.map((one) => one.key ?? one.title),
      ['stage-2', 'Homework'],
    );
    kept = noteWithPlan(kept, 'stage-9', 'Extra', order);
    kept = noteWithPlan(kept, 'indicator', 'Reads', order);
    assert.deepEqual(
      kept.paragraphs.map((one) => one.key ?? one.title),
      ['indicator', 'stage-2', 'stage-9', 'Homework'],
    );
  });

  it('replaces, adds and removes the teacher’s own paragraphs', () => {
    let kept = note('n', 'c-math', 'l1', 1, [{ key: 'objectives', text: 'Compare' }]);
    kept = noteWithOwn(kept, 0, { title: 'A', text: 'one' });
    kept = noteWithOwn(kept, 5, { title: 'B', text: 'two' });
    kept = noteWithOwn(kept, 0, { title: 'A', text: 'first' });
    assert.deepEqual(kept.paragraphs, [
      { key: 'objectives', text: 'Compare' },
      { title: 'A', text: 'first' },
      { title: 'B', text: 'two' },
    ]);
    kept = noteWithOwn(kept, 0, null);
    assert.deepEqual(kept.paragraphs, [
      { key: 'objectives', text: 'Compare' },
      { title: 'B', text: 'two' },
    ]);
    assert.deepEqual(noteWithOwn(kept, 4, null), kept);
  });

  it('keeps the latest version of a note private, printed by the teacher and on no other outbound route', async () => {
    const first = note('n-1', 'c-math', 'l1', 1);
    const book = await openBook([...cemEvents(), set(first)]);
    const edited = noteWithPlan(first, 'objectives', 'Read large numbers', order);
    await book.record(d('2026-09-21'), set(edited));
    assert.deepEqual(book.state.lessonNotes.get('n-1'), edited);
    assert.equal(layerOf(set(edited)), 'private');
    const notes = (route: OutboundRoute) =>
      recordsForRoute(book.state, route).filter((record) => record.kind === 'lesson-note.set');
    assert.deepEqual(notes('documents'), [set(edited)]);
    for (const route of [
      'statement',
      'handover',
      'handover-direct',
      'school-space',
      'seating-plan-printout',
    ] as const) {
      assert.deepEqual(notes(route), [], route);
    }
    assert.ok(mayTravelAs('private', 'lesson-note.set', 'own-devices'));
    assert.ok(mayTravelAs('private', 'lesson-note.set', 'full-export'));
  });
});
