// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Worker that serves the PC web app on Cloudflare (answers 534 and 537),
// over a made-up build whose files stand in for the assets binding: the host
// check passes against it as against the local server, with the release's
// checksum; the page's policy is read once; and a request for anything but a
// file of the build, by any method but GET, is 404, while plain HTTP away
// from this computer goes to HTTPS, which alone carries the HTTPS header.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { after, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { checkHost } from '../scripts/check-host.ts';
import { checksum } from '../scripts/hashes.ts';
import { answer, type Assets } from '../scripts/worker.ts';

const POLICY = "default-src 'none'; script-src 'self'; connect-src 'self' https://minhajna-demo.djazair.dev";
const hex = (body: string) => createHash('sha256').update(body).digest('hex');

/** A made-up build in a new folder, and an assets binding over it that records its reads. */
function madeAssets(): { assets: Assets; sha256: string; reads: string[] } {
  const folder = pathToFileURL(`${mkdtempSync(`${tmpdir()}/minhajna-worker-`)}/`);
  const files: Record<string, string> = {
    'index.html': `<!doctype html><meta http-equiv="Content-Security-Policy" content="${POLICY}" /><p>made up</p>`,
    'app.js': 'console.log("made up");',
    'fonts/made-up.ttf': 'not a real font',
  };
  mkdirSync(new URL('fonts/', folder));
  for (const [name, body] of Object.entries(files)) writeFileSync(new URL(name, folder), body);
  const hashes = Object.fromEntries(Object.entries(files).map(([name, body]) => [name, hex(body)]));
  const sha256 = checksum(hashes);
  writeFileSync(new URL('build.json', folder), JSON.stringify({ format: 2, version: '9.9.9', sha256, files: hashes }));
  const reads: string[] = [];
  const assets: Assets = {
    fetch: (input) => {
      reads.push(input.pathname);
      const file = new URL(input.pathname.slice(1), folder);
      const found = existsSync(file) && statSync(file).isFile();
      return Promise.resolve(found ? new Response(readFileSync(file)) : new Response('not found', { status: 404 }));
    },
  };
  return { assets, sha256, reads };
}

const servers: Server[] = [];
after(() => servers.forEach((server) => server.close()));

/** The address of a local server that hands each request to the Worker. */
async function started(assets: Assets): Promise<string> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    void answer(new Request(url, { method: request.method ?? 'GET' }), assets).then(async (reply) => {
      response.writeHead(reply.status, Object.fromEntries(reply.headers));
      response.end(Buffer.from(await reply.arrayBuffer()));
    });
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
}

describe('the Worker on the host', () => {
  it('passes the host check with the release’s checksum, reading the page’s policy once', async () => {
    const { assets, sha256, reads } = madeAssets();
    assert.deepEqual(await checkHost(await started(assets), sha256), []);
    const pageRequests = 3;
    assert.equal(reads.filter((path) => path === '/index.html').length, pageRequests + 1);
  });

  it('answers 404 to another method, another kind of file, a missing file or a broken path', async () => {
    const { assets } = madeAssets();
    const status = async (path: string, method = 'GET') =>
      (await answer(new Request(`https://minhajna.djazair.dev${path}`, { method }), assets)).status;
    assert.equal(await status('/app.js', 'POST'), 404);
    assert.equal(await status('/app.js', 'HEAD'), 404);
    assert.equal(await status('/config.php'), 404);
    assert.equal(await status('/fonts'), 404);
    assert.equal(await status('/gone.js'), 404);
    assert.equal(await status('/%E0%A4%A.js'), 404);
    assert.equal(await status('/app.js'), 200);
  });

  it('sends plain HTTP to HTTPS, which alone carries the HTTPS header', async () => {
    const { assets } = madeAssets();
    const plain = await answer(new Request('http://minhajna.djazair.dev/app.js?x=1'), assets);
    assert.equal(plain.status, 301);
    assert.equal(plain.headers.get('Location'), 'https://minhajna.djazair.dev/app.js?x=1');
    const secure = await answer(new Request('https://minhajna.djazair.dev/'), assets);
    assert.equal(secure.headers.get('Strict-Transport-Security'), 'max-age=31536000');
    assert.equal(secure.headers.get('Content-Security-Policy'), `${POLICY}; frame-ancestors 'self'`);
    assert.equal(secure.headers.get('Content-Type'), 'text/html; charset=utf-8');
    const local = await answer(new Request('http://127.0.0.1:8787/app.js'), assets);
    assert.equal(local.status, 200);
    assert.equal(local.headers.get('Strict-Transport-Security'), null);
  });
});
