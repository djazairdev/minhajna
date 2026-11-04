// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PDF engine in the offline worker (#613, answer 743). Its files, named
// pdf-, are listed but never kept: each comes from the server when asked for,
// only if it is the installed build's, with the host's security policy, even
// where an earlier worker kept it. A worker swapped in over an earlier one's
// install still answers from it. Builds are made up.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { browser, made, ORIGIN, POLICY } from './support/sw-browser.ts';

describe('the PDF engine in the offline worker', () => {
  const first = made('0.6.0', 60099);
  let pc: ReturnType<typeof browser>;
  const engine = { 'pdf-worker.js': 'postMessage(1);', 'pdf-assets/cmaps/Made-up.bcmap': 'made-up map' };
  const withEngine = made('0.7.0', 70099, [], engine);

  beforeEach(async () => {
    pc = browser();
    pc.serve(withEngine);
    await pc.install();
  });

  it('is not kept by an install, though the checksum covers it', () => {
    const kept = [...pc.stores.get(`minhajna-web-${withEngine.sha256}`)!.keys()];
    assert.ok(kept.includes(`${ORIGIN}app.js`));
    assert.deepEqual(
      kept.filter((url) => url.includes('pdf-')),
      [],
    );
    assert.ok('pdf-worker.js' in (JSON.parse(withEngine.json) as { files: object }).files);
  });

  it('comes from the server when asked for, with the host’s policy', async () => {
    pc.fetched.length = 0;
    const answer = await pc.answer('pdf-worker.js');
    assert.equal(answer.status, 200);
    assert.equal(await answer.text(), engine['pdf-worker.js']);
    assert.equal(answer.headers.get('Content-Security-Policy'), POLICY);
    assert.equal(answer.headers.get('Content-Type'), 'text/javascript');
    assert.deepEqual(pc.fetched, ['pdf-worker.js']);
    assert.equal(pc.requests.at(-1)?.credentials, 'omit');
    assert.equal(await pc.page('pdf-assets/cmaps/Made-up.bcmap'), 'made-up map');
  });

  it('answers 404 for a file that is not the installed build’s, that it does not list, or when offline', async () => {
    pc.server.set('pdf-worker.js', 'postMessage("changed on the server");');
    assert.equal((await pc.answer('pdf-worker.js')).status, 404);
    pc.server.set('pdf-unlisted.js', 'postMessage("not in this build");');
    assert.equal((await pc.answer('pdf-unlisted.js')).status, 404);
    assert.equal((await pc.answer('pdf-unlisted.js?a=1')).status, 404);
    pc.serve(withEngine);
    pc.server.delete('pdf-worker.js');
    assert.equal((await pc.answer('pdf-worker.js')).status, 404);
    pc.serve(withEngine);
    pc.reachable.online = false;
    assert.equal((await pc.answer('pdf-worker.js')).status, 404);
    assert.equal(await pc.page('app.js'), withEngine.files['app.js']);
    pc.reachable.online = true;
    assert.equal((await pc.answer('pdf-worker.js')).status, 200);
  });

  it('stays out of a new build’s cache when an update installs it', async () => {
    const newer = made('0.7.1', 70199, [], engine);
    pc.serve(newer);
    assert.equal((await pc.ask({ kind: 'update', sha256: newer.sha256 })).ok, true);
    const kept = [...pc.stores.get(`minhajna-web-${newer.sha256}`)!.keys()];
    assert.deepEqual(
      kept.filter((url) => url.includes('pdf-')),
      [],
    );
  });

  it('is fetched even where an earlier worker kept it without its policy', async () => {
    const store = pc.stores.get(`minhajna-web-${withEngine.sha256}`)!;
    store.set(`${ORIGIN}pdf-worker.js`, new Response(engine['pdf-worker.js']));
    const answer = await pc.answer('pdf-worker.js');
    assert.equal(answer.headers.get('Content-Security-Policy'), POLICY);
  });

  it('gives a page opened at such a path the app, not the file', async () => {
    assert.equal(await (await pc.answer('pdf-worker.js', 'navigate')).text(), withEngine.files['index.html']);
  });

  it('passes through to the server before an install has finished', async () => {
    const fresh = browser();
    fresh.serve(withEngine);
    const answer = await fresh.answer('pdf-worker.js');
    assert.equal(answer.headers.get('Content-Security-Policy'), POLICY);
    assert.equal(await answer.text(), engine['pdf-worker.js']);
  });

  it('answers from an earlier worker’s install after the browser swaps the worker', async () => {
    const swapped = browser();
    swapped.stores.set(
      `minhajna-web-${first.sha256}`,
      new Map([
        [`${ORIGIN}app.js`, new Response(first.files['app.js'])],
        [`${ORIGIN}build.json`, new Response(first.json)],
      ]),
    );
    swapped.server.clear();
    await swapped.install();
    assert.deepEqual(swapped.fetched, []);
    assert.equal(await swapped.page('app.js'), first.files['app.js']);
  });
});
