// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teachers' world's made-up sendings as the server's own figures read them
// (#625, §8.4, answer 699): for every pack and term, the three wilayas over
// both floors are shown and the three under one or both are hidden, the
// nation's figure stays, no sending is set aside as an outlier, and the report
// has changed items to show; the teacher's own sending on top changes nothing
// shown or hidden; and an item only a few of a wilaya's classes reached is
// hidden there. Every sending is made up.

import { seedInsights, type InsightsSending } from '@minhajna/core';
import { termFigures } from '../../server/src/insights/figures';
import { kept, readSending } from '../../server/src/insights/sending-read';
import { reference } from '../jest/world-calendar';
import { nodeKit } from '../jest/world-server';
import { seededWorld } from '../src/director/director-world';
import { termReference } from '../src/director/seeded-fill';

const world = seededWorld('ABCDE', reference);
const sendings = seedInsights(world, termReference(reference), nodeKit.random);

/** Each school-and-term code's mark, as the server gives it on receipt. */
const marks = new Map<string, string>();
const markOf = ({ schoolTerm }: InsightsSending) => {
  const mark = marks.get(schoolTerm) ?? `0a0b0c0d0a0b0c0d.${marks.size.toString(36)}`;
  marks.set(schoolTerm, mark);
  return mark;
};

const figuresOf = (term: 1 | 2 | 3, own: readonly InsightsSending[] = []) => {
  const inTerm = [...sendings.filter((one) => one.term === term), ...own];
  return termFigures(
    inTerm.map((one) =>
      kept(
        readSending(JSON.parse(JSON.stringify(one))) as Exclude<ReturnType<typeof readSending>, string>,
        markOf(one),
      ),
    ),
    reference.calendar.year.id,
    term,
  );
};

const codes = world.directorates.map((one) => one.wilaya.code);

test.each([1, 2, 3] as const)('term %i shows three wilayas of every pack and hides the rest', (term) => {
  const figures = figuresOf(term);
  const pinned = new Set(
    world.schools.flatMap((school) =>
      school.classes.flatMap((one) => Object.values(one.packs).map((pack) => `${pack.id}@${pack.release}`)),
    ),
  );
  expect(new Set(figures.map((one) => `${one.pack}@${one.release}`))).toEqual(pinned);
  for (const pack of figures) {
    expect(pack.setAside).toBe(0);
    expect(pack.nation).not.toBeNull();
    expect(Object.keys(pack.wilayas).sort()).toEqual(codes.slice(0, 3).sort());
  }
});

test('the first term reaches some of the way and has changed items to show', () => {
  const [pack] = figuresOf(1);
  const { nation } = pack;
  expect(nation!.reached.median).toBeGreaterThan(100);
  expect(nation!.reached.median).toBeLessThan(600);
  const bands = Object.values(nation!.items).flatMap((item) => (item === null ? [] : [item.skipped, item.merged]));
  expect(new Set(bands.map(String)).size).toBeGreaterThan(1);
});

test('the teacher’s own sending on top changes nothing shown or hidden', () => {
  const first = sendings.find((one) => one.term === 1 && one.wilaya === world.schools[0].wilaya)!;
  const own = { ...first, id: 'a'.repeat(32), token: 'b'.repeat(32), schoolTerm: 'c'.repeat(64) };
  for (const figures of figuresOf(1, [own])) {
    expect(figures.nation).not.toBeNull();
    expect(Object.keys(figures.wilayas).sort()).toEqual(codes.slice(0, 3).sort());
  }
});

test('an item only a few of a wilaya’s classes reached is hidden there', () => {
  const figures = ([1, 2, 3] as const).flatMap((term) => figuresOf(term));
  const shown = figures.flatMap((one) => Object.values(one.wilayas).flatMap((cell) => Object.values(cell.items)));
  expect(shown.some((item) => item === null)).toBe(true);
});
