// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calendarImpact,
  cancelCalendarEntry,
  confirmCourse,
  confirmLunarHoliday,
  effectiveCalendar,
  layerOf,
  makeContext,
  setCalendarEntry,
  sessionsBetween,
  validLunarConfirmation,
  type CalendarEntry,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook, reference } from './fixtures.ts';

const closure: CalendarEntry = {
  id: 'half-closure',
  layer: 'school',
  schoolId: 's-cem',
  from: d('2026-10-14'),
  to: d('2026-10-15'),
  effect: 'closure',
  name: { en: 'Made-up closure' },
  source: 'Made-up notice',
  confidence: 'announced',
};
const lunar: CalendarEntry = {
  id: 'lunar-example',
  layer: 'national',
  from: d('2026-10-14'),
  to: d('2026-10-15'),
  effect: 'no-school',
  lunar: true,
  name: { en: 'Made-up lunar holiday' },
  source: 'Made-up estimate',
  confidence: 'expected',
};

test('a half-day closure affects only its half of every day in the range and keeps ordinary whole-day records compatible', async () => {
  const events = cemEvents().map((event) =>
    event.kind === 'timetable.set'
      ? {
          ...event,
          version: {
            ...event.version,
            entries: [
              ...event.version.entries,
              {
                ...event.version.entries[0]!,
                id: 'extra-afternoon',
                weekday: 3 as const,
                slot: { half: 'afternoon' as const, index: 3 },
              },
            ],
          },
        }
      : event,
  );
  const book = await openBook(events);
  await book.record(d('2026-10-12'), setCalendarEntry(contextOf(book), { ...closure, half: 'morning' }));
  const sessions = sessionsBetween(contextOf(book), closure.from, closure.to);
  assert.ok(sessions.some((one) => one.slot.half === 'afternoon' && one.calendar === null));
  assert.ok(sessions.filter((one) => one.slot.half === 'morning').every((one) => one.calendar === 'closure'));
  const impact = calendarImpact(contextOf(book), setCalendarEntry(contextOf(book), closure), d('2026-10-12'));
  assert.ok(impact.changes.some((one) => one.after?.slot.half === 'afternoon' && one.after.calendar === 'closure'));
  await book.record(d('2026-10-12'), setCalendarEntry(contextOf(book), closure));
  assert.ok(sessionsBetween(contextOf(book), closure.from, closure.to).every((one) => one.calendar === 'closure'));
});

test('a private afternoon entry keeps its layer and never changes the school week', async () => {
  const book = await openBook(cemEvents());
  const school = book.state.schools.get('s-cem')!;
  const before = contextOf(book).calendar.teachingWeeks(school);
  const { schoolId, ...fields } = closure;
  assert.equal(schoolId, school.id);
  const event = setCalendarEntry(contextOf(book), { ...fields, layer: 'teacher', half: 'afternoon' });
  assert.equal(layerOf(event), 'private');
  await book.record(d('2026-10-12'), event);
  assert.ok(
    sessionsBetween(contextOf(book), closure.from, closure.to)
      .filter((one) => one.slot.half === 'morning')
      .every((one) => one.calendar === null),
  );
  assert.deepEqual(contextOf(book).calendar.teachingWeeks(school), before);
  assert.throws(() => setCalendarEntry(contextOf(book), { ...closure, half: 'evening' } as unknown as CalendarEntry));
});

test('a local school reset takes priority over a national reset, skips holidays and keeps exam-week letters', async () => {
  const book = await openBook(cemEvents());
  const school = book.state.schools.get('s-cem')!;
  const from = d('2027-01-03');
  const entry = { ...closure, id: 'reset', from, to: from, effect: 'week-b' as const };
  const old = contextOf(book).calendar.teachingWeeks(school);
  await book.record(d('2026-10-12'), setCalendarEntry(contextOf(book), entry));
  const calendar = contextOf(book).calendar;
  assert.equal(calendar.weekOf(from, school)?.parity, 'B');
  assert.equal(calendar.weekOf(d('2027-01-10'), school)?.parity, 'A');
  assert.equal(calendar.weekOf(d('2026-12-20'), school), null);
  assert.equal(calendar.weekOf(d('2026-12-06'), school)?.parity, old.find((one) => one.start === '2026-12-06')?.parity);
  const impact = calendarImpact(contextOf(book), cancelCalendarEntry(contextOf(book), entry.id), d('2026-10-12'));
  assert.ok(impact.changes.some((one) => (one.after ?? one.before)!.day > from));
  await book.record(d('2026-10-12'), cancelCalendarEntry(contextOf(book), entry.id));
  assert.deepEqual(contextOf(book).calendar.teachingWeeks(school), old);
});

