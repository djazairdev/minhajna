// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A new release reaching a teacher inside a world (#617, answer 771):
// publishing moves no class; each is moved on its own, seeing what changed and
// who signed; the move stays in the world's store, dated by the world, and
// leaves the teacher's own store as it was; a move the steps don't support
// isn't offered; and real mode refuses a world's signed file. Everything is
// made up.

import { keptWorld, openSigned, PACK_BYTES, type PackItem, type PackRelease, type PlanPack } from '@minhajna/core';
import { press, rendered, show, shown, unmount } from '../jest/editor-form';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { source as clean } from '../jest/editor-source';
import { packService, reference } from '../jest/pack-release';
import { nodeKit } from '../jest/world-server';
import { openWorld, type OpenWorld } from '../src/demo/world-mode';
import { leaveWorldNetwork } from '../src/network/world-network';
import { WorldPackMoves } from '../src/school/WorldPackMoves';
import { coursesFrom, type WorldCourse } from '../src/school/world-pack-rules';
import { readPackReleases } from '../src/editor/pack-release-session';

const items = (ids: readonly string[]): PackItem[] =>
  ids.map((id) => ({ id, kind: 'lesson', title: `Made-up ${id}`, budget: 1, sourcePage: 3 }));
const pack = (release: string, ids: readonly string[], extra: Partial<PlanPack> = {}): PlanPack => ({
  ...clean,
  status: 'community',
  release,
  items: items(ids),
  ...extra,
});
const start: WorldCourse = {
  key: 'course-1',
  class: '3AM1',
  subject: 'Maths',
  code: 'math',
  grade: '3am',
  start: { id: clean.id, release: '2026.1' },
};
const other = { ...start, key: 'course-2', class: '3AM2' };

let teacher: FakeStorage;
beforeEach(() => {
  teacher = new FakeStorage();
});
afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
});

type Service = Awaited<ReturnType<typeof packService>>;

async function publish(f: Service, next: PlanPack, actor: 'curator' | 'ministry' = 'curator') {
  const draft = await f.change(null, { stage: 'draft', pack: next });
  const review = await f.change(draft, { stage: 'under-review' });
  return f.change(await f.approved(review), { stage: 'published' }, actor);
}

async function opened(f: Service) {
  const fake = new FakeWorld(teacher);
  const found = {
    world: f.world.world,
    kind: 'national' as const,
    code: f.made.code,
    date: f.world.date,
    starter: f.made.starter,
  };
  return openWorld(found, teacher.asSpec(), fake.asSpec());
}

const page = (
  open: OpenWorld,
  records: ReadonlyMap<string, PackRelease>,
  courses = [start, other],
  damaged = false,
) => (
  <WorldPackMoves
    open={open}
    today={open.date}
    dayText={(day) => `day ${day}`}
    damaged={damaged}
    courses={courses}
    records={records}
    bundled={[pack('2026.1', ['a', 'b'])]}
  />
);
const said = () => JSON.stringify(rendered().toJSON());

async function withRelease(
  next = pack('2026.2', ['a', 'c'], {
    migration: { from: '2026.1', entries: [{ kind: 'rename', from: 'b', to: 'c' }] },
  }),
  actor: 'curator' | 'ministry' = 'curator',
) {
  const f = await packService();
  await publish(f, next, actor);
  const records = await readPackReleases(f.editor, f.server.send);
  return { f, records, open: await opened(f) };
}

test('publishing moves no class: each is moved on its own, seeing what changed', async () => {
  const { records, open } = await withRelease();
  await show(page(open, records), 'en');
  expect(said()).toContain('3AM1 · Maths: release ');
  expect(said()).toContain('Publishing moves no class');
  expect(shown('world-signed-curator')).toBe(true);
  expect(said()).toContain('Made-up b');
  expect(said()).toContain('Made-up c');
  expect(keptWorld(open.book.entries)?.packPins).toBeUndefined();
  await press('world-move-2026.2');
  expect(keptWorld(open.book.entries)?.packPins).toEqual({
    'course-1': { id: clean.id, release: '2026.2', day: open.date },
  });
  expect(said()).toContain('3AM1 · Maths moved to');
  expect(shown('world-offer-2026.2')).toBe(true);
  await press('world-class-course-2');
  await press('world-move-2026.2');
  expect(shown('world-offer-2026.2')).toBe(false);
});

