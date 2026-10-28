// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The build packed for its host, and the host check (answer 528), on a
// made-up build in a folder of its own, as the real dist/ is rebuilt by
// another test meanwhile: the ZIP packs to the same bytes twice, opens in
// zip.js to the build's files, and is refused for a changed file; the local
// server passes the check, which finds a changed file, another checksum
// than the release's, missing headers, a cookie, a redirect, a page given
// for a file the build does not hold, and plain HTTP or no release checksum
// away from this computer.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { after, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { BlobWriter, Uint8ArrayReader, ZipReader, configure } from '@zip.js/zip.js';
import { checksum } from '../scripts/hashes.ts';
import { checkHost } from '../scripts/check-host.ts';
import { packBuild } from '../scripts/pack.ts';
import { serveFolder } from '../scripts/serve.ts';

configure({ useWebWorkers: false });

const POLICY = "default-src 'none'; script-src 'self'";
const hex = (body: string) => createHash('sha256').update(body).digest('hex');

/** A made-up build written to a new folder, with its build.json. */
function madeBuild(): { folder: URL; sha256: string; files: Record<string, string> } {
  const folder = pathToFileURL(`${mkdtempSync(`${tmpdir()}/minhajna-host-`)}/`);
  const files: Record<string, string> = {
    'index.html': `<!doctype html><meta http-equiv="Content-Security-Policy" content="${POLICY}" /><p>made up</p>`,
    'app.js': 'console.log("made up");',
    'notes.json': '{"version":"9.9.9","versionCode":99}',
  };
  for (const [name, body] of Object.entries(files)) writeFileSync(new URL(name, folder), body);
  const hashes = Object.fromEntries(Object.entries(files).map(([name, body]) => [name, hex(body)]));
  const sha256 = checksum(hashes);
  writeFileSync(new URL('build.json', folder), JSON.stringify({ format: 2, version: '9.9.9', sha256, files: hashes }));
  return { folder, sha256, files };
}

const servers: Server[] = [];
after(() => servers.forEach((server) => server.close()));

/** The address of a server started on a free port. */
async function started(server: Server): Promise<string> {
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
}

describe('the packed build', () => {
  it('packs to the same bytes twice, and opens to the build’s files', async () => {
    const { folder, files } = madeBuild();
    const first = packBuild(folder);
    assert.equal(first.version, '9.9.9');
    assert.deepEqual(packBuild(folder).zip, first.zip);
    const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(first.zip)));
    const entries = await reader.getEntries();
    assert.deepEqual(
      entries.map((entry) => entry.filename),
      ['app.js', 'build.json', 'index.html', 'notes.json'],
    );
    for (const entry of entries) {
      if (entry.directory || entry.filename === 'build.json') continue;
      const blob = await entry.getData(new BlobWriter());
      assert.equal(await blob.text(), files[entry.filename]);
    }
    await reader.close();
  });

  it('is refused when a file differs from build.json', () => {
    const { folder } = madeBuild();
    writeFileSync(new URL('app.js', folder), 'console.log("changed");');
    assert.throws(() => packBuild(folder), /does not match build\.json: app\.js/u);
  });
});

describe('the host check', () => {
  it('passes the local server, and gives the release’s checksum or finds another', async () => {
    const { folder, sha256 } = madeBuild();
    const address = await started(serveFolder(folder));
    assert.deepEqual(await checkHost(address), []);
    assert.deepEqual(await checkHost(address, sha256), []);
    assert.deepEqual(await checkHost(address, 'f'.repeat(64)), [
      `build.json: checksum ${sha256}, the release's is ${'f'.repeat(64)}`,
    ]);
  });

  it('finds a file that is not the build’s', async () => {
    const { folder } = madeBuild();
    const address = await started(serveFolder(folder));
    writeFileSync(new URL('app.js', folder), 'console.log("changed");');
    assert.deepEqual(await checkHost(address), ["app.js: not the build's file"]);
  });

  it('finds missing headers, a cookie, and a page given for any file', async () => {
    const { folder } = madeBuild();
    const loose = createServer((request, response) => {
      const name = (request.url ?? '/').slice(1) || 'index.html';
      const file = existsSync(new URL(name, folder)) ? name : 'index.html';
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': 'made=up' });
      response.end(readFileSync(new URL(file, folder)));
    });
    const problems = await checkHost(await started(loose));
    assert.ok(
      problems.includes('app.js: Content-Type is text/html; charset=utf-8, not text/javascript; charset=utf-8'),
    );
    assert.ok(problems.includes('index.html: Cache-Control is missing, not no-store'));
    assert.ok(problems.some((problem) => problem.endsWith(': sets a cookie')));
    assert.ok(problems.includes('a file outside the build: status 200, not 404'));
  });

  it('finds a redirect', async () => {
    const { folder } = madeBuild();
    const target = await started(serveFolder(folder));
    const moving = createServer((request, response) => {
      const name = (request.url ?? '/').slice(1);
      if (name === 'app.js') response.writeHead(301, { Location: `${target}app.js` }).end();
      else serveFolder(folder).emit('request', request, response);
    });
    assert.deepEqual(await checkHost(await started(moving)), ['app.js: status 301']);
  });

  it('refuses plain HTTP, or no release checksum, away from this computer', async () => {
    assert.deepEqual(await checkHost('http://pc.test', 'f'.repeat(64)), ['http://pc.test/ is not HTTPS']);
    assert.deepEqual(await checkHost('https://pc.test'), [
      "https://pc.test/: give the release's build checksum to check against",
    ]);
  });
});
