// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Ramadan announced (#223, answers 318 to 320): the entry carries each
// level's session length with its own confidence, apart from the first
// day's, which the teacher confirms on the sighting; a level with no length
// keeps its usual times. Made-up schools, dates and sources.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bellTimes,
  canonicalJson,
  confirmLunarHoliday,
  effectiveCalendar,
  isLunarHoliday,
  makeContext,
  parseBellData,
  parseSchoolCalendar,
  ramadanLength,
  type BellData,
  type CalendarEntry,
  type School,
} from '../src/index.ts';
import { cemEvents, country, d, openBook, reference, year } from './fixtures.ts';

const ramadan = {
  id: 'ramadan',
  layer: 'national',
  from: '2027-02-08',
  to: '2027-03-08',
  effect: 'marker',
  times: 'ramadan',
  name: { en: 'Ramadan' },
  source: 'Made-up notice',
  confidence: 'expected',
};
const hours = { confidence: 'announced', lengths: [{ level: 'cem', minutes: 40 }] };
const read = (entry: object) =>
  parseSchoolCalendar({ format: 1, country: 'dz', release: '2026.1', year, entries: [entry] }, country);
const problems = (entry: object) => {
  const result = read(entry);
  return result.ok ? [] : result.problems.map((one) => `${one.path} ${one.problem}`);
};

const bells = ((): BellData => {
  const result = parseBellData(
    {
      format: 1,
      country: 'dz',
      release: '2026.1',
      templates: [
        {
          level: 'cem',
          shift: 'single',
          morning: [['08:00', '09:00']],
          afternoon: [['13:00', '14:00']],
          source: 'Made up',
        },
        {
          level: 'primary',
          shift: 'single',
          morning: [['08:00', '09:00']],
          afternoon: [['13:00', '14:00']],
          source: 'Made up',
        },
      ],
      ramadan: [{ level: 'cem', minutes: 45, source: 'Made-up bells', confidence: 'projected' }],
    },
    country,
  );
  assert.ok(result.ok, JSON.stringify(result));
  return result.value;
})();
const school: School = { id: 's-1', name: 'متوسطة النجاح', levels: ['cem'], subjects: ['math'] };
const m1 = { half: 'morning', index: 1 } as const;

test('reads the hours announced with Ramadan, and refuses them anywhere else or out of bounds', () => {
  const result = read({ ...ramadan, hours });
  assert.ok(result.ok, JSON.stringify(result));
  assert.deepEqual(result.value.entries[0]?.hours, hours);
  assert.deepEqual(problems({ ...ramadan, times: undefined, hours }), ['entries[0].hours invalid']);
  assert.deepEqual(problems({ ...ramadan, hours: { ...hours, confidence: 'sure' } }), [
    'entries[0].hours.confidence invalid',
  ]);
  assert.deepEqual(problems({ ...ramadan, hours: { ...hours, lengths: [] } }), ['entries[0].hours.lengths invalid']);
  const twice = { ...hours, lengths: [...hours.lengths, { level: 'cem', minutes: 45 }] };
  assert.deepEqual(problems({ ...ramadan, hours: twice }), ['entries[0].hours.lengths[1].level duplicate']);
  const odd = {
    ...hours,
    lengths: [
      { level: 'college', minutes: 45 },
      { level: 'cem', minutes: 5 },
    ],
  };
  assert.deepEqual(problems({ ...ramadan, hours: odd }), [
    'entries[0].hours.lengths[0].level invalid',
    'entries[0].hours.lengths[1].minutes invalid',
  ]);
});

test('Ramadan may be marked lunar, and only it among markers', () => {
  assert.deepEqual(problems({ ...ramadan, lunar: true }), []);
  const marker = { ...ramadan, id: 'example-marker', times: undefined, lunar: true };
  assert.deepEqual(problems(marker), ['entries[0].lunar invalid']);
  const entry = { ...ramadan, from: d(ramadan.from), to: d(ramadan.to), lunar: true } as CalendarEntry;
  assert.equal(isLunarHoliday(entry), true);
  assert.equal(isLunarHoliday({ ...entry, confidence: 'announced' }), false);
});

