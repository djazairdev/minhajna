// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the directory keeps (answers 802 to 809), in both kinds of store: a code
// as its hash, set again only with the old one; the draft and the book by
// revision; the versions; a joining code's hash. All of it is made up.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { deliveryFor } from '../src/directory/core/directory-book.js';
import { joiningHash, newJoiningCode } from '../src/directory/directory-rules.js';
import {
  MemoryDirectoryStore,
  REFERENCE,
  schoolDocument,
  type DirectoryStore,
} from '../src/directory/directory-store.js';
import { PrismaDirectoryStore } from '../src/storage/prisma-directory.js';
import { PrismaStores } from '../src/storage/prisma-stores.js';
import { hashToken } from '../src/worlds/world-rules.js';
import { BOOK, DRAFT, SCHOOL, withoutSecond } from './directory-kit.js';
import { KINDS, madeUpWorld, url, type Stores } from './store-kinds.js';

const DOCUMENT = schoolDocument(SCHOOL);
const DAY = '2026-11-07';

for (const kind of KINDS) {
  describe(`the directory store, ${kind.name}`, { skip: kind.skip }, () => {
    let stores: Stores;
    let store: DirectoryStore;

    beforeEach(async () => {
      await kind.reset();
      stores = kind.open();
      store = stores.directory;
    });

    afterEach(async () => {
      await stores.close();
    });

    const claimed = async () => {
      await store.setCode(REFERENCE, hashToken('list-code'), null);
      await store.setCode(DOCUMENT, hashToken('school-code'), null);
    };

    it('keeps the first code as its hash, and changes it only with the old one', async () => {
      assert.equal(await store.codeHash(DOCUMENT), undefined);
      assert.equal(await store.setCode(DOCUMENT, hashToken('first'), null), 'set');
      assert.equal(await store.codeHash(DOCUMENT), hashToken('first'));
      assert.equal(await store.setCode(DOCUMENT, hashToken('second'), null), 'refused');
      assert.equal(await store.setCode(DOCUMENT, hashToken('second'), hashToken('wrong')), 'refused');
      assert.equal(await store.setCode(DOCUMENT, hashToken('second'), hashToken('first')), 'set');
      assert.equal(await store.codeHash(DOCUMENT), hashToken('second'));
    });

    it('lets only one of two first codes set at once win', async () => {
      const results = await Promise.all(['a', 'b', 'c'].map((code) => store.setCode(DOCUMENT, hashToken(code), null)));
      assert.deepEqual(results.toSorted(), ['refused', 'refused', 'set']);
    });

    it('saves the draft by revision, refusing a stale one', async () => {
      await claimed();
      assert.deepEqual(await store.draft(), { revision: 0, draft: null });
      assert.equal(await store.saveDraft(0, DRAFT), 1);
      assert.equal(await store.saveDraft(0, DRAFT), 'stale');
      assert.deepEqual(await store.draft(), { revision: 1, draft: DRAFT });
    });

    it('publishes versions, newest first, and republishes an old one as the draft', async () => {
      await claimed();
      assert.equal(await store.publish(0, DAY), 'empty');
      await store.saveDraft(0, DRAFT);
      assert.equal(await store.publish(0, DAY), 'stale');
      assert.equal(await store.latest(), undefined);
      assert.deepEqual(await store.publish(1, DAY), { version: '2026.1', published: DAY });
      const smaller = { levels: DRAFT.levels, schools: DRAFT.schools.slice(0, 1) };
      await store.saveDraft(1, smaller);
      assert.deepEqual(await store.publish(2, '2026-11-08'), { version: '2026.2', published: '2026-11-08' });
      assert.equal((await store.latest())?.schools.length, 1);
      assert.deepEqual(await store.republish('2026.1', '2027-01-02'), { version: '2027.1', published: '2027-01-02' });
      assert.equal(await store.republish('2020.9', DAY), 'missing');
      assert.deepEqual(await store.draft(), { revision: 3, draft: DRAFT });
      assert.deepEqual(
        (await store.versions()).map(({ version }) => version),
        ['2027.1', '2026.2', '2026.1'],
      );
      const latest = await store.latest();
      assert.deepEqual(latest, { format: 1, version: '2027.1', published: '2027-01-02', ...DRAFT });
    });

    it('gives each of two publishings at once its own version', async () => {
      await claimed();
      await store.saveDraft(0, DRAFT);
      const versions = await Promise.all([store.publish(1, DAY), store.publish(1, DAY)]);
      const names = versions.map((one) => (typeof one === 'string' ? one : one.version));
      assert.deepEqual(names.toSorted(), ['2026.1', '2026.2']);
    });

    it('answers an empty book before the first save', async () => {
      assert.deepEqual(await store.book(SCHOOL), {
        revision: 0,
        book: { format: 1, teachers: [], classes: [], week: [] },
      });
    });

    it('saves a book by revision, each teacher keeping the code they have', async () => {
      await claimed();
      const first = await store.saveBook(SCHOOL, 0, BOOK, newJoiningCode);
      assert.equal(typeof first, 'object');
      if (typeof first === 'string') return;
      assert.equal(first.revision, 1);
      const codes = first.book.teachers.map(({ code }) => code!);
      assert.equal(new Set(codes).size, 2);
      assert.equal(await store.saveBook(SCHOOL, 0, BOOK, newJoiningCode), 'stale');
      const stolen = { ...BOOK, teachers: BOOK.teachers.map((one) => ({ ...one, code: 'SENT-BY-CLIENT' })) };
      const second = await store.saveBook(SCHOOL, 1, stolen, newJoiningCode);
      assert.equal(typeof second, 'object');
      if (typeof second === 'string') return;
      assert.deepEqual(
        second.book.teachers.map(({ code }) => code),
        codes,
      );
      assert.deepEqual(await store.book(SCHOOL), second);
      const joining = await store.joining(joiningHash(codes[0]!)!);
      assert.equal(joining?.school, SCHOOL);
      assert.equal(joining?.teacher, 't-1');
      assert.equal(await store.joining(hashToken('SENT-BY-CLIENT')), undefined);
    });

    it('ends the code of a teacher gone from the book, and starts a new one if they return', async () => {
      await claimed();
      const first = await store.saveBook(SCHOOL, 0, BOOK, newJoiningCode);
      if (typeof first === 'string') return assert.fail('stale');
      const old = first.book.teachers[1]!.code!;
      await store.saveBook(SCHOOL, 1, withoutSecond(BOOK), newJoiningCode);
      assert.equal(await store.joining(joiningHash(old)!), undefined);
      const back = await store.saveBook(SCHOOL, 2, BOOK, newJoiningCode);
      if (typeof back === 'string') return assert.fail('stale');
      const code = back.book.teachers[1]!.code!;
      assert.notEqual(code, old);
      assert.equal((await store.joining(joiningHash(code)!))?.teacher, 't-2');
      return undefined;
    });

    it('renews one code, leaving the revision and the other codes as they were', async () => {
      await claimed();
      const first = await store.saveBook(SCHOOL, 0, BOOK, newJoiningCode);
      if (typeof first === 'string') return assert.fail('stale');
      const [one, two] = first.book.teachers.map(({ code }) => code!);
      const code = newJoiningCode();
      assert.equal(await store.renewCode(SCHOOL, 't-1', code), true);
      assert.equal(await store.renewCode(SCHOOL, 'nobody', newJoiningCode()), false);
      assert.equal(await store.joining(joiningHash(one!)!), undefined);
      assert.equal((await store.joining(joiningHash(code)!))?.teacher, 't-1');
      assert.equal((await store.joining(joiningHash(two!)!))?.teacher, 't-2');
      const kept = await store.book(SCHOOL);
      assert.equal(kept.revision, 1);
      assert.equal(kept.book.teachers[0]!.code, code);
      const again = await store.saveBook(SCHOOL, 1, BOOK, newJoiningCode);
      if (typeof again === 'string') return assert.fail('stale');
      assert.equal(again.book.teachers[0]!.code, code);
      return undefined;
    });

    it('keeps any name as it came, a NUL among it', async () => {
      await claimed();
      const named = { ...BOOK, teachers: [{ id: 't-1', name: 'made\u0000up', option: 'math' }] };
      const saved = await store.saveBook(SCHOOL, 0, named, newJoiningCode);
      if (typeof saved === 'string') return assert.fail('stale');
      const kept = await store.book(SCHOOL);
      assert.equal(kept.book.teachers[0]!.name, 'made\u0000up');
      const delivery = deliveryFor(kept.book, 't-1', null);
      assert.equal(delivery?.teacher.name, 'made\u0000up');
      return undefined;
    });

    it('refuses a school’s first book past the cap, and keeps only the newest versions', async () => {
      await stores.close();
      let held: PrismaStores | undefined;
      if (kind.skip === false && url !== undefined && kind.name.includes('PostgreSQL')) {
        await kind.reset();
        held = new PrismaStores(url);
        store = new PrismaDirectoryStore(held.client, {}, 1, 2);
      } else {
        store = new MemoryDirectoryStore(1, 2);
      }
      await claimed();
      assert.equal(await store.setCode(schoolDocument('sch-02'), hashToken('two'), null), 'set');
      assert.equal(typeof (await store.saveBook(SCHOOL, 0, BOOK, newJoiningCode)), 'object');
      assert.equal(await store.saveBook('sch-02', 0, BOOK, newJoiningCode), 'full');
      assert.equal(typeof (await store.saveBook(SCHOOL, 1, BOOK, newJoiningCode)), 'object');
      await store.saveDraft(0, DRAFT);
      for (let at = 0; at < 3; at += 1) await store.publish(1, DAY);
      assert.deepEqual(
        (await store.versions()).map(({ version }) => version),
        ['2026.3', '2026.2'],
      );
      assert.equal(await store.republish('2026.1', DAY), 'missing');
      assert.equal((await store.latest())?.version, '2026.3');
      await held?.close();
      stores = kind.open();
    });

    it('lets a renewal and a save at once both hold', async () => {
      await claimed();
      const first = await store.saveBook(SCHOOL, 0, BOOK, newJoiningCode);
      if (typeof first === 'string') return assert.fail(first);
      const code = newJoiningCode();
      const [renewed, saved] = await Promise.all([
        store.renewCode(SCHOOL, 't-1', code),
        store.saveBook(SCHOOL, 1, BOOK, newJoiningCode),
      ]);
      assert.equal(renewed, true);
      assert.equal(typeof saved, 'object');
      const kept = await store.book(SCHOOL);
      assert.equal(kept.book.teachers[0]!.code, code);
      assert.equal((await store.joining(joiningHash(code)!))?.teacher, 't-1');
      return undefined;
    });

    it('stands apart from the worlds: erasing every world leaves it', async () => {
      await claimed();
      await store.saveBook(SCHOOL, 0, BOOK, newJoiningCode);
      await stores.worlds.add(madeUpWorld('D0001', '2026-12-01'));
      await stores.worlds.sweep('2026-12-02');
      assert.equal(await stores.worlds.get('D0001'), undefined);
      assert.equal((await store.book(SCHOOL)).revision, 1);
    });
  });
}