test('the move is dated by the world, not the device, and survives opening the page again', async () => {
  const { records, open } = await withRelease();
  const moved = { ...open, date: '2030-01-02' as OpenWorld['date'] };
  await show(page(moved, records), 'en');
  await press('world-move-2026.2');
  expect(keptWorld(open.book.entries)?.packPins?.['course-1']?.day).toBe('2030-01-02');
  await unmount();
  await show(page(moved, records), 'en');
  expect(said()).toContain('Moved on this world’s day day 2030-01-02');
});

test('the teacher’s own store never sees a move, a pin or a release', async () => {
  const { records, open } = await withRelease();
  const before = JSON.stringify(teacher);
  await show(page(open, records), 'en');
  await press('world-move-2026.2');
  expect(JSON.stringify(teacher)).toBe(before);
});

test('the Ministry’s release says it is Official', async () => {
  const { records, open } = await withRelease(undefined, 'ministry');
  await show(page(open, records), 'en');
  expect(shown('world-signed-ministry')).toBe(true);
  expect(said()).toContain('Official');
});

test('a release whose steps don’t fit, or that isn’t published, isn’t offered', async () => {
  const f = await packService();
  await publish(f, pack('2026.2', ['a', 'c']));
  const records = await readPackReleases(f.editor, f.server.send);
  await show(page(await opened(f), records), 'en');
  expect(shown('world-no-move')).toBe(true);
  expect(shown('world-move-2026.2')).toBe(false);
  await unmount();
  leaveWorldNetwork();
  const g = await packService();
  await g.change(null, { stage: 'draft', pack: pack('2026.2', ['a', 'b']) });
  await show(page(await opened(g), await readPackReleases(g.editor, g.server.send)), 'en');
  expect(shown('world-offer-2026.2')).toBe(false);
});

test('a class with no plan takes a release of its grade and subject, and no other', async () => {
  const { records, open } = await withRelease();
  const free = { ...start, start: null };
  const foreign = { ...start, key: 'course-9', grade: '1am', start: null };
  await show(page(open, records, [free, foreign]), 'en');
  expect(shown('world-class-course-1')).toBe(true);
  expect(shown('world-class-course-9')).toBe(false);
});

test('a history that doesn’t read offers no move, and says so', async () => {
  const { records, open } = await withRelease();
  await show(page(open, records, [start, other], true), 'en');
  expect(shown('world-damaged')).toBe(true);
  expect(shown('world-offer-2026.2')).toBe(false);
});

test('a class on a withdrawn release is told, and stays on it', async () => {
  const f = await packService();
  const published = await publish(f, pack('2026.2', ['a', 'b']));
  await f.change(published, { stage: 'withdrawn' });
  const records = await readPackReleases(f.editor, f.server.send);
  const onIt = { ...start, start: { id: clean.id, release: '2026.2' } };
  await show(page(await opened(f), records, [onIt]), 'en');
  expect(said()).toContain('was withdrawn');
  expect(said()).toContain('3AM1 · Maths: release ');
  expect(shown('world-offer-2026.2')).toBe(false);
});

test('real mode refuses a world’s signed release', async () => {
  const { records } = await withRelease();
  const [published] = [...records.values()];
  const read = await openSigned(published.file!, reference.keys, nodeKit.verify, PACK_BYTES);
  expect(read.ok).toBe(false);
});

test('a course comes from the timetable once, with its class’s grade and starting release', () => {
  const school = {
    classes: [{ id: 'c', grade: '3am', name: '3AM1', pupils: [], packs: { math: start.start! } }],
  } as never;
  const sessions = [
    { class: '3AM1', subject: 'math' },
    { class: '3AM1', subject: 'math' },
    { class: 'Unknown', subject: 'Unknown subject' },
  ];
  const courses = coursesFrom('Made-up school', sessions, school, reference.profile.subjects);
  expect(courses).toHaveLength(2);
  expect(courses[0]).toMatchObject({ grade: '3am', start: start.start, code: 'math' });
  expect(courses[1]).toMatchObject({ grade: null, start: null, code: null });
  const elsewhere = coursesFrom('Another school', sessions, school, reference.profile.subjects);
  expect(elsewhere[0].key).not.toBe(courses[0].key);
});
