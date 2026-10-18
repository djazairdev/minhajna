// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Algeria's reference data, as the app ships it (data/dz). These tests read
// the real files; the classes, their timetables and schools are still made
// up.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  bellTimes,
  formatDayWithMonth,
  hoursOn,
  parseBellData,
  parsePackId,
  parsePlanPack,
  isWithin,
  makeContext,
  parseCountryProfile,
  parseSchoolCalendar,
  sessionsBetween,
  type CalendarMark,
  type Context,
  type CountryProfile,
  type RecordEvent,
  type SchoolCalendar,
} from '../src/index.ts';
import { cemEvents, d, openBook, primaryEvents, reference } from './fixtures.ts';
import { monthNames } from './month-fixtures.ts';

function readData(path: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../../data/${path}`, import.meta.url), 'utf8'));
}

function readAlgeria(): { profile: CountryProfile; calendar: SchoolCalendar } {
  const profile = parseCountryProfile(readData('dz/profile.json'));
  assert.deepEqual(profile.ok ? [] : profile.problems, []);
  assert.ok(profile.ok);
  const calendar = parseSchoolCalendar(readData('dz/calendar-2026-2027.json'), profile.value);
  assert.deepEqual(calendar.ok ? [] : calendar.problems, []);
  assert.ok(calendar.ok);
  return { profile: profile.value, calendar: calendar.value };
}

/** A made-up teacher's records against the real profile and calendar. */
async function contextFor(events: readonly RecordEvent[]): Promise<Context> {
  const { profile, calendar } = readAlgeria();
  const book = await openBook(events);
  return makeContext({ ...reference, country: profile, year: calendar.year, calendar: calendar.entries }, book.state);
}

/** The CEM teacher's class, moved to another grade. */
function cemEventsIn(grade: string): RecordEvent[] {
  return cemEvents().map((event): RecordEvent =>
    event.kind === 'class.set' ? { ...event, schoolClass: { ...event.schoolClass, grade } } : event,
  );
}

function marks(context: Context, from: string, to: string): (CalendarMark | null)[] {
  return sessionsBetween(context, d(from), d(to)).map((session) => session.calendar);
}

describe("Algeria's reference data", () => {
  it('reads with no problem', () => {
    const { profile, calendar } = readAlgeria();
    assert.deepEqual(
      profile.levels.map((level) => level.grades.length),
      [5, 4, 3],
    );
    assert.deepEqual([calendar.year.from, calendar.year.to], ['2026-09-21', '2027-07-08']);
  });

  it('ships release 2026.4 with all month spellings and written dates unchanged', () => {
    const { profile } = readAlgeria();
    assert.equal(profile.release, '2026.4');
    assert.deepEqual(profile.months, monthNames);
    for (const [index, names] of monthNames.entries()) {
      const day = d(`2027-${String(index + 1).padStart(2, '0')}-03`);
      for (const language of ['ar', 'fr', 'en'] as const) {
        assert.equal(formatDayWithMonth(day, language, profile), `3 ${names[language]} 2027`);
      }
    }
  });

  it('teaches in Arabic, and each foreign language in its own', () => {
    const { profile } = readAlgeria();
    assert.equal(profile.language, 'ar');
    assert.deepEqual(
      profile.subjects.filter((subject) => subject.language !== undefined).map((s) => [s.code, s.language]),
      [
        ['french', 'fr'],
        ['english', 'en'],
        ['german', 'de'],
        ['spanish', 'es'],
        ['italian', 'it'],
      ],
    );
  });

  it('lists the 69 wilayas of Law 26-06 in order, each named in the three languages', () => {
    const zones = readAlgeria().profile.zones ?? [];
    assert.deepEqual(
      zones.map((zone) => zone.code),
      Array.from({ length: 69 }, (_, index) => String(index + 1).padStart(2, '0')),
    );
    for (const zone of zones) assert.deepEqual(Object.keys(zone.name), ['ar', 'fr', 'en']);
    assert.deepEqual(zones[15]?.name, { ar: 'الجزائر', fr: 'Alger', en: 'Algiers' });
    assert.deepEqual(zones[68]?.name.fr, 'El Abiodh Sidi Cheikh');
  });

  // No text dates Ramadan yet. A lunar date, Ramadan's included, stays
  // expected until the moon is sighted.
  it("cites an official text for every date but Ramadan's", () => {
    const { calendar } = readAlgeria();
    const official = /https:\/\/www\.(education|premier-ministre)\.gov\.dz\/|Law 63-278/;
    assert.match(calendar.year.source, official);
    for (const entry of calendar.entries) {
      if (entry.id !== 'ramadan') assert.match(entry.source, official, entry.id);
      if (entry.confidence === 'expected') assert.match(entry.source, /moon is sighted/, entry.id);
    }
    for (const source of [calendar.year.source, ...calendar.entries.map((entry) => entry.source)]) {
      for (const link of source.match(/https?:\/\/\S+/g) ?? []) {
        assert.match(link, /^https:\/\/www\.(education|premier-ministre)\.gov\.dz\//);
      }
    }
  });

  it('gives every grade an exam window in each term, within the term', () => {
    const { profile, calendar } = readAlgeria();
    for (const grade of profile.levels.flatMap((level) => level.grades)) {
      for (const term of calendar.year.terms) {
        const exams = calendar.entries.filter(
          (entry) =>
            entry.effect === 'exam' && entry.term === term.number && (entry.grades?.includes(grade.code) ?? true),
        );
        assert.notEqual(exams.length, 0, `${grade.code}, term ${term.number}`);
        for (const exam of exams) {
          assert.ok(isWithin(exam.from, term.from, term.to) && isWithin(exam.to, term.from, term.to), exam.id);
        }
      }
    }
  });

  // A holiday week gives no session, and a holiday within a teaching week,
  // such as Yennayer on a Tuesday, marks its sessions lost.
  it("dates a made-up class's sessions across the year, and none falls on a holiday", async () => {
    const { calendar } = readAlgeria();
    const holidays = calendar.entries.filter((entry) => entry.effect === 'no-school');
    for (const events of [cemEvents(), primaryEvents()]) {
      const context = await contextFor(events);
      const sessions = sessionsBetween(context, calendar.year.from, calendar.year.to);
      const misplaced = sessions.filter(
        (session) =>
          holidays.some((entry) => isWithin(session.day, entry.from, entry.to)) !== (session.calendar === 'holiday'),
      );
      assert.deepEqual(
        misplaced.map((session) => session.key),
        [],
      );
      assert.ok(sessions.some((session) => session.calendar === 'holiday'));
      assert.ok(sessions.some((session) => session.calendar === null));
    }
  });

  // The autumn holidays start on the evening of Tuesday 27 October, so that
  // day's sessions stay. Term 2's exams fall on 2, 3 and 4 March, then 7 and 8
  // March, just before Eid al-Fitr. Ramadan shows on its days and changes no
  // session.
  it('marks the holidays, the exam windows and Ramadan on the right days', async () => {
    const cem = await contextFor(cemEvents());
    assert.deepEqual(marks(cem, '2026-10-27', '2026-10-29'), [null, 'holiday', 'holiday']);
    assert.deepEqual(marks(cem, '2027-01-12', '2027-01-12'), ['holiday']);
    assert.deepEqual(marks(cem, '2026-12-06', '2026-12-10'), ['exam', 'exam', 'exam', 'exam', 'exam']);
    assert.deepEqual(marks(cem, '2027-03-02', '2027-03-08'), ['exam', 'exam', 'exam', 'exam', 'exam']);
    assert.deepEqual(marks(cem, '2027-03-09', '2027-03-11'), ['holiday', 'holiday', 'holiday']);
    const school = cem.state.schools.get('s-cem');
    assert.ok(school !== undefined);
    assert.ok(cem.calendar.info(d('2027-02-08'), school).entries.some((entry) => entry.id === 'ramadan'));
    assert.deepEqual(marks(cem, '2027-02-08', '2027-02-11'), [null, null, null, null]);
  });

  it('gives each grade its own term-3 exams', async () => {
    const firstYear = await contextFor(cemEvents());
    const fourthYear = await contextFor(cemEventsIn('4am'));
    assert.deepEqual(marks(firstYear, '2027-05-09', '2027-05-11'), [null, null, null]);
    assert.deepEqual(marks(fourthYear, '2027-05-09', '2027-05-11'), ['exam', 'exam', 'exam']);
    assert.deepEqual(marks(firstYear, '2027-05-23', '2027-05-27'), ['exam', 'exam', 'exam', 'exam', 'exam']);
    assert.deepEqual(marks(fourthYear, '2027-05-23', '2027-05-27'), [null, null, null, null, null]);
  });

  // No text gives the daily hours of middle and secondary schools, so their
  // templates say so, and the teacher matches each slot to the school's bell.
  // Ramadan's length follows the 2026 communiqué until the year's own notice.
  it("ships bell templates for middle and secondary schools, with Ramadan's times from the calendar", () => {
    const { profile, calendar } = readAlgeria();
    const bells = parseBellData(readData('dz/bells.json'), profile);
    assert.deepEqual(bells.ok ? [] : bells.problems, []);
    assert.ok(bells.ok);
    assert.deepEqual(
      bells.value.templates.map((template) => [template.level, template.shift]),
      [
        ['cem', 'single'],
        ['lycee', 'single'],
      ],
    );
    for (const template of bells.value.templates) assert.match(template.source, /not an official text/);
    for (const length of bells.value.ramadan) {
      assert.match(length.source, /^Ministry of National Education, communiqué of 16 February 2026/);
      for (const link of length.source.match(/https?:\/\/\S+/g) ?? []) {
        assert.match(link, /^https:\/\/www\.education\.gov\.dz\//);
      }
    }
    const school = { id: 's-1', name: 'Made up', levels: ['cem'], subjects: ['math'] };
    const slot = { half: 'morning', index: 1 } as const;
    const at = (day: string) =>
      bellTimes(bells.value, school, 'cem', 'single', hoursOn(calendar.entries, d(day)), [slot])[0];
    assert.deepEqual([at('2027-02-07')?.from, at('2027-02-07')?.to], ['08:00', '09:00']);
    assert.deepEqual([at('2027-02-08')?.from, at('2027-02-08')?.to], ['08:00', '08:45']);
  });

  // Until the field check's packs are keyed (#23), the app ships made-up
  // examples, marked as such, so a class can be set up and tried.
  it('ships only example packs, each named by its file and fitting the profile', () => {
    const { profile } = readAlgeria();
    const files = readdirSync(new URL('../../../data/dz/packs/', import.meta.url));
    assert.notEqual(files.length, 0);
    for (const file of files) {
      const read = parsePlanPack(readData(`dz/packs/${file}`));
      assert.deepEqual(read.ok ? [] : read.problems, [], file);
      assert.ok(read.ok);
      const pack = read.value;
      assert.equal(`${pack.id}.json`, file);
      assert.equal(pack.status, 'example', file);
      assert.match(pack.provenance.issuer, /not a plan/, file);
      const parts = parsePackId(pack.id);
      const level = profile.levels.find((candidate) => candidate.code === parts?.level);
      assert.ok(
        level?.grades.some((grade) => grade.code === parts?.grade),
        file,
      );
      const subject = profile.subjects.find((candidate) => candidate.code === parts?.subject);
      assert.ok(level !== undefined && subject?.levels.includes(level.code), file);
    }
  });
});
