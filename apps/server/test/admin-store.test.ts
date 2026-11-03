// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The admin log and the problem reports (#619, answer 656), in memory and in
// PostgreSQL alike (store-kinds.ts): lines newest first, the oldest of their
// kind dropped past 1,000, so reports marked fixed never push out the server's
// own lines; a world's reports newest first, without their tokens' hashes, at
// most 200, none for a world not kept, erased when marked fixed together with
// their line, or deleted by their own token only; and a sweep erasing what came
// before a day and the reports of erased worlds. Every world, note and version
// here is made up.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { MAX_ADMIN_LINES, MAX_PROBLEMS, type AdminLine, type StoredProblem } from '../src/admin/admin-store.js';
import { KINDS, madeUpWorld, type Stores } from './store-kinds.js';

let ids = 0;
function report(received = '2026-12-01', tokenHash = 'c'.repeat(64)): StoredProblem {
  ids += 1;
  const id = ids.toString(16).padStart(32, '0');
  return {
    id,
    part: 'today',
    note: `A made-up note ${ids}.\nIt has two lines.`,
    version: '0.7.0',
    received,
    tokenHash,
  };
}
const shown = ({ id, part, note, version, received }: StoredProblem) => ({ id, part, note, version, received });

for (const kind of KINDS) {
  describe(`the admin store ${kind.name}`, { skip: kind.skip }, () => {
    beforeEach(kind.reset);

    async function withStores(test: (stores: Stores) => Promise<void>): Promise<void> {
      const stores = kind.open();
      try {
        for (const id of ['AAAAA', 'BBBBB']) assert.equal(await stores.worlds.add(madeUpWorld(id)), true);
        await test(stores);
      } finally {
        await stores.close();
      }
    }

    it('keeps the admin log newest first, the oldest of its kind dropped past its cap', () =>
      withStores(async ({ admin }) => {
        const started: AdminLine = {
          day: '2026-12-01',
          action: 'server.started',
          detail: { version: '0.1.0', fingerprint: 'none' },
        };
        await admin.log(started);
        await admin.log({ day: '2026-12-02', action: 'worlds.erased', detail: { count: 2 } });
        assert.deepEqual(await admin.lines(10), [
          { day: '2026-12-02', action: 'worlds.erased', detail: { count: 2 } },
          started,
        ]);
        assert.deepEqual(await admin.lines(0), []);
        for (let i = 0; i <= MAX_ADMIN_LINES; i += 1)
          await admin.log({ day: '2026-12-03', action: 'problem.fixed', detail: { problem: String(i) } });
        let lines = await admin.lines(3 * MAX_ADMIN_LINES);
        assert.equal(lines.length, MAX_ADMIN_LINES + 2);
        assert.deepEqual(lines.slice(-3), [
          { day: '2026-12-03', action: 'problem.fixed', detail: { problem: '1' } },
          { day: '2026-12-02', action: 'worlds.erased', detail: { count: 2 } },
          started,
        ]);
        for (let i = 0; i < MAX_ADMIN_LINES; i += 1)
          await admin.log({ day: '2026-12-04', action: 'worlds.erased', detail: { count: i } });
        lines = await admin.lines(3 * MAX_ADMIN_LINES);
        assert.equal(lines.length, 2 * MAX_ADMIN_LINES);
        assert.equal(lines.filter((line) => line.action === 'problem.fixed').length, MAX_ADMIN_LINES);
        assert.equal(
          lines.some((line) => line.action === 'server.started'),
          false,
        );
      }));

    it("keeps a world's reports newest first, without their tokens, up to its cap", () =>
      withStores(async ({ admin }) => {
        const first = report();
        const second = report();
        assert.equal(await admin.addProblem('AAAAA', first), 'added');
        assert.equal(await admin.addProblem('AAAAA', second), 'added');
        assert.deepEqual(await admin.problems('AAAAA'), [shown(second), shown(first)]);
        assert.deepEqual(await admin.problems('BBBBB'), []);
        for (let i = 2; i < MAX_PROBLEMS; i += 1) assert.equal(await admin.addProblem('AAAAA', report()), 'added');
        assert.equal(await admin.addProblem('AAAAA', report()), 'full');
        assert.equal(await admin.addProblem('BBBBB', report()), 'added');
        assert.equal(await admin.addProblem('ZZZZZ', report()), 'no-world');
        assert.deepEqual(await admin.problems('ZZZZZ'), []);
      }));

    it('erases a report marked fixed with its line, or deleted with its own token only', () =>
      withStores(async ({ admin }) => {
        const one = report('2026-12-01', 'd'.repeat(64));
        const other = report();
        await admin.addProblem('AAAAA', one);
        await admin.addProblem('AAAAA', other);
        assert.equal(await admin.deleteProblem('AAAAA', one.id, 'e'.repeat(64)), false);
        assert.equal(await admin.deleteProblem('BBBBB', one.id, one.tokenHash), false);
        assert.equal(await admin.deleteProblem('AAAAA', one.id, one.tokenHash), true);
        const line = { day: '2026-12-02', action: 'problem.fixed', detail: { problem: other.id } } as const;
        assert.equal(await admin.fixProblem('BBBBB', other.id, line), false);
        assert.deepEqual(await admin.lines(10), []);
        assert.equal(await admin.fixProblem('AAAAA', other.id, line), true);
        assert.equal(await admin.fixProblem('AAAAA', other.id, line), false);
        assert.deepEqual(await admin.problems('AAAAA'), []);
        assert.deepEqual(await admin.lines(10), [line]);
      }));

    it('sweeps what came before a day, and the reports of erased worlds', () =>
      withStores(async ({ admin, worlds }) => {
        await admin.log({ day: '2025-11-30', action: 'worlds.erased', detail: { count: 1 } });
        await admin.log({ day: '2025-12-01', action: 'worlds.erased', detail: { count: 3 } });
        assert.equal(await worlds.add(madeUpWorld('CCCCC', '2026-12-02')), true);
        const old = report('2025-11-30');
        const kept = report('2025-12-01');
        await admin.addProblem('AAAAA', old);
        await admin.addProblem('AAAAA', kept);
        await admin.addProblem('CCCCC', report('2026-12-01'));
        const gone = await worlds.sweep('2026-12-03');
        assert.deepEqual(gone, ['CCCCC']);
        await admin.sweep('2025-12-01', gone);
        assert.deepEqual(await admin.lines(10), [{ day: '2025-12-01', action: 'worlds.erased', detail: { count: 3 } }]);
        assert.deepEqual(await admin.problems('AAAAA'), [shown(kept)]);
        assert.deepEqual(await admin.problems('CCCCC'), []);
      }));
  });
}
