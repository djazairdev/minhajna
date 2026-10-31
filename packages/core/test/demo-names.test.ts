// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up names for demo worlds (#546, answer 578): twelve wilayas from the
// bundled reference data, in the order of their codes, refused when the data
// lacks one; the same seed gives the same school and staff names, another seed
// others, and a fixed seed always the same first names; two hundred schools of
// a level never repeat a name, nor do staff, until none is left; a school
// carries no code and no digit, and each name has its Latin form, whose part
// of the town agrees with the kind of school.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEMO_WILAYA_CODES, demoNames, demoWilayas, parseCountryProfile, type DemoLevel } from '../src/index.ts';

const profile = parseCountryProfile(
  JSON.parse(readFileSync(new URL('../../../data/dz/profile.json', import.meta.url), 'utf8')) as unknown,
);
assert.ok(profile.ok);
const zones = profile.value.zones ?? [];

test('twelve wilayas come from the reference data, in the order of their codes', () => {
  const wilayas = demoWilayas(zones);
  assert.equal(wilayas.length, 12);
  assert.deepEqual(
    wilayas.map((one) => one.code),
    [...DEMO_WILAYA_CODES].sort(),
  );
  assert.equal(wilayas.find((one) => one.code === '16')?.name.ar, 'الجزائر');
  assert.throws(() => demoWilayas(zones.filter((one) => one.code !== '31')), RangeError);
});

test('the same seed gives the same names in the same order, and another seed others', () => {
  const run = (seed: string) => {
    const names = demoNames(seed);
    return [names.school('cem'), names.person('f'), names.school('primary'), names.person('m'), names.school('lycee')];
  };
  assert.deepEqual(run('made-up-world-1'), run('made-up-world-1'));
  const fixed = demoNames('ABCDE');
  assert.deepEqual(
    [fixed.school('cem'), fixed.person('f'), fixed.school('primary'), fixed.person('m')],
    [
      { name: 'متوسطة العلم القديمة', latinName: 'CEM El Ilm Ancien' },
      { name: 'بن عيسى أمينة', latinName: 'Benaissa Amina', sex: 'f' },
      { name: 'مدرسة الإخلاص القديمة', latinName: 'École El Ikhlas Ancienne' },
      { name: 'بلقاسمي حسين', latinName: 'Belkacemi Hocine', sex: 'm' },
    ],
  );
  assert.notDeepEqual(run('made-up-world-1'), run('made-up-world-2'));
});

test('two hundred schools of each level never repeat a name, and carry no code', () => {
  const names = demoNames('made-up-world-3');
  for (const [level, kind] of [
    ['primary', 'مدرسة'],
    ['cem', 'متوسطة'],
    ['lycee', 'ثانوية'],
  ] as const satisfies readonly (readonly [DemoLevel, string])[]) {
    const schools = Array.from({ length: 200 }, () => names.school(level));
    assert.equal(new Set(schools.map((one) => one.name)).size, 200);
    assert.equal(new Set(schools.map((one) => one.latinName)).size, 200);
    for (const school of schools) {
      assert.ok(school.name.startsWith(`${kind} `));
      assert.doesNotMatch(`${school.name} ${school.latinName}`, /\d/u);
      assert.deepEqual(Object.keys(school).sort(), ['latinName', 'name']);
      if (level !== 'primary') assert.doesNotMatch(school.latinName, /(?:Nouvelle|Centrale|Ancienne)$/u);
      else assert.doesNotMatch(school.latinName, /(?:Nouveau|Central|Ancien)$/u);
    }
  }
});

test('staff never repeat within a world, until no name is left', () => {
  const names = demoNames('made-up-world-4');
  const women = Array.from({ length: 450 }, () => names.person('f'));
  assert.equal(new Set(women.map((one) => one.name)).size, 450);
  assert.ok(women.every((one) => one.sex === 'f' && one.latinName !== '' && one.name.includes(' ')));
  assert.throws(() => names.person('f'), RangeError);
  const men = Array.from({ length: 450 }, () => names.person('m'));
  assert.equal(new Set(men.map((one) => one.latinName)).size, 450);
  assert.throws(() => names.person('m'), RangeError);
  const schools = demoNames('made-up-world-5');
  for (const level of ['primary', 'cem', 'lycee'] as const) {
    for (let made = 0; made < 225; made += 1) schools.school(level);
    assert.throws(() => schools.school(level), RangeError);
  }
});
