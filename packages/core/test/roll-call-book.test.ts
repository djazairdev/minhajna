// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll-call book's totals in half-days at every level, a middle-school
// morning of two sessions counting once, with the roll calls behind each
// half-day missed (answer 253); the yearly summary, up to a day when given,
// with July only when a roll call was taken in it, and the year's totals
// those of the months shown (answer 255); a pupil's changes; and the Hijri
// months each month falls in, from the shipped Umm al-Qura table, which the
// reader checks. Made-up classes only.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  DEFAULT_COUNTING,
  correctPupil,
  countRollCalls,
  countYear,
  hijriLabel,
  hijriMonths,
  makeContext,
  parseHijriTable,
  pupilChanges,
  rollCallUnits,
  schoolMonths,
  takeRollCall,
  type HijriTable,
  type Marks,
  type RecordBook,
  type RecordEvent,
  type RollCallCounts,
  type TimetableEntry,
  type YearCounts,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook, reference } from './fixtures.ts';

const lesson = (id: string, half: 'morning' | 'afternoon', index: number): TimetableEntry => ({
  id,
  weekday: 0,
  slot: { half, index },
  courseId: 'c-math',
  groupId: 'g-all',
  weeks: 'every',
  sessionType: 'lesson',
});

/** 1AM2 with three sessions on Sundays: two in the morning, one in the afternoon. */
async function sundays(): Promise<RecordBook> {
  const book = await openBook(cemEvents());
  await book.record(d('2026-09-13'), {
    kind: 'timetable.set',
    version: {
      id: 'v2',
      from: d('2026-09-20'),
      source: 'hand',
      blocks: [],
      entries: [lesson('s-1', 'morning', 1), lesson('s-2', 'morning', 2), lesson('s-3', 'afternoon', 1)],
    },
  } satisfies RecordEvent);
  return book;
}

const absent = (pupilId: string, justified = false) => ({ pupilId, justified });

async function take(book: RecordBook, marks: readonly Marks[]): Promise<void> {
  const units = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-20'));
  assert.equal(units.length, 3);
  for (const [index, unit] of units.entries()) {
    await book.record(unit.day, takeRollCall(contextOf(book), unit, marks[index] ?? { absent: [], late: [] }));
  }
}

const table = (): HijriTable => {
  const read = parseHijriTable(
    JSON.parse(readFileSync(new URL('../../../data/hijri-umalqura.json', import.meta.url), 'utf8')),
  );
  assert.ok(read.ok);
  return read.value;
};

