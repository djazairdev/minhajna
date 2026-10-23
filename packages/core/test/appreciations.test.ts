// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Appreciations (#241, answer 465): Algeria's interim list read, refused field
// by field, with a banned phrase, a gap between bands or a band with no phrase
// for any conduct; a pupil's band, primary's average doubled and a value a hair
// under a bound counted at it; the phrases suggested by the average alone and
// with conduct; a term's conduct from the roll-call book and behaviour taps,
// counts only; the phrase chosen kept with its text and release, the last one
// counting and a cleared one left out; the pupils still without one; and the
// choices travelling with the pupil records. Made-up records only.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  appreciationGaps,
  appreciationsFor,
  bandOf,
  conductOf,
  parseAppreciationList,
  parseCountryProfile,
  recordsForRoute,
  rollCallUnits,
  setAppreciation,
  setCapture,
  suggestions,
  takeRollCall,
  termConduct,
  type AppreciationList,
  type SessionRef,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../data/${path}`, import.meta.url), 'utf8'));
const profile = (() => {
  const read = parseCountryProfile(json('dz/profile.json'));
  assert.ok(read.ok);
  return read.value;
})();
const file = json('dz/appreciations.json') as Record<string, unknown> & {
  bands: Record<string, unknown>[];
  phrases: Record<string, unknown>[];
};
const list: AppreciationList = (() => {
  const read = parseAppreciationList(file, profile);
  assert.ok(read.ok);
  return read.value;
})();
const ids = (phrases: readonly { readonly id: string }[]) => phrases.map((one) => one.id);

test('the interim list is read, and refused field by field', () => {
  assert.deepEqual([list.interim, list.release, list.bands.length, list.phrases.length], [true, '2026.1', 5, 18]);
  assert.deepEqual(list.banned, ['يوجه إلى الحياة العملية']);
  const problems = (fields: Record<string, unknown>) => {
    const result = parseAppreciationList({ ...file, ...fields }, profile);
    return result.ok ? [] : result.problems.map((one) => `${one.path} ${one.problem}`);
  };
  const [first, ...rest] = file.phrases;
  const phrase = (fields: Record<string, unknown>) => ({ phrases: [{ ...first, ...fields }, ...rest] });
  assert.deepEqual(problems(phrase({ text: { ar: 'نتائج ضعيفة، يوجه إلى الحياة العملية' } })), [
    'phrases[0].text invalid',
  ]);
  assert.deepEqual(problems(phrase({ text: { ar: 'نتائج، يُوجّه  الى الحياة العمليـة' } })), [
    'phrases[0].text invalid',
  ]);
  assert.deepEqual(problems(phrase({ text: { fr: 'Résultats faibles' } })), ['phrases[0].text required']);
  assert.deepEqual(problems(phrase({ band: 'top' })), ['phrases[0].band unknown-reference']);
  assert.deepEqual(problems(phrase({ conduct: 'fine' })), ['phrases[0].conduct invalid']);
  assert.deepEqual(problems(phrase({ restates: false })), ['phrases[0].restates invalid']);
  assert.deepEqual(problems({ phrases: [first, first, ...rest] }), ['phrases[1] duplicate']);
  const [, fair, ...higher] = file.bands;
  assert.deepEqual(problems({ bands: [{ ...file.bands[0], to: 9 }, fair, ...higher] }), ['bands[1].from invalid']);
  assert.deepEqual(problems({ bands: [...file.bands.slice(0, 4), { ...file.bands[4], to: 19 }] }), [
    'bands[4].to invalid',
  ]);
  assert.deepEqual(problems({ bands: [...file.bands, file.bands[0]] }), ['bands[5] duplicate']);
  const weakOnly = file.phrases.filter((one) => one['band'] !== 'weak' || one['conduct'] !== undefined);
  assert.deepEqual(problems({ phrases: weakOnly }), ['bands[0] invalid']);
  const badOnly = file.phrases.map((one) => (one['id'] === 'weak-2' ? { ...one, restates: false } : one));
  const weakBad = badOnly.filter((one) => one['id'] !== 'weak-1');
  assert.deepEqual(problems({ phrases: weakBad }), ['phrases[0].restates invalid']);
  assert.deepEqual(problems({ concern: { absences: 0, lateness: 3, behaviour: 2 } }), ['concern.absences invalid']);
  assert.deepEqual(problems({ banned: ['\u0640 \u0651'] }), ['banned[0] invalid']);
  assert.deepEqual(problems({ interim: undefined }), ['interim required']);
  assert.deepEqual(problems({ country: 'ma' }), ['country unknown-reference']);
  const extra = parseAppreciationList({ ...file, note: 'x', phrases: [{ ...first, note: 'x' }, ...rest] }, profile);
  assert.ok(extra.ok);
  assert.equal('note' in extra.value, false);
  assert.equal('note' in extra.value.phrases[0]!, false);
});

test('a band from the average, primary’s doubled, and the phrases suggested for it', () => {
  const band = (average: number | null, scale = 20) => bandOf(list, average, scale)?.id ?? null;
  assert.deepEqual(
    [
      band(9.99),
      band(10),
      band(10.71),
      band(13.99),
      band(13.9999999999),
      band(16),
      band(20),
      band(5.5, 10),
      band(null),
    ],
    ['weak', 'fair', 'fair', 'good', 'very-good', 'excellent', 'excellent', 'fair', null],
  );
  const fair = bandOf(list, 10.71, 20);
  assert.deepEqual(ids(suggestions(list, fair)), ['fair-1', 'fair-2', 'fair-3']);
  assert.deepEqual(ids(suggestions(list, fair, 'good')), ['fair-good', 'fair-1', 'fair-2', 'fair-3']);
  assert.deepEqual(ids(suggestions(list, fair, 'concern')), ['fair-concern', 'fair-1', 'fair-2', 'fair-3']);
  assert.equal(suggestions(list, null).length, 18);
  const counts = (absences: number, lateness: number, behaviour: number) =>
    conductOf(list, { absences, lateness, behaviour });
  assert.deepEqual(
    [counts(2, 1, 0), counts(3, 0, 0), counts(0, 3, 0), counts(0, 0, 2)],
    ['good', 'concern', 'concern', 'concern'],
  );
});

const session = (day: string): SessionRef => ({
  key: `c-math/${day}/m1/g-all`,
  courseId: 'c-math',
  groupId: 'g-all',
  day: d(day),
  slot: { half: 'morning', index: 1 },
});

test('a term’s conduct counts the roll-call book’s unjustified absences and lateness, and behaviour taps', async () => {
  const book = await openBook(cemEvents());
  const units = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-10-01'));
  const marks = new Map([
    ['2026-09-20', { absent: [{ pupilId: 'p01', justified: false }], late: [] }],
    ['2026-09-21', { absent: [{ pupilId: 'p01', justified: true }], late: [] }],
    ['2026-09-22', { absent: [], late: ['p01'] }],
  ]);
  for (const unit of units) {
    await book.record(unit.day, takeRollCall(contextOf(book), unit, marks.get(unit.day) ?? { absent: [], late: [] }));
  }
  await book.record(d('2026-10-05'), setCapture(session('2026-10-05'), 'p01', 'behaviour', 2));
  const conduct = termConduct(contextOf(book), 'c-math', 1, 'p01');
  assert.deepEqual(conduct, { absences: 1, lateness: 1, behaviour: 2 });
  assert.equal(conductOf(list, conduct), 'concern');
  assert.deepEqual(termConduct(contextOf(book), 'c-math', 1, 'p02'), { absences: 0, lateness: 0, behaviour: 0 });
  assert.deepEqual(termConduct(contextOf(book), 'c-none', 1, 'p01'), { absences: 0, lateness: 0, behaviour: 0 });
});

test('the phrase chosen keeps its text and release, the last counting, and travels with the records', async () => {
  const book = await openBook(cemEvents());
  const phrase = (id: string) => list.phrases.find((one) => one.id === id)!;
  const choose = (pupilId: string, id: string | null, term = 1) =>
    setAppreciation({ courseId: 'c-math', term, pupilId }, list, id === null ? null : phrase(id));
  await book.recordAll(d('2026-12-10'), [
    choose('p01', 'fair-2'),
    choose('p01', 'fair-1'),
    choose('p02', 'good-1'),
    choose('p02', null),
    choose('p03', 'weak-1', 2),
  ]);
  const chosen = appreciationsFor(book.state, 'c-math', 1);
  assert.deepEqual([...chosen], [['p01', { id: 'fair-1', text: 'نتائج مقبولة، والتحسن ممكن', release: '2026.1' }]]);
  assert.deepEqual(appreciationGaps(['p01', 'p02', 'p03'], chosen), ['p02', 'p03']);
  const sent = (route: Parameters<typeof recordsForRoute>[1]) =>
    recordsForRoute(book.state, route).flatMap((one) =>
      one.kind === 'appreciation.set' ? [`${one.appreciation.term} ${one.appreciation.pupilId}`] : [],
    );
  assert.deepEqual(sent('school-space'), ['1 p01', '2 p03']);
  assert.deepEqual(
    (['documents', 'handover-direct', 'statement', 'handover'] as const).map((route) => sent(route).length),
    [2, 2, 0, 0],
  );
});
