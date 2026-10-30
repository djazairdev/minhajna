// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a demo world's store keeps of the world (#560, answers 572 and 573):
// its kind, its code and the starter token, in the device layer, so no
// archive holds them; the latest that reads counts, and one that does not read
// is ignored. Every world, code and token is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  archiveOf,
  archiveText,
  keptWorld,
  layerOf,
  makeWorldCode,
  readWorldKept,
  type ArchiveOptions,
  type WorldKept,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { random } from './school-devices.ts';

const CODE = makeWorldCode(random);
const STARTER = 'made-up-starter-token-0123456789';
const options: ArchiveOptions = {
  made: d('2026-10-24'),
  app: '0.7.0',
  country: 'dz',
  calendarRelease: '2026.1',
  privateNotes: true,
  bundledPacks: [],
};

describe('a kept world', () => {
  it('is read from the latest event that reads, in the device layer only', async () => {
    const book = await openBook(cemEvents());
    assert.equal(keptWorld(book.entries), null);
    const first: WorldKept = { kind: 'national', code: CODE, starter: null };
    assert.equal(layerOf({ kind: 'world.kept', kept: first }), 'device');
    await book.record(d('2026-10-20'), { kind: 'world.kept', kept: first });
    assert.deepEqual(keptWorld(book.entries), first);
    const started: WorldKept = { ...first, starter: STARTER };
    await book.record(d('2026-10-21'), { kind: 'world.kept', kept: started });
    assert.deepEqual(keptWorld(book.entries), started);
    await book.record(d('2026-10-22'), { kind: 'world.kept', kept: { ...first, kind: 'school' as never } });
    assert.deepEqual(keptWorld(book.entries), started);
    const archive = archiveOf(book.entries, book.state, options);
    for (const secret of [CODE, STARTER]) assert.equal(archiveText(archive).includes(secret), false);
  });

  it('reads only a known kind, a code as it is kept, and a token or none', () => {
    const kept = { kind: 'teachers', code: CODE, starter: STARTER };
    assert.deepEqual(readWorldKept(kept), kept);
    assert.deepEqual(readWorldKept({ ...kept, starter: null }), { ...kept, starter: null });
    for (const changed of [
      null,
      'world',
      { ...kept, kind: 'school' },
      { ...kept, code: CODE.toLowerCase() },
      { ...kept, code: `${CODE.slice(0, 5)} ${CODE.slice(5)}` },
      { ...kept, code: CODE.replace(/.$/u, CODE.endsWith('A') ? 'B' : 'A') },
      { ...kept, starter: 'short' },
      { ...kept, starter: 'not a token!'.padEnd(20, '!') },
      { ...kept, starter: undefined },
    ]) {
      assert.equal(readWorldKept(changed), null, JSON.stringify(changed));
    }
  });
});