test('a reset rejects holiday weeks, private scope and half-day scope', async () => {
  const book = await openBook(cemEvents());
  for (const fields of [
    { from: d('2026-12-20'), to: d('2026-12-20') },
    { layer: 'teacher', schoolId: undefined },
    { half: 'morning' },
    { grades: ['1am'] },
    { to: d('2026-10-16') },
  ]) {
    assert.throws(() =>
      setCalendarEntry(contextOf(book), { ...closure, effect: 'week-a', to: closure.from, ...fields } as CalendarEntry),
    );
  }
});

test('the latest same-school reset wins in its week and later resets stop its effect', async () => {
  const book = await openBook(cemEvents());
  const school = book.state.schools.get('s-cem')!;
  for (const [id, day, effect] of [
    ['first', '2026-10-14', 'week-a'],
    ['second', '2026-10-15', 'week-b'],
    ['later', '2026-10-21', 'week-b'],
  ] as const) {
    const from = d(day);
    await book.record(d('2026-10-12'), setCalendarEntry(contextOf(book), { ...closure, id, from, to: from, effect }));
  }
  assert.equal(contextOf(book).calendar.weekOf(d('2026-10-14'), school)?.parity, 'B');
  assert.equal(contextOf(book).calendar.weekOf(d('2026-10-21'), school)?.parity, 'B');
  await book.record(
    d('2026-10-16'),
    setCalendarEntry(contextOf(book), {
      ...closure,
      id: 'first',
      from: d('2026-10-14'),
      to: d('2026-10-14'),
      effect: 'week-a',
    }),
  );
  assert.equal(contextOf(book).calendar.weekOf(d('2026-10-14'), school)?.parity, 'A');
});

test('a lunar confirmation moves the complete span by one day, preserving reference bytes and history', async () => {
  const book = await openBook(cemEvents());
  const ref = { ...reference, calendar: [...reference.calendar, lunar] };
  const before = JSON.stringify(ref);
  const context = () => makeContext(ref, book.state);
  const event = confirmLunarHoliday(context(), lunar.id, d('2026-10-15'), 'Made-up announcement');
  assert.equal(layerOf(event), 'lesson-record');
  const impact = calendarImpact(context(), event, d('2026-10-12'));
  assert.ok(impact.changes.some((one) => one.after?.day === lunar.from && one.after.calendar === null));
  const history = [...book.entries];
  await book.record(d('2026-10-12'), event);
  const own = book.state.calendar[0]!;
  assert.equal(own.to, '2026-10-16');
  assert.equal(validLunarConfirmation(own, lunar), true);
  assert.equal(effectiveCalendar(ref.calendar, book.state.calendar).filter((one) => one.id === lunar.id).length, 1);
  assert.deepEqual(book.entries.slice(0, history.length), history);
  assert.equal(JSON.stringify(ref), before);
  const cancellation = cancelCalendarEntry(context(), lunar.id);
  const restored = calendarImpact(context(), cancellation, d('2026-10-12'));
  assert.ok(restored.changes.some((one) => one.after?.day === lunar.from && one.after.calendar === 'holiday'));
  await book.record(d('2026-10-12'), cancellation);
  assert.ok(context().calendar.entriesFor(book.state.schools.get('s-cem')!).includes(lunar));
});

