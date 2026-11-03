// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher of a teachers' world and their classes' sendings (#622, answer
// 696): the world's teacher is the first teacher of its first CEM; the term
// shown is the latest the date has ended, none before the first; a draw holds a
// token and a sending ID for each class, kept in the device layer, the first
// that reads for a term counting and one that does not read ignored; each
// class's sending reads, carries the draw's token and IDs and the school and
// term's code, names no class, teacher or school, and is the same each time;
// the teacher's part of the school gives the generator the same weeks; a class
// that pins no pack, or has no ID in the draw, makes none. Every world is made
// up.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { before, describe, it } from 'node:test';
import {
  drawInsights,
  endedTerm,
  keptDraw,
  layerOf,
  packKey,
  parseBellData,
  parseCountryProfile,
  parsePlanPack,
  parseSchoolCalendar,
  readInsightsDraw,
  NO_PACK,
  readSending,
  recordKey,
  schoolTermCode,
  seededTerm,
  seedNationalWorld,
  teacherPart,
  teacherSendings,
  worldTeacher,
  type BellData,
  type Reference,
  type WorldTeacher,
} from '../src/index.ts';
import { d, openBook } from './fixtures.ts';
import { random } from './school-devices.ts';
import { mac } from './world-crypto.ts';

const data = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../data/dz/${path}`, import.meta.url), 'utf8'));
const digest = (text: string): Promise<string> => Promise.resolve(createHash('sha256').update(text).digest('hex'));

const SEED = 'ABCDE';
let reference: Reference;
let bells: BellData;
let mine: WorldTeacher;

before(() => {
  const profile = parseCountryProfile(data('profile.json'));
  assert.ok(profile.ok);
  const calendar = parseSchoolCalendar(data('calendar-2026-2027.json'), profile.value);
  assert.ok(calendar.ok);
  const read = parseBellData(data('bells.json'), profile.value);
  assert.ok(read.ok);
  bells = read.value;
  const packs = readdirSync(new URL('../../../data/dz/packs/', import.meta.url)).map((file) => {
    const pack = parsePlanPack(data(`packs/${file}`));
    assert.ok(pack.ok);
    return pack.value;
  });
  const world = seedNationalWorld(SEED, profile.value.zones ?? [], profile.value.workingDays, packs);
  mine = worldTeacher(world)!;
  const byKey = new Map(packs.map((pack) => [packKey(pack.id, pack.release), pack]));
  reference = { country: profile.value, year: calendar.value.year, calendar: calendar.value.entries, packs: byKey };
});

describe('the teacher of a teachers’ world', () => {
  it('is the first teacher of the world’s first CEM', () => {
    assert.equal(mine.school.level, 'cem');
    assert.equal(mine.teacher, mine.school.teachers[0]);
    assert.equal(mine.teacher.classIds.length, 2);
    assert.equal(worldTeacher({ directorates: [], schools: [] }), null);
  });

  it('shows the latest term the date has ended, none before the first', () => {
    const { year } = reference;
    assert.equal(endedTerm(year, d('2026-12-16')), null);
    assert.equal(endedTerm(year, year.terms[0]!.to)?.number, 1);
    assert.equal(endedTerm(year, year.terms[1]!.to)?.number, 2);
    assert.equal(endedTerm(year, year.to)?.number, 3);
  });
});

describe('a term’s draw', () => {
  it('holds a token and an ID for each class, kept in the device layer, the first for a term counting', async () => {
    const first = drawInsights('2026-2027', 1, mine.teacher.classIds, random);
    assert.deepEqual(Object.keys(first.ids), mine.teacher.classIds);
    assert.deepEqual(readInsightsDraw(first), first);
    const event = { kind: 'insights.drawn' as const, drawn: first };
    assert.equal(layerOf(event), 'device');
    assert.equal(recordKey(event), 'insights-drawn:2026-2027/1');
    const second = drawInsights('2026-2027', 1, mine.teacher.classIds, random);
    const later = drawInsights('2026-2027', 2, mine.teacher.classIds, random);
    const book = await openBook([]);
    for (const drawn of [{ ...first, token: 'not a token' }, first, second, later]) {
      await book.record(d('2026-12-17'), { kind: 'insights.drawn', drawn: drawn });
    }
    assert.deepEqual(keptDraw(book.entries, '2026-2027', 1), first);
    assert.deepEqual(keptDraw(book.entries, '2026-2027', 2), later);
    assert.equal(keptDraw(book.entries, '2026-2027', 3), null);
  });

  it('refuses a draw that does not read', () => {
    const draw = drawInsights('2026-2027', 1, ['class-1'], random);
    for (const bad of [
      null,
      [],
      { ...draw, extra: 1 },
      { ...draw, year: '2026' },
      { ...draw, term: 4 },
      { ...draw, ids: { 'class-1': 'ABC' } },
      { ...draw, ids: { '': draw.ids['class-1'] } },
      { ...draw, ids: [] },
    ]) {
      assert.equal(readInsightsDraw(bad), null);
    }
  });
});

describe('the teacher’s sendings for a term', () => {
  it('reads for each class, with the draw and the school and term’s code, the same each time', async () => {
    const term = endedTerm(reference.year, reference.year.terms[0]!.to)!;
    const draw = drawInsights(reference.year.id, 1, mine.teacher.classIds, random);
    const input = { seed: SEED, teacher: mine, reference, bells, term, draw };
    const sent = await teacherSendings(input, mac, digest);
    assert.deepEqual(
      sent.map((one) => one.classId),
      mine.teacher.classIds,
    );
    const code = await schoolTermCode(digest, {
      wilaya: mine.school.wilaya,
      school: mine.school.id,
      year: reference.year.id,
      term: 1,
    });
    const pinned = sent.filter(({ classId }) =>
      mine.school.classes.some((one) => one.id === classId && one.packs.arabic !== undefined),
    );
    assert.equal(pinned.length, 1);
    assert.deepEqual(
      sent.filter((one) => !pinned.includes(one)).map((one) => one.sending),
      [NO_PACK],
    );
    for (const { classId, sending } of pinned) {
      assert.ok(typeof sending !== 'string', JSON.stringify(sending));
      assert.deepEqual(readSending(JSON.parse(JSON.stringify(sending))), sending);
      const one = mine.school.classes.find((each) => each.id === classId)!;
      assert.equal(sending.id, draw.ids[classId]);
      assert.equal(sending.token, draw.token);
      assert.equal(sending.schoolTerm, code);
      assert.deepEqual([sending.grade, sending.subject, sending.wilaya], [one.grade, 'arabic', mine.school.wilaya]);
      assert.deepEqual([sending.pack, sending.release], [one.packs.arabic!.id, one.packs.arabic!.release]);
      assert.ok(Object.values(sending.sessions).reduce((sum, count) => sum + count, 0) > 0);
      assert.ok(sending.reached > 0);
      const text = JSON.stringify(sending);
      const named = [one.id, one.name, mine.teacher.id, mine.teacher.name, mine.teacher.latinName];
      for (const name of [...named, mine.school.id, mine.school.name, mine.school.latinName]) {
        assert.equal(text.includes(`"${name}"`), false, name);
      }
      assert.equal(text.includes(one.name), false);
    }
    assert.deepEqual(await teacherSendings(input, mac, digest), sent);
    const missing = await teacherSendings({ ...input, draw: { ...draw, ids: {} } }, mac, digest);
    assert.equal(
      missing.find((one) => pinned[0]!.classId === one.classId)!.sending,
      'the draw holds no sending ID for the class',
    );
  });

  it('gives the teacher’s courses the same weeks over the teacher’s part as over the whole school', async () => {
    const until = reference.year.terms[0]!.to;
    const run = (school: typeof mine.school) =>
      seededTerm({ seed: SEED, school, space: mine.school.id, reference, closures: [], bells, until }, mac);
    const part = teacherPart(mine);
    assert.deepEqual(
      part.classes.map((one) => one.id),
      mine.teacher.classIds,
    );
    const whole = (await run(mine.school)).filter((week) => week.teacherId === mine.teacher.id);
    assert.ok(whole.length > 0);
    assert.deepEqual(await run(part), whole);
  });

  it('moves the school and term’s code with the term', async () => {
    const term = { ...reference.year.terms[1]!, number: 2 as const };
    const draw = drawInsights(reference.year.id, 2, mine.teacher.classIds, random);
    const sent = await teacherSendings({ seed: SEED, teacher: mine, reference, bells, term, draw }, mac, digest);
    const one = sent.find((each) => typeof each.sending !== 'string');
    assert.ok(typeof one!.sending !== 'string');
    assert.equal(one!.sending.term, 2);
    const first = await schoolTermCode(digest, {
      wilaya: mine.school.wilaya,
      school: mine.school.id,
      year: reference.year.id,
      term: 1,
    });
    assert.notEqual(one!.sending.schoolTerm, first);
  });
});