test("the teacher confirms Ramadan's first day on the sighting, and its hours stay as announced", async () => {
  const book = await openBook(cemEvents());
  const entry = { ...ramadan, from: d(ramadan.from), to: d(ramadan.to), lunar: true, hours } as CalendarEntry;
  const ref = { ...reference, calendar: [...reference.calendar.filter((one) => one.id !== 'ramadan'), entry] };
  const event = confirmLunarHoliday(makeContext(ref, book.state), 'ramadan', d('2027-02-09'), 'Made-up sighting');
  assert.equal(event.kind, 'calendar.set');
  if (event.kind !== 'calendar.set') return;
  assert.deepEqual([event.entry.from, event.entry.to], [d('2027-02-09'), d('2027-03-09')]);
  assert.equal(event.entry.confidence, 'announced');
  assert.deepEqual(event.entry.hours, hours);
  await book.record(d('2027-02-07'), event);
  const context = makeContext(ref, book.state);
  assert.equal(
    context.calendar.entriesFor(book.state.schools.get('s-cem')!).find((one) => one.id === 'ramadan')?.from,
    d('2027-02-09'),
  );
  assert.throws(() => confirmLunarHoliday(context, 'ramadan', d('2027-02-11'), 'Made-up sighting'));
});

test('an announced length replaces the bell data, and a level with none keeps its usual times', () => {
  const entry = { ...ramadan, from: d(ramadan.from), to: d(ramadan.to), hours } as CalendarEntry;
  assert.deepEqual(ramadanLength(bells, 'cem', entry), {
    level: 'cem',
    minutes: 40,
    source: 'Made-up notice',
    confidence: 'announced',
  });
  assert.equal(ramadanLength(bells, 'cem')?.minutes, 45);
  assert.equal(ramadanLength(bells, 'primary', entry), null);
  const at = (level: string, with_: CalendarEntry | null) =>
    bellTimes(bells, school, level, 'single', 'ramadan', [m1], with_).map((time) => time && [time.to, time.by]);
  assert.deepEqual(at('cem', entry), [['08:40', 'ramadan-rule']]);
  assert.deepEqual(at('cem', null), [['08:45', 'ramadan-rule']]);
  assert.deepEqual(at('primary', entry), [['09:00', 'template']]);
});

test('after a sighting, the announced lengths keep the source that announced them', () => {
  const entry = { ...ramadan, from: d(ramadan.from), to: d(ramadan.to), lunar: true, hours } as CalendarEntry;
  const sighted = {
    ...entry,
    source: 'Made-up sighting',
    confidence: 'announced',
    confirmedFrom: canonicalJson(entry),
  };
  assert.equal(ramadanLength(bells, 'cem', sighted as CalendarEntry)?.source, 'Made-up notice');
});

test('Ramadan ends on the eve of Eid al-Fitr, expected or confirmed', () => {
  const entry = { ...ramadan, from: d(ramadan.from), to: d(ramadan.to), lunar: true } as CalendarEntry;
  const eid: CalendarEntry = {
    id: 'example-eid',
    layer: 'national',
    from: d('2027-03-10'),
    to: d('2027-03-11'),
    effect: 'no-school',
    name: { en: 'Example Eid' },
    source: 'Made-up notice',
    confidence: 'expected',
    lunar: true,
  };
  const end = (own: readonly CalendarEntry[]) =>
    effectiveCalendar([entry, eid], own).find((one) => one.id === 'ramadan')?.to;
  assert.equal(end([]), d('2027-03-09'));
  const sighted = {
    ...eid,
    from: d('2027-03-09'),
    to: d('2027-03-10'),
    source: 'Made-up sighting',
    confidence: 'announced',
    confirmedFrom: canonicalJson(eid),
  } as CalendarEntry;
  assert.equal(end([sighted]), d('2027-03-08'));
  const far = { ...eid, from: d('2027-04-20'), to: d('2027-04-21') };
  assert.equal(effectiveCalendar([entry, far], []).find((one) => one.id === 'ramadan')?.to, entry.to);
});
