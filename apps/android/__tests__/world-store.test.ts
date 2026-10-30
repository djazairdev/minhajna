// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world's own history (#558): the shared history contract through
// the world's store; the teacher's history shut while a world is open and
// as it was once the world is left; each world's records apart; and a
// world whose history does not verify left at once. The native side is a
// fake here; WorldTest.kt checks it on a device. Every record is made up.

import { historyStoreTests } from '@minhajna/core/test-support';
import { FakeStorage } from '../jest/fake-storage';
import { FakeWorld } from '../jest/fake-world';
import { fromRow, nativeDeps, nativeStore } from '../src/storage/history';
import { openWorldBook, worldSpec } from '../src/storage/world';

const row = (seq: number, text: string) =>
  JSON.stringify({
    seq,
    id: `id${seq}`,
    day: '2026-12-01',
    layer: 'private',
    kind: 'note',
    digest: `d${seq}`,
    previous: '',
    hash: `h${seq}`,
    salt: `s${seq}`,
    body: JSON.stringify({ text }),
  });

describe('a world’s history under the shared contract', () => {
  historyStoreTests(
    test,
    async () => {
      const world = new FakeWorld(new FakeStorage());
      const spec = worldSpec(new FakeStorage().asSpec(), world.asSpec(), 'K7QF4');
      await spec.openHistory();
      return {
        store: nativeStore(spec),
        readCommitted: () => Promise.resolve(world.worlds.get('K7QF4')!.rows.map(fromRow)),
      };
    },
    nativeDeps(new FakeStorage().asSpec()),
  );
});

describe('a world’s own history', () => {
  test('shuts the teacher’s history while the world is open, and leaves it as it was', async () => {
    const teacher = new FakeStorage();
    await teacher.openHistory();
    await teacher.appendEntry(row(0, 'the teacher’s own note'));
    const world = new FakeWorld(teacher);
    const book = await openWorldBook(teacher.asSpec(), world.asSpec(), 'K7QF4');
    expect(book).toBeDefined();
    await expect(teacher.loadHistory()).rejects.toThrow('A demo world is open');
    await expect(teacher.openHistory()).rejects.toThrow('A demo world is open');

    const spec = worldSpec(teacher.asSpec(), world.asSpec(), 'K7QF4');
    await spec.appendEntry(row(0, 'a made-up note'));
    expect(world.worlds.get('K7QF4')!.rows).toHaveLength(1);
    expect(teacher.rows.map((one) => one.body)).toEqual([JSON.stringify({ text: 'the teacher’s own note' })]);

    await world.leaveWorld();
    await teacher.openHistory();
    expect(JSON.parse(await teacher.loadHistory())).toEqual([JSON.parse(row(0, 'the teacher’s own note'))]);
  });

  test('keeps each world apart, one open at a time, and erases one with its key', async () => {
    const world = new FakeWorld(new FakeStorage());
    const storage = new FakeStorage().asSpec();
    await worldSpec(storage, world.asSpec(), 'K7QF4').openHistory();
    await worldSpec(storage, world.asSpec(), 'K7QF4').appendEntry(row(0, 'in the first world'));
    await expect(worldSpec(storage, world.asSpec(), 'ABCDE').openHistory()).rejects.toThrow('Another world is open');
    await world.leaveWorld();

    const other = worldSpec(storage, world.asSpec(), 'ABCDE');
    await other.openHistory();
    expect(JSON.parse(await other.loadHistory())).toEqual([]);
    await world.eraseWorld('ABCDE');
    expect(world.open).toBeNull();
    expect([...world.worlds.keys()]).toEqual(['K7QF4']);
    expect(() => worldSpec(storage, world.asSpec(), 'k7qf4')).toThrow('5 characters');
  });

  test('leaves a world at once when its history does not verify', async () => {
    const teacher = new FakeStorage();
    const world = new FakeWorld(teacher);
    const broken = new FakeStorage();
    await broken.openHistory();
    await broken.appendEntry(row(0, 'a note whose hash does not check'));
    world.worlds.set('K7QF4', broken);
    await expect(openWorldBook(teacher.asSpec(), world.asSpec(), 'K7QF4')).rejects.toThrow();
    expect(world.open).toBeNull();
    await teacher.openHistory();
    expect(teacher.opened).toBe(true);
  });
});
