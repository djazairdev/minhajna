// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teachers' world's made-up sendings (#625, answer 699): every sending reads
// under the observatory's rules, for every pack the world pins and every term;
// each wilaya holds its teachers and schools, over and under the floors, and
// the teacher's own comes first; a token is one teacher's for one term, a code
// one school's for one term, and neither is derived from anything; a class
// reaches further term by term; the changed items are changed by about the
// share they should; with no change drawn, a class spends about the sessions
// the world's teacher's does; batches keep to what a request carries, and there
// is always one. Every sending is made up.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { before, describe, it } from 'node:test';
import {
  drawInsights,
  packKey,
  parseBellData,
  parseCountryProfile,
  parsePlanPack,
  parseSchoolCalendar,
  readSending,
  SEED_BYTES,
  seedBatches,
  seedInsights,
  SEED_SENDINGS,
  seedNationalWorld,
  teacherSendings,
  worldTeacher,
  type BellData,
  type DemoWorld,
  type InsightsSending,
  type Reference,
} from '../src/index.ts';
import { random } from './school-devices.ts';
import { mac } from './world-crypto.ts';

const data = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../data/dz/${path}`, import.meta.url), 'utf8'));

const digest = (text: string): Promise<string> => Promise.resolve(createHash('sha256').update(text).digest('hex'));

let bells: BellData;
let reference: Reference;
let world: DemoWorld;
let sendings: InsightsSending[];

const distinct = (values: Iterable<unknown>) => new Set(values).size;
const inCell = (wilaya: string) => sendings.filter((one) => one.wilaya === wilaya);
const packTerm = (one: InsightsSending, term: number, pack: string) => one.term === term && one.pack === pack;

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
  world = seedNationalWorld('ABCDE', profile.value.zones ?? [], profile.value.workingDays, packs);
  const byKey = new Map(packs.map((pack) => [packKey(pack.id, pack.release), pack]));
  reference = { country: profile.value, year: calendar.value.year, calendar: calendar.value.entries, packs: byKey };
  sendings = seedInsights(world, reference, random);
});

describe('seedInsights', () => {
  it('makes sendings that read, for each pack the world pins and each term', () => {
    const pinned = new Set(
      world.schools.flatMap((school) => school.classes.flatMap((one) => Object.values(one.packs).map((p) => p.id))),
    );
    assert.deepEqual(new Set(sendings.map((one) => one.pack)), pinned);
    assert.deepEqual(new Set(sendings.map((one) => one.term)), new Set([1, 2, 3]));
    for (const one of sendings) assert.deepEqual(readSending(JSON.parse(JSON.stringify(one))), one);
    assert.equal(distinct(sendings.map((one) => one.id)), sendings.length);
    assert.ok(sendings.every((one) => one.year === reference.year.id));
  });

  it('puts teachers and schools over and under the floors, wilaya by wilaya, the teacher first', () => {
    const codes = world.directorates.map((one) => one.wilaya.code);
    const held = [...codes.slice(0, 5), codes.at(-1)!];
    assert.deepEqual(new Set(sendings.map((one) => one.wilaya)), new Set(held));
    assert.equal(worldTeacher(world)?.school.wilaya, held[0]);
    const pack = sendings[0]!.pack;
    const counts = held.map((wilaya) => {
      const cell = inCell(wilaya).filter((one) => packTerm(one, 1, pack));
      return [distinct(cell.map((one) => one.token)), distinct(cell.map((one) => one.schoolTerm))];
    });
    assert.deepEqual(counts, [
      [16, 4],
      [13, 4],
      [11, 3],
      [12, 2],
      [8, 3],
      [4, 2],
    ]);
  });

  it('keeps a token to one teacher and term, a code to one school and term', () => {
    const terms = new Map<string, Set<number>>();
    for (const one of sendings) terms.set(one.token, (terms.get(one.token) ?? new Set()).add(one.term));
    assert.ok([...terms.values()].every((seen) => seen.size === 1));
    const codes = new Map<string, Set<string>>();
    for (const one of sendings) {
      codes.set(one.schoolTerm, (codes.get(one.schoolTerm) ?? new Set()).add(`${one.wilaya}/${one.term}`));
    }
    assert.ok([...codes.values()].every((seen) => seen.size === 1));
    assert.ok(sendings.every((one) => /^[0-9a-f]{64}$/.test(one.schoolTerm)));
  });

  it('moves a class on through its plan, term by term, within the plan', () => {
    const medians = [1, 2, 3].map((term) => {
      const reached = sendings.filter((one) => one.term === term).map((one) => one.reached);
      return reached.sort((a, b) => a - b)[Math.floor(reached.length / 2)]!;
    });
    assert.ok(medians[0]! < medians[1]! && medians[1]! < medians[2]!, medians.join());
    assert.ok(medians[2]! > 800, medians.join());
  });

  it('changes a few items, by most or some of the classes that reach them', () => {
    const share = (list: 'merged' | 'skipped' | 'retaught') => {
      let [changed, reached] = [0, 0];
      for (const pack of new Set(sendings.map((one) => one.pack))) {
        const ofPack = sendings.filter((one) => one.pack === pack);
        for (const item of new Set(ofPack.flatMap((one) => one.changed[list]))) {
          reached += ofPack.filter((one) => Object.hasOwn(one.sessions, item)).length;
          changed += ofPack.filter((one) => one.changed[list].includes(item)).length;
        }
      }
      return changed / reached;
    };
    assert.ok(share('skipped') > 0.9, `skipped ${share('skipped')}`);
    assert.ok(share('merged') > 0.5 && share('merged') < 0.7, `merged ${share('merged')}`);
    assert.ok(share('retaught') > 0.1 && share('retaught') < 0.3, `retaught ${share('retaught')}`);
    assert.ok(sendings.some((one) => one.changed.split.length > 0));
    for (const one of sendings) {
      for (const item of [...one.changed.skipped, ...one.changed.merged]) assert.equal(one.sessions[item], 0);
      for (const item of one.changed.retaught) assert.ok(one.sessions[item]! > 0);
    }
  });

  it('spends about the sessions the world’s teacher’s class does, with no change drawn', async () => {
    const teacher = worldTeacher(world)!;
    const pack = teacher.school.classes.flatMap((one) => one.packs[teacher.teacher.subject] ?? [])[0]!;
    const total = (one: InsightsSending) => Object.values(one.sessions).reduce((all, count) => all + count, 0);
    const steady = seedInsights(world, reference, (length) => new Uint8Array(length).fill(255));
    for (const number of [1, 2] as const) {
      const term = { ...reference.year.terms.find((one) => one.number === number)!, number };
      const draw = drawInsights(reference.year.id, number, teacher.teacher.classIds, random);
      const input = { seed: 'ABCDE', teacher, reference, bells, term, draw };
      const own = (await teacherSendings(input, mac, digest)).flatMap(({ sending }) =>
        typeof sending === 'string' ? [] : [sending],
      );
      const made = steady.find((one) => one.term === number && one.pack === pack.id)!;
      assert.ok(own.length > 0);
      for (const one of own) assert.ok(Math.abs(total(one) / total(made) - 1) < 0.06, `${total(one)}, ${total(made)}`);
    }
  });

  it('makes none for a pack the reference does not hold', () => {
    const empty = { ...reference, packs: new Map() } as Reference;
    assert.deepEqual(seedInsights(world, empty, random), []);
  });
});

describe('seedBatches', () => {
  it('keeps every sending, in order, to what one request carries', () => {
    const batches = seedBatches(sendings);
    assert.deepEqual(batches.flat(), sendings);
    assert.ok(batches.every((one) => one.length > 0 && one.length <= SEED_SENDINGS));
    assert.ok(batches.every((one) => JSON.stringify({ sendings: one }).length <= SEED_BYTES));
  });

  it('cuts by bytes as well as by count', () => {
    const big = {
      ...sendings[0]!,
      sessions: Object.fromEntries(Array.from({ length: 500 }, (_, at) => [`i${at}`, 1])),
    };
    const batches = seedBatches(Array.from({ length: 200 }, () => big));
    assert.ok(batches.length > 1);
    assert.ok(batches.every((one) => JSON.stringify({ sendings: one }).length <= SEED_BYTES));
  });

  it('gives one empty batch for no sending, so the opening is still made', () => {
    assert.deepEqual(seedBatches([]), [[]]);
  });
});
