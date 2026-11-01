// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Ministry's draft of a calendar update (#607, answer 623), over the
// made-up calendar of reference-fixtures.ts: a new entry reads as new and lies
// over the calendar; changing an entry of the release reads as changed, and
// changing it back drops it; moving its days needs a reason and keeps the days
// it had, and moving them back keeps the release's own; taking out an entry of
// the release lists it, taking out a new one drops it, and undoing a change
// gives the release back; a draft that would not publish, or changes an
// entry's layer or wilaya, gives an effect the editor does not offer, takes
// out an entry the release lacks, or keeps a long name or source, does not
// read, nor does one that gives a new entry what the editor does not show,
// changes it on an entry of the release, leaves an exam without its term, a new
// entry without its Arabic name or a reason on two lines, or weighs, signed,
// more than a signed calendar update may; and the latest draft kept counts, set
// aside when it no longer reads against the calendar. Every entry is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DRAFT_MOST,
  DRAFT_NAME_MOST,
  DRAFT_REASON_MOST,
  draftBytes,
  draftedCalendar,
  draftMark,
  EMPTY_DRAFT,
  keptCalendarDraft,
  newDraftId,
  readCalendarDraft,
  setDraftEntry,
  SIGNED_BYTES,
  SOURCE_MAX,
  takeOutDraftEntry,
  undoDraftEntry,
  type CalendarEntry,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { reference } from './reference-fixtures.ts';

const base = reference.calendar;
const { country: profile, year } = reference;
const exams = base.find((one) => one.id === 'exams-1')!;
const storm = base.find((one) => one.id === 'storm')!;
const added: CalendarEntry = {
  id: 'world-0011223344556677',
  layer: 'national',
  from: d('2027-03-01'),
  to: d('2027-03-02'),
  effect: 'marker',
  name: { ar: 'يوم دراسي', en: 'A made-up study day' },
  source: 'A made-up notice',
  confidence: 'expected',
};
const read = (draft: unknown) => readCalendarDraft(draft, base, profile, year);
const problems = (draft: unknown) => {
  const one = read(draft);
  return 'problems' in one ? one.problems.map((problem) => problem.path) : [];
};

