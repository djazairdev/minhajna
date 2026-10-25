// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode's merge (#246, R-Merge, answer 492): each class's latest
// statement for a subject in the picture's order, its last resource placed on
// its unit in the statement's own release, or in a newer one that keeps its
// ID; a teacher's own list, a pack the app lacks, one it has only in older
// releases, or a resource no release keeps is not placed, and says why.
// Made-up packs and statements only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseDay,
  placeResource,
  statementMerge,
  statementPicture,
  type PackItem,
  type PlanPack,
  type ProgressStatement,
  type Received,
} from '../src/index.ts';

const item = (id: string, kind: PackItem['kind'], unit?: string): PackItem => ({
  id,
  kind,
  title: `t-${id}`,
  ...(unit !== undefined && { unit }),
});

const pack = (release: string, items: readonly PackItem[]) =>
  ({ id: 'dz.cem.4am.arabic.made-up', release, status: 'example', items }) as unknown as PlanPack;

const OLD = pack('2026.1', [
  item('d1', 'diagnostic'),
  item('u1', 'unit'),
  item('u1-1', 'launch-situation', 'u1'),
  item('u1-2', 'lesson', 'u1'),
  item('u1-t', 'td', 'u1'),
  item('u1-3', 'lesson', 'u1'),
  item('u2', 'unit'),
  item('u2-1', 'lesson', 'u2'),
]);
const NEW = pack('2026.2', [...OLD.items, item('u2-2', 'lesson', 'u2')]);

function statement(
  section: string,
  resource: string | null,
  release = '2026.1',
  day = '2026-10-08',
): ProgressStatement {
  return {
    format: 'minhajna.statement',
    version: { major: 1, minor: 0 },
    day: parseDay(day),
    class: { level: 'cem', grade: '4am', section, subject: 'arabic', year: '2026-2027' },
    pack: { id: 'dz.cem.4am.arabic.made-up', release },
    lastUnit: null,
    lastResource: resource === null ? null : { id: resource, title: `sent-${resource}`, status: 'done' },
    delay: { sessions: 0, weeks: null, bufferUsed: 0, bufferLeft: 0 },
    notHeld: { calendar: 0, other: 0 },
    td: { calendar: 0, other: 0 },
  };
}

const received = (id: string, spki: string, value: ProgressStatement): Received => ({
  id,
  spki,
  text: id,
  how: 'qr',
  day: parseDay('2026-10-20'),
  statement: value,
});

test('a resource is placed on its unit in its own release, or in a newer one keeping its ID', () => {
  const placed = placeResource([OLD, NEW], statement('4M1', 'u1-3'));
  assert.deepEqual(placed, {
    unit: { title: 't-u1', at: 1, of: 2 },
    items: ['u1-1', 'u1-2', 'u1-3'].map((id) => ({ id, title: `t-${id}` })),
    at: 2,
    release: '2026.1',
  });
  const where = (found: ReturnType<typeof placeResource>) =>
    found === null || typeof found === 'string' ? found : [found.release, found.unit?.at, found.at, found.items.length];
  assert.deepEqual(where(placeResource([OLD, NEW], statement('4M1', 'u2-2', '2026.0'))), ['2026.2', 2, 1, 2]);
  assert.deepEqual(where(placeResource([OLD, NEW], statement('4M1', 'u2-2'))), ['2026.2', 2, 1, 2]);
  assert.deepEqual(where(placeResource([OLD], statement('4M1', 'd1'))), ['2026.1', undefined, 0, 1]);
  assert.equal(placeResource([OLD], statement('4M1', 'u2-2')), 'noItem');
  assert.equal(placeResource([OLD], statement('4M1', 'u1-t')), 'noItem');
  assert.equal(placeResource([OLD], statement('4M1', 'u1-3', '2026.2')), 'older');
  assert.equal(placeResource([OLD], statement('4M1', 'u1-3', 'own')), 'own');
  assert.equal(placeResource([], statement('4M1', 'u1-3')), 'noPack');
  assert.equal(placeResource([OLD], statement('4M1', null)), null);
});

test('the merge keeps the picture order for one subject and counts its keys', () => {
  const list = [
    received('a', 'k1', statement('4M2', 'u2-1')),
    received('b', 'k2', statement('4M10', 'u1-2')),
    received('c', 'k1', statement('4M1', 'u1-3')),
    received('e', 'k2', statement('4M5', 'u2-2')),
    received('d', 'k1', { ...statement('4M3', null), class: { ...statement('4M3', null).class, subject: 'math' } }),
  ];
  const picture = statementPicture(list, new Map());
  const merge = statementMerge(picture.grades[0]!, 'arabic', [OLD]);
  assert.deepEqual(
    merge.rows.map((row) => [row.section, row.one.id, row.place?.unit?.at, row.miss]),
    [
      ['4M1', 'c', 1, null],
      ['4M2', 'a', 2, null],
      ['4M5', 'e', undefined, 'noItem'],
      ['4M10', 'b', 1, null],
    ],
  );
  assert.equal(merge.teachers, 2);
  assert.deepEqual(statementMerge(picture.grades[0]!, 'french', [OLD]), { rows: [], teachers: 0 });
});