test('a changed reference invalidates the local confirmation without losing its history or applying its old dates', async () => {
  const book = await openBook(cemEvents());
  const ref = { ...reference, calendar: [lunar] };
  await book.record(
    d('2026-10-12'),
    confirmLunarHoliday(makeContext(ref, book.state), lunar.id, lunar.from, 'Made-up announcement'),
  );
  const changed = { ...lunar, source: 'Made-up corrected reference' };
  assert.deepEqual(effectiveCalendar([changed], book.state.calendar), [changed]);
  await book.record(
    d('2026-10-12'),
    cancelCalendarEntry(makeContext({ ...ref, calendar: [changed] }, book.state), lunar.id),
  );
  assert.equal(book.state.calendar.length, 0);
});

test('non-lunar, projected and announced entries cannot be promoted by sighting confirmation; alterations are refused', async () => {
  const book = await openBook(cemEvents());
  for (const fields of [
    { lunar: undefined },
    { confidence: 'projected' },
    { confidence: 'announced' },
    { effect: 'exam' },
  ]) {
    const ref = { ...reference, calendar: [{ ...lunar, ...fields } as CalendarEntry] };
    assert.throws(() =>
      confirmLunarHoliday(makeContext(ref, book.state), lunar.id, lunar.from, 'Made-up announcement'),
    );
  }
  const context = makeContext({ ...reference, calendar: [lunar] }, book.state);
  for (const [day, source] of [
    ['2026-10-17', 'Made-up notice'],
    ['2026-10-14', ''],
  ] as const)
    assert.throws(() => confirmLunarHoliday(context, lunar.id, d(day), source));
  const event = confirmLunarHoliday(context, lunar.id, lunar.from, 'Made-up notice');
  assert.equal(event.kind, 'calendar.set');
  if (event.kind !== 'calendar.set') return;
  assert.throws(() => setCalendarEntry(context, { ...event.entry, effect: 'marker' }));
});

test('a late half-day closure never rewrites a taught record', async () => {
  const book = await openBook(cemEvents());
  const [session] = sessionsBetween(contextOf(book), closure.from, closure.from);
  assert.ok(session);
  const [record] = confirmCourse(contextOf(book), 'c-math', [{ sessionKey: session.key }], closure.from);
  assert.ok(record);
  await book.record(closure.from, { kind: 'session.recorded', record });
  await book.record(closure.to, setCalendarEntry(contextOf(book), { ...closure, half: session.slot.half }));
  assert.equal(
    sessionsBetween(contextOf(book), closure.from, closure.from).find((one) => one.key === session.key)?.calendar,
    null,
  );
  assert.deepEqual(book.state.sessions.get(session.key)?.at(-1)?.value, record);
});

test('an A/B reset preserves a recorded session even if its old week pattern disappears', async () => {
  const original = await openBook(cemEvents());
  const parity = contextOf(original).calendar.parityOn(closure.from, original.state.schools.get('s-cem')!)!;
  const events = cemEvents().map((event) =>
    event.kind === 'timetable.set'
      ? {
          ...event,
          version: { ...event.version, entries: event.version.entries.map((one) => ({ ...one, weeks: parity })) },
        }
      : event,
  );
  const book = await openBook(events);
  const [session] = sessionsBetween(contextOf(book), closure.from, closure.from);
  assert.ok(session);
  const [record] = confirmCourse(contextOf(book), 'c-math', [{ sessionKey: session.key }], closure.from);
  assert.ok(record);
  await book.record(closure.from, { kind: 'session.recorded', record });
  const before = [...book.entries];
  const event = setCalendarEntry(contextOf(book), {
    ...closure,
    id: 'reset',
    to: closure.from,
    effect: parity === 'A' ? 'week-b' : 'week-a',
  });
  const impact = calendarImpact(contextOf(book), event, closure.from);
  assert.ok(impact.recorded > 0);
  assert.ok(impact.changes.every((one) => (one.after ?? one.before)!.key !== session.key));
  await book.record(closure.to, event);
  const kept = sessionsBetween(contextOf(book), closure.from, closure.from).find((one) => one.key === session.key);
  assert.equal(kept?.calendar, null);
  assert.equal(kept?.scheduled, false);
  assert.deepEqual(book.entries.slice(0, before.length), before);
  assert.deepEqual(book.state.sessions.get(session.key)?.at(-1)?.value, record);
});
