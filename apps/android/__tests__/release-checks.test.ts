// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// E-Release's lines (#614, answer 768), over made-up packs: which fail, which
// only advise, the history every comparison reads, and the budget grid laid
// out from what a reviewer types.

import { source as budget, weekly as source } from '../jest/editor-source';
import { reference } from '../jest/pack-release';
import { releaseHistory, reviewGrid, reviewRelease } from '../src/editor/release-checks';

const none = { main: '', td: '', minutes: '', source: '' };
const line = (result: ReturnType<typeof reviewRelease>, id: string) => result.lines.find((one) => one.id === id);

test('a clean release passes, once a week pack has its horizon', () => {
  const pack = { ...source, release: '2026.7' };
  const blank = reviewRelease(pack, [], reference, '', none);
  expect(line(blank, 'weeks')?.state).toBe('not-checked');
  expect(blank.blockers).toBe(1);
  const typed = reviewRelease(pack, [], reference, 'x', none);
  expect(line(typed, 'weeks')?.state).toBe('not-checked');
  const done = reviewRelease(pack, [], reference, '1', none);
  expect(done.lines.map((one) => one.state)).toEqual(['pass', 'pass', 'pass', 'pass']);
  expect(done.blockers).toBe(0);
});

test('a missing page, an artefact and a short horizon each hold it back, and name the items', () => {
  const first = source.items[0];
  const second = { ...first, id: 'second', title: `Made-up ${String.fromCodePoint(0xfffd)}` };
  const pack = { ...source, release: '2026.7', items: [{ ...first, sourcePage: undefined }, second] };
  const result = reviewRelease(pack, [], reference, '1', none);
  expect(line(result, 'source')).toMatchObject({ state: 'fail', items: [first.id] });
  expect(line(result, 'extraction')).toMatchObject({ state: 'fail', items: [second.id] });
  expect(result.blockers).toBeGreaterThanOrEqual(2);
  const empty = reviewRelease({ ...source, release: '2026.7' }, [], reference, '4', none);
  expect(line(empty, 'weeks')).toMatchObject({ state: 'fail', items: ['2-4'] });
});

test('a number skipped within a year advises, while an unfitting release holds it back', () => {
  const old = { ...source, release: '2026.1' };
  const skipped = reviewRelease({ ...source, release: '2026.3' }, [old], reference, '1', none);
  expect(line(skipped, 'comparison')?.state).toBe('advisory');
  expect(skipped.blockers).toBe(0);
  const older = reviewRelease(
    { ...source, release: '2026.1' },
    [{ ...source, release: '2026.2' }],
    reference,
    '1',
    none,
  );
  expect(line(older, 'comparison')?.state).toBe('fail');
  expect(older.blockers).toBe(1);
});

test('the history is every release published once, never a draft or the release itself', () => {
  const record = (release: string, stage: string) =>
    [`${source.id}@${release}`, { pack: { ...source, release }, stage }] as never;
  const history = releaseHistory(
    { ...source, release: '2026.7' },
    [{ ...source, release: '2026.1' }],
    new Map([
      record('2026.2', 'published'),
      record('2026.3', 'superseded'),
      record('2026.4', 'withdrawn'),
      record('2026.5', 'draft'),
      record('2026.6', 'under-review'),
      record('2026.7', 'published'),
    ]),
  );
  expect(history.map((one) => one.release).sort()).toEqual(['2026.1', '2026.2', '2026.3', '2026.4']);
});

test('a release published itself is compared only with those before it', () => {
  const record = [`${source.id}@2026.6`, { pack: { ...source, release: '2026.6' }, stage: 'published' }] as never;
  const pack = { ...source, release: '2026.5' };
  expect(releaseHistory(pack, [], new Map([record]))).toHaveLength(1);
  expect(releaseHistory(pack, [], new Map([record]), true)).toHaveLength(0);
});

test('the grid is laid on working days without a clash, only once its figures are complete', () => {
  expect(reviewGrid(reference.profile, none)).toBeNull();
  expect(reviewGrid(reference.profile, { main: '1', td: '0', minutes: '0', source: 'Made-up' })).toBeNull();
  expect(reviewGrid(reference.profile, { main: '1', td: '0', minutes: '60', source: ' ' })).toBeNull();
  const grid = reviewGrid(reference.profile, { main: '9', td: '2', minutes: '60', source: 'Made-up grid' })!;
  expect(grid.sessions).toHaveLength(11);
  const places = grid.sessions.map((one) => `${one.weekday}/${one.slot.index}`);
  expect(new Set(places).size).toBe(11);
  expect(grid.sessions.every((one) => reference.profile.workingDays.includes(one.weekday))).toBe(true);
});

test('a budget overrun only advises, and a grid not typed holds nothing back', () => {
  const pack = { ...budget, items: [{ ...budget.items[0], budget: 100 }] };
  const blank = reviewRelease(pack, [], reference, '', none);
  expect(line(blank, 'budget')?.state).toBe('not-checked');
  expect(line(blank, 'weeks')).toBeUndefined();
  expect(blank.blockers).toBe(0);
  const over = reviewRelease(pack, [], reference, '', { main: '1', td: '0', minutes: '60', source: 'Made-up' });
  expect(line(over, 'budget')?.state).toBe('advisory');
  expect(over.blockers).toBe(0);
  const fits = reviewRelease(pack, [], reference, '', { main: '20', td: '20', minutes: '60', source: 'Made-up' });
  expect(line(fits, 'budget')?.state).toBe('pass');
});
