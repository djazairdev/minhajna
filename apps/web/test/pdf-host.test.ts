// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// PDF support files must be served by the real host rules too, or the
// offline worker cannot install a complete build. Every asset is made up.

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { answer, type Assets } from '../scripts/worker.ts';
import { serveFolder } from '../scripts/serve.ts';

const policy = "default-src 'none'; script-src 'self'; connect-src 'self' https://minhajna-demo.djazair.dev";
const files = new Map([
  ['index.html', `<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}">`],
  ['pdf-assets/cmaps/Adobe-GB1-UCS2.bcmap', 'synthetic CMap'],
  ['pdf-assets/standard_fonts/FoxitSymbol.pfb', 'synthetic font'],
  ['pdf-assets/iccs/CGATS001Compat-v2-micro.icc', 'synthetic profile'],
]);

test('the Cloudflare host serves the checked PDF support files as binary, and refuses them outside their folders', async () => {
  const assets: Assets = {
    fetch: (url) =>
      Promise.resolve(
        new Response(files.get(url.pathname.slice(1)) ?? '', { status: files.has(url.pathname.slice(1)) ? 200 : 404 }),
      ),
  };
  for (const [name, content] of [...files].slice(1)) {
    const response = await answer(new Request(`https://example.invalid/${name}`), assets);
    assert.equal(response.status, 200, name);
    assert.equal(response.headers.get('Content-Type'), 'application/octet-stream');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(await response.text(), content);
    const outside = name.split('/').at(-1)!;
    const permissive: Assets = { fetch: () => Promise.resolve(new Response('not a build file')) };
    assert.equal((await answer(new Request(`https://example.invalid/${outside}`), permissive)).status, 404);
  }
});

test('the local production server serves every PDF support file for offline caching', async () => {
  const root = pathToFileURL(`${mkdtempSync(`${tmpdir()}/minhajna-pdf-host-`)}/`);
  for (const folder of ['cmaps', 'standard_fonts', 'iccs'])
    mkdirSync(new URL(`pdf-assets/${folder}/`, root), { recursive: true });
  for (const [name, content] of files) writeFileSync(new URL(name, root), content);
  const server = serveFolder(root);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  try {
    const address = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    for (const [name, content] of [...files].slice(1)) {
      const response = await fetch(new URL(name, address));
      assert.equal(response.status, 200, name);
      assert.equal(await response.text(), content);
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});