describe('the Ministry’s calendar draft', () => {
  it('adds an entry, which reads as new and lies over the calendar', () => {
    const draft = setDraftEntry(base, EMPTY_DRAFT, added);
    assert.equal(draftMark(base, draft, added.id), 'new');
    assert.equal(draftMark(base, draft, 'autumn'), null);
    assert.deepEqual(draftedCalendar(base, draft).at(-1), added);
    assert.deepEqual(read(draft), { draft });
    assert.match(
      newDraftId(() => new Uint8Array(8).fill(171)),
      /^world-(ab){8}$/u,
    );
  });

  it('changes an entry of the release, and changing it back drops the change', () => {
    const renamed = { ...storm, name: { en: 'A made-up storm closure' }, confidence: 'expected' as const };
    const draft = setDraftEntry(base, EMPTY_DRAFT, renamed);
    assert.equal(draftMark(base, draft, storm.id), 'changed');
    assert.deepEqual(read(draft), { draft });
    assert.deepEqual(setDraftEntry(base, draft, storm), EMPTY_DRAFT);
  });

  it('keeps the days a moved entry had, with its reason, and drops them when it moves back', () => {
    const later = { ...exams, from: d('2026-12-13'), to: d('2026-12-17') };
    assert.throws(() => setDraftEntry(base, EMPTY_DRAFT, later), RangeError);
    assert.throws(() => setDraftEntry(base, EMPTY_DRAFT, later, 'one\ntwo'), RangeError);
    assert.throws(() => setDraftEntry(base, EMPTY_DRAFT, later, 'x'.repeat(DRAFT_REASON_MOST + 1)), RangeError);
    const draft = setDraftEntry(base, EMPTY_DRAFT, later, '  A made-up reason ');
    assert.deepEqual(draft.entries[0]?.moved, { from: exams.from, to: exams.to, reason: 'A made-up reason' });
    assert.deepEqual(read(draft), { draft });
    assert.deepEqual(setDraftEntry(base, draft, { ...exams, moved: draft.entries[0]?.moved }), EMPTY_DRAFT);
    const moved = { ...exams, moved: { from: d('2026-11-29'), to: d('2026-12-03'), reason: 'Made up' } };
    const withMove = [...base.filter((one) => one !== exams), moved];
    assert.deepEqual(setDraftEntry(withMove, EMPTY_DRAFT, { ...exams, source: 'Another made-up notice' }).entries, [
      { ...moved, source: 'Another made-up notice' },
    ]);
    const again = setDraftEntry(withMove, EMPTY_DRAFT, later, 'Moved again');
    assert.deepEqual(again.entries[0]?.moved, { from: exams.from, to: exams.to, reason: 'Moved again' });
    assert.deepEqual(readCalendarDraft(again, withMove, profile, year), { draft: again });
    assert.deepEqual(setDraftEntry(withMove, again, exams), EMPTY_DRAFT);
  });

  it('takes out an entry of the release, drops a new one, and undoes a change', () => {
    const draft = takeOutDraftEntry(base, setDraftEntry(base, EMPTY_DRAFT, added), 'autumn');
    assert.equal(draftMark(base, draft, 'autumn'), 'removed');
    assert.ok(!draftedCalendar(base, draft).some((one) => one.id === 'autumn'));
    assert.deepEqual(read(draft), { draft });
    assert.deepEqual(takeOutDraftEntry(base, draft, 'autumn'), draft);
    assert.deepEqual(takeOutDraftEntry(base, draft, added.id), { entries: [], removed: ['autumn'] });
    assert.deepEqual(undoDraftEntry(draft, 'autumn'), { entries: [added], removed: [] });
    const changed = setDraftEntry(base, draft, { ...base[0]!, source: 'A made-up notice' });
    assert.deepEqual(changed.removed, []);
  });

  it('does not read a draft that would not publish or reaches beyond the editor', () => {
    const one = (entry: Record<string, unknown>) => ({
      entries: [{ ...added, ...entry }],
      removed: [],
    });
    assert.deepEqual(problems(one({ from: d('2028-01-01'), to: d('2028-01-01') })), ['entries[0].from']);
    assert.deepEqual(problems(one({ layer: 'school', schoolId: 'school-1' })), ['entries[0].layer']);
    assert.deepEqual(problems(one({ effect: 'week-a' })), ['entries[0].effect']);
    assert.deepEqual(problems(one({ name: { en: 'x'.repeat(DRAFT_NAME_MOST + 1) } })), ['entries[0].name']);
    assert.deepEqual(problems(one({ source: 'x'.repeat(SOURCE_MAX + 1) })), ['entries[0].source']);
    assert.deepEqual(problems(one({ moved: { from: d('2027-03-08'), to: d('2027-03-08'), reason: 'x' } })), [
      'entries[0].moved',
    ]);
    const national = Object.fromEntries(Object.entries(storm).filter(([key]) => key !== 'zone'));
    assert.deepEqual(problems({ entries: [{ ...national, layer: 'national' }], removed: [] }), ['entries[0].layer']);
    assert.deepEqual(problems({ entries: [national], removed: [] }), ['entries[0].zone']);
    assert.deepEqual(problems({ entries: [{ ...storm, zone: '31' }], removed: [] }), ['entries[0].layer']);
    const unmoved = { ...exams, from: d('2026-12-13'), to: d('2026-12-17') };
    assert.deepEqual(problems({ entries: [unmoved], removed: [] }), ['entries[0].moved']);
    assert.deepEqual(problems({ entries: [], removed: ['unknown'] }), ['removed.0']);
    assert.deepEqual(problems({ entries: [added], removed: [added.id] }), ['removed.0']);
    const local = { ...base[0]!, id: 'school-day', layer: 'school' as const, schoolId: 'school-1' };
    assert.deepEqual(readCalendarDraft({ entries: [], removed: ['school-day'] }, [...base, local], profile, year), {
      problems: [{ path: 'removed.0', problem: 'invalid' }],
    });
    assert.deepEqual(problems({ entries: [], removed: [], more: 1 }), ['']);
    assert.deepEqual(problems({ entries: [], removed: Array(DRAFT_MOST + 1).fill('autumn') }), ['']);
    assert.deepEqual(read({ entries: [], removed: [] }), { draft: EMPTY_DRAFT });
  });

  it('keeps what the editor does not show, an exam’s term, an Arabic name and one-line reasons', () => {
    const one = (entry: Record<string, unknown>) => problems({ entries: [{ ...added, ...entry }], removed: [] });
    assert.deepEqual(one({ effect: 'marker', times: 'ramadan', hours: undefined }), ['entries[0].times']);
    assert.deepEqual(one({ effect: 'no-school', lunar: true }), ['entries[0].lunar']);
    assert.deepEqual(one({ grades: ['1am'] }), ['entries[0].grades']);
    assert.deepEqual(one({ effect: 'exam' }), ['entries[0].term']);
    assert.deepEqual(one({ term: 1 }), ['entries[0].term']);
    assert.deepEqual(one({ effect: 'exam', term: 1 }), []);
    assert.deepEqual(one({ name: { en: 'A made-up day' } }), ['entries[0].name']);
    assert.deepEqual(one({ name: { ar: 'يوم', de: 'Tag' } }), ['entries[0].name']);
    const graded = { ...exams, grades: ['1am'] };
    const withGrades = [...base.filter((entry) => entry !== exams), graded];
    const change = (entry: Record<string, unknown>) =>
      readCalendarDraft({ entries: [entry], removed: [] }, withGrades, profile, year);
    assert.deepEqual(change({ ...exams, source: 'Another made-up notice' }), {
      problems: [{ path: 'entries[0].grades', problem: 'invalid' }],
    });
    const plain = Object.fromEntries(Object.entries(graded).filter(([key]) => key !== 'term' && key !== 'grades'));
    assert.ok('draft' in change({ ...plain, effect: 'marker' }));
    assert.deepEqual(change({ ...graded, effect: 'no-school', term: undefined, lunar: true }), {
      problems: [{ path: 'entries[0].lunar', problem: 'invalid' }],
    });
    assert.ok(draftBytes(EMPTY_DRAFT, profile, year, '2026.1') < draftBytes(EMPTY_DRAFT, profile, year));
    const reason = { from: exams.from, to: exams.to, reason: 'one\ntwo' };
    assert.deepEqual(change({ ...graded, from: d('2026-12-13'), to: d('2026-12-17'), moved: reason }), {
      problems: [{ path: 'entries[0].moved', problem: 'invalid' }],
    });
  });

  it('does not read a draft heavier, signed, than a signed calendar update may be', () => {
    const long = (at: number): CalendarEntry => ({
      ...added,
      id: `world-${String(at).padStart(16, '0')}`,
      name: { ar: 'ي'.repeat(DRAFT_NAME_MOST), fr: 'x'.repeat(DRAFT_NAME_MOST), en: 'x'.repeat(DRAFT_NAME_MOST) },
      source: 'x'.repeat(SOURCE_MAX),
    });
    const small = { entries: [added], removed: [] };
    assert.ok(draftBytes(small, profile, year) < SIGNED_BYTES);
    const heavy = { entries: Array.from({ length: 40 }, (_, at) => long(at)), removed: [] };
    assert.ok(draftBytes(heavy, profile, year) > SIGNED_BYTES);
    assert.deepEqual(problems(heavy), ['size']);
  });

  it('keeps the latest draft, set aside when it no longer reads against the calendar', async () => {
    const book = await openBook(cemEvents());
    const kept = (calendar = base) => keptCalendarDraft(book.entries, calendar, profile, year);
    assert.deepEqual(kept(), { draft: EMPTY_DRAFT, setAside: false });
    const first = setDraftEntry(base, EMPTY_DRAFT, added);
    await book.record(d('2026-11-01'), { kind: 'ministry.calendar', draft: first });
    const second = takeOutDraftEntry(base, first, 'autumn');
    await book.record(d('2026-11-02'), { kind: 'ministry.calendar', draft: second });
    assert.deepEqual(kept(), { draft: second, setAside: false });
    assert.deepEqual(kept(base.filter((one) => one.id !== 'autumn')), { draft: EMPTY_DRAFT, setAside: true });
  });
});