describe('the roll-call book', () => {
  it('counts a middle-school morning once, missed if any session was, justified only if each absence was', async () => {
    const book = await sundays();
    await take(book, [
      { absent: [absent('p01'), absent('p02', true), absent('p03', true)], late: ['p04'] },
      { absent: [absent('p01'), absent('p03')], late: ['p04'] },
      { absent: [absent('p01', true)], late: [] },
    ]);
    const counts = countRollCalls(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-20'));
    assert.equal(counts.units, 3);
    const of = (pupilId: string) => counts.pupils.find((count) => count.pupilId === pupilId);
    assert.deepEqual(
      ['p01', 'p02', 'p03', 'p04', 'p05'].map((pupilId) => {
        const count = of(pupilId);
        return [count?.possible, count?.absent, count?.justified, count?.present];
      }),
      [
        [2, 2, 1, 0],
        [2, 1, 1, 1],
        [2, 1, 0, 1],
        [2, 0, 0, 2],
        [2, 0, 0, 2],
      ],
    );
    const [first, second, third] = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-20'));
    assert.deepEqual(of('p01')?.absences, [
      { day: '2026-09-20', half: 'morning', justified: false, units: [first?.key, second?.key] },
      { day: '2026-09-20', half: 'afternoon', justified: true, units: [third?.key] },
    ]);
    assert.deepEqual(
      of('p02')?.absences.map((absence) => absence.units),
      [[first?.key]],
    );
    assert.deepEqual(of('p04')?.late, ['2026-09-20', '2026-09-20']);
    assert.equal(of('p02')?.rate, 0.5);
  });

  it("sums the school year's months, September to June, with July only when a roll call was taken in it", async () => {
    const book = await openBook(cemEvents());
    for (const unit of rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-10-08'))) {
      const marks = unit.groupId === 'g-2' ? [] : [absent('p01')];
      await book.record(unit.day, takeRollCall(contextOf(book), unit, { absent: marks, late: [] }));
    }
    const context = contextOf(book);
    const summary = countYear(context, 'k-1am2');
    assert.deepEqual(
      summary.months.map(({ month }) => month),
      ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06'],
    );
    const of = (counts: (typeof summary)['year']) => counts.pupils.find((count) => count.pupilId === 'p01')?.absent;
    assert.deepEqual(
      summary.months.slice(0, 3).map(({ counts }) => of(counts)),
      [8, 6, undefined],
    );
    assert.equal(of(summary.year), 14);
    assert.ok(summary.year.untaken > 100);
    const soFar = countYear(context, 'k-1am2', undefined, d('2026-10-08'));
    assert.deepEqual([of(soFar.year), soFar.year.untaken, soFar.months[2]?.counts.units], [14, 0, 0]);
    const september = countYear(context, 'k-1am2', undefined, d('2026-09-30'));
    assert.deepEqual([of(september.year), september.months[1]?.counts.pupils], [8, []]);
    const julyRef = {
      ...reference,
      year: {
        ...reference.year,
        to: d('2027-07-08'),
        terms: reference.year.terms.map((term) => (term.number === 3 ? { ...term, to: d('2027-07-08') } : term)),
      },
    };
    const present = { ...DEFAULT_COUNTING, untaken: 'present' } as const;
    const possible = (counts: RollCallCounts) => counts.pupils.find((count) => count.pupilId === 'p01')?.possible ?? 0;
    const added = (summary: YearCounts) => summary.months.reduce((sum, { counts }) => sum + possible(counts), 0);
    const july = makeContext(julyRef, book.state);
    assert.equal(schoolMonths(july).at(-1), '2027-07');
    assert.ok(rollCallUnits(july, 'k-1am2', d('2027-07-01'), d('2027-07-08')).length > 0);
    const hidden = countYear(july, 'k-1am2', present);
    assert.equal(hidden.months.at(-1)?.month, '2027-06');
    assert.equal(possible(hidden.year), added(hidden));
    const [inJuly] = rollCallUnits(july, 'k-1am2', d('2027-07-01'), d('2027-07-08'));
    assert.ok(inJuly);
    await book.record(inJuly.day, takeRollCall(july, inJuly, { absent: [], late: [] }));
    const shown = countYear(makeContext(julyRef, book.state), 'k-1am2', present);
    assert.equal(shown.months.at(-1)?.month, '2027-07');
    assert.equal(shown.months.length, 11);
    assert.equal(possible(shown.year), added(shown));
    assert.ok(possible(shown.year) > possible(hidden.year));
  });

  it("lists a pupil's changes with the day each was recorded and its reason", async () => {
    const book = await sundays();
    await take(book, [{ absent: [absent('p01')], late: [] }]);
    const [morning, second] = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-20'));
    assert.ok(morning && second);
    await book.record(d('2026-10-01'), correctPupil(contextOf(book), morning, 'p01', 'justified', 'administration'));
    await book.record(d('2026-09-22'), correctPupil(contextOf(book), second, 'p01', 'late', 'arrived-late'));
    await book.record(d('2026-09-22'), correctPupil(contextOf(book), morning, 'p02', 'late', 'entry-error'));
    assert.deepEqual(pupilChanges(book.state, 'p01'), [
      {
        unit: second.key,
        day: '2026-09-20',
        half: 'morning',
        changed: '2026-09-22',
        from: 'present',
        to: 'late',
        reason: 'arrived-late',
      },
      {
        unit: morning.key,
        day: '2026-09-20',
        half: 'morning',
        changed: '2026-10-01',
        from: 'unjustified',
        to: 'justified',
        reason: 'administration',
      },
    ]);
    assert.deepEqual(pupilChanges(book.state, 'p05'), []);
  });

  it('names the Hijri months each month falls in, across a year too, and nothing beyond the table', () => {
    const hijri = table();
    assert.equal(hijri.months.length, 78);
    assert.equal(hijriLabel(hijri, d('2026-09-01'), d('2026-09-30'), 'ar'), 'ربيع الأول – ربيع الثاني 1448');
    assert.equal(hijriLabel(hijri, d('2026-06-01'), d('2026-06-30'), 'ar'), 'ذو الحجة 1447 – محرم 1448');
    assert.equal(hijriLabel(hijri, d('2027-02-08'), d('2027-02-08'), 'fr'), 'Ramadhan 1448');
    assert.equal(hijriLabel(hijri, d('2027-02-01'), d('2027-02-28'), 'en'), 'Shaban – Ramadan 1448');
    assert.deepEqual(
      hijriMonths(hijri, d('2027-03-08'), d('2027-03-09'))?.map((month) => [month.month, month.start]),
      [
        [9, '2027-02-08'],
        [10, '2027-03-09'],
      ],
    );
    assert.equal(hijriLabel(hijri, d('2025-12-01'), d('2025-12-31'), 'ar'), null);
    assert.equal(hijriLabel(hijri, d('2032-03-01'), d('2032-03-31'), 'ar'), null);
  });

  it('refuses a Hijri table with a gap, a month out of order, a wrong length or missing names', () => {
    const raw = JSON.parse(readFileSync(new URL('../../../data/hijri-umalqura.json', import.meta.url), 'utf8')) as {
      names: unknown[];
      months: { year: number; month: number; start: string }[];
    };
    const problems = (change: (copy: typeof raw) => void) => {
      const copy = structuredClone(raw);
      change(copy);
      const read = parseHijriTable(copy);
      return read.ok ? [] : read.problems.map((problem) => problem.path);
    };
    assert.deepEqual(
      problems(() => undefined),
      [],
    );
    assert.deepEqual(
      problems((copy) => copy.months.splice(3, 1)),
      ['months[3]'],
    );
    assert.deepEqual(
      problems((copy) => {
        copy.months[5] = { ...copy.months[5]!, start: '2026-05-01' };
      }),
      ['months[5]', 'months[6]'],
    );
    assert.deepEqual(
      problems((copy) => {
        copy.months[2] = { ...copy.months[2]!, month: 13 };
      }),
      ['months[2]', 'months[3]'],
    );
    assert.deepEqual(
      problems((copy) => copy.names.pop()),
      ['names'],
    );
    assert.deepEqual(
      problems((copy) => {
        copy.names[0] = { ar: 'محرم', fr: ' ' };
      }),
      ['names[0].fr', 'names[0].en'],
    );
  });
});
