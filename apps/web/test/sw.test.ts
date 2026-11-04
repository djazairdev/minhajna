// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The offline worker (#250, R-6.6-05, R-6.6-06, answers 516 and 517), run
// as it is in a made-up browser beside a made-up server: it installs the
// build the server holds and answers from it; it reports a newer build with
// its notes, refusing notes that are not the build's or that name another
// version than build.json; it installs that build only by the checksum the
// teacher saw and only when it is newer, keeping the old one answering until
// the new one is whole, then drops it and tells the pages; a file that fails
// its hash leaves the old build in place; a whole build left beside the old
// one is used without fetching it again when it is newer, and dropped when
// it is not; and a second update for another build is refused while one
// runs. Builds are made up.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { browser, made } from './support/sw-browser.ts';

describe('the offline worker', () => {
  let pc: ReturnType<typeof browser>;
  const first = made('0.6.0', 60099);
  const next = made('0.6.1', 60199, ['A made-up change']);

  beforeEach(async () => {
    pc = browser();
    pc.serve(first);
    await pc.install();
  });

  it('installs the server’s build and answers from it alone', async () => {
    assert.deepEqual([...pc.stores.keys()], [`minhajna-web-${first.sha256}`]);
    pc.server.clear();
    assert.equal(await pc.page('app.js'), first.files['app.js']);
  });

  it('reports the server’s build with its notes, and refuses notes that are not the build’s', async () => {
    pc.serve(next);
    const checked = await pc.ask({ kind: 'check' });
    assert.equal(checked.ok, true);
    assert.deepEqual(checked.value, {
      version: '0.6.1',
      versionCode: 60199,
      sha256: next.sha256,
      notes: {
        version: '0.6.1',
        versionCode: 60199,
        ar: ['A made-up change'],
        fr: ['A made-up change'],
        en: ['A made-up change'],
      },
      newer: true,
    });
    pc.serve(first);
    assert.deepEqual((await pc.ask({ kind: 'check' })).value, {
      version: '0.6.0',
      versionCode: 60099,
      sha256: first.sha256,
      notes: JSON.parse(first.files['notes.json'] ?? '{}') as unknown,
      newer: false,
    });
    pc.serve(next);
    pc.server.set('build.json', next.json.replace('"versionCode":60199', '"versionCode":70199'));
    assert.deepEqual(await pc.ask({ kind: 'check' }), { ok: false, error: 'The notes name another version' });
    pc.serve(next);
    pc.server.set('notes.json', JSON.stringify({ version: '0.6.1', ar: ['Changed on the server'] }));
    assert.equal((await pc.ask({ kind: 'check' })).ok, false);
  });

  it('installs a new build only by the checksum seen, then drops the old one and tells the pages', async () => {
    pc.serve(next);
    const refused = await pc.ask({ kind: 'update', sha256: first.sha256.replace(/^./u, '0') });
    assert.equal(refused.ok, false);
    assert.equal(await pc.page('app.js'), first.files['app.js']);
    assert.deepEqual(await pc.ask({ kind: 'update', sha256: next.sha256 }), { ok: true, value: null });
    assert.deepEqual([...pc.stores.keys()], [`minhajna-web-${next.sha256}`]);
    assert.deepEqual(JSON.parse(JSON.stringify(pc.told)), [{ kind: 'updated' }]);
    pc.server.clear();
    assert.equal(await pc.page('app.js'), next.files['app.js']);
    assert.equal(await pc.page(''), next.files['index.html']);
  });

  it('refuses a build that is not newer, and another update while one runs', async () => {
    const same = made('0.6.0', 60099, ['Made-up notes added later']);
    pc.serve(same);
    assert.equal(((await pc.ask({ kind: 'check' })).value as { newer: boolean }).newer, false);
    assert.deepEqual(await pc.ask({ kind: 'update', sha256: same.sha256 }), {
      ok: false,
      error: 'Not a newer build',
    });
    pc.serve(next);
    const [together, second] = await Promise.all([
      pc.ask({ kind: 'update', sha256: next.sha256 }),
      pc.ask({ kind: 'update', sha256: same.sha256 }),
    ]);
    assert.equal(together.ok, true);
    assert.deepEqual(second, { ok: false, error: 'Another update is running' });
  });

  it('uses a whole new build left beside the old one, with no download', async () => {
    pc.serve(next);
    assert.equal((await pc.ask({ kind: 'update', sha256: next.sha256 })).ok, true);
    const fresh = pc.stores.get(`minhajna-web-${next.sha256}`)!;
    pc.stores.clear();
    pc.stores.set(`minhajna-web-${first.sha256}`, new Map());
    pc.serve(first);
    await pc.install();
    pc.stores.set(`minhajna-web-${next.sha256}`, fresh);
    pc.server.clear();
    assert.equal((await pc.ask({ kind: 'update', sha256: next.sha256 })).ok, true);
    assert.deepEqual([...pc.stores.keys()], [`minhajna-web-${next.sha256}`]);
    assert.equal(await pc.page('app.js'), next.files['app.js']);
    const older = new Map(fresh);
    older.set('https://pc.test/notes.json', new Response(first.files['notes.json']));
    pc.stores.set(`minhajna-web-${first.sha256}`, older);
    assert.equal((await pc.ask({ kind: 'update', sha256: first.sha256 })).ok, false);
    assert.deepEqual([...pc.stores.keys()], [`minhajna-web-${next.sha256}`]);
  });

  it('keeps the old build when a file of the new one fails its hash', async () => {
    pc.serve(next);
    pc.server.set('app.js', 'console.log("changed on the server");');
    assert.equal((await pc.ask({ kind: 'update', sha256: next.sha256 })).ok, false);
    assert.equal(await pc.page('app.js'), first.files['app.js']);
    assert.deepEqual(pc.told, []);
    pc.serve(next);
    assert.equal((await pc.ask({ kind: 'update', sha256: next.sha256 })).ok, true);
    assert.deepEqual([...pc.stores.keys()], [`minhajna-web-${next.sha256}`]);
  });
});
