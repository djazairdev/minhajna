// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard app's fixed bundle (answer 855), built by the PC web app's
// scripts: twice to the same checksum, which build.json gives with each file's
// SHA-256; the Android app's version; a page whose security policy loads
// nothing from elsewhere, connects only to the demo server and runs no inline
// script; the communes, which only this app bundles; no offline worker, update
// notes or PDF engine; a licence notice for every package; and served as its
// host serves it, the host check passes; packed, unpacked and packed again, it
// gives the same bytes. The teacher's web app is checked apart (apps/web/test).

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { after, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { androidVersion } from '../../web/scripts/bundle.ts';
import { checkHost } from '../../web/scripts/check-host.ts';
import { checksum } from '../../web/scripts/hashes.ts';
import { addressProblems } from '../../web/scripts/host.ts';
import { packBuild } from '../../web/scripts/pack.ts';
import { serveFolder } from '../../web/scripts/serve.ts';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);

type Built = { format: number; version: string; versionCode: number; sha256: string; files: Record<string, string> };

function build(): Built {
  execFileSync(process.execPath, [fileURLToPath(new URL('scripts/build.ts', root))], { stdio: 'ignore' });
  return JSON.parse(readFileSync(new URL('build.json', dist), 'utf8')) as Built;
}

const text = (name: string) => readFileSync(new URL(name, dist), 'utf8');
const scripts = (built: Built) =>
  Object.keys(built.files)
    .filter((name) => name.endsWith('.js'))
    .map(text)
    .join('\n');

describe('the dashboard bundle', () => {
  const first = build();
  const second = build();
  const server = serveFolder(dist);
  after(() => server.close());

  it('builds to the same checksum twice, with the Android app’s version', () => {
    assert.match(first.sha256, /^[0-9a-f]{64}$/u);
    assert.equal(second.sha256, first.sha256);
    assert.equal(checksum(first.files), first.sha256);
    const gradle = readFileSync(new URL('../android/android/app/build.gradle', root), 'utf8');
    assert.deepEqual({ version: first.version, versionCode: first.versionCode }, androidVersion(gradle));
  });

  it('loads nothing from elsewhere, connects to the demo server only, and runs no inline script', () => {
    const html = text('index.html');
    const policy = /content="(default-src[^"]+)"/u.exec(html)?.[1] ?? '';
    assert.deepEqual(addressProblems(policy), []);
    assert.match(policy, /connect-src 'self' https:\/\/minhajna-demo\.djazair\.dev;/u);
    assert.doesNotMatch(policy, /unsafe|http:|\*|worker-src|manifest-src/u);
    assert.doesNotMatch(html, /(?:src|href)="(?!\.\/)/u);
    assert.doesNotMatch(html, /<script(?![^>]*src=)/u);
    assert.doesNotMatch(text('fonts.css') + text('page.css'), /url\((?!'\.\/)/u);
  });

  it('bundles the dashboard and the communes, with no offline worker, notes or PDF engine', () => {
    const names = Object.keys(first.files);
    for (const name of ['index.html', 'app.js', 'fonts.css', 'licences.json', 'icon.svg'])
      assert.ok(name in first.files);
    for (const name of names) assert.doesNotMatch(name, /^(?:sw\.js|offer\.js|notes\.json|manifest|pdf-)/u);
    const code = scripts(first);
    assert.ok(code.includes('Reggane'));
    assert.ok(code.includes('that come with the dashboard could not be read'));
  });

  it('gives a licence notice for every package in the bundle', () => {
    const { version, notices } = JSON.parse(text('licences.json')) as { version: string; notices: { name: string }[] };
    assert.equal(version, first.version);
    const names = notices.map((notice) => notice.name);
    for (const name of ['data', 'fonts', 'react 19.3.1', 'react-dom 19.3.1', 'react-native-web 0.21.4'])
      assert.ok(names.includes(name), name);
    assert.ok(!names.some((name) => /^(?:echarts|@xyflow|pdfjs-dist)/u.test(name)));
  });

  it('passes the host check as its host serves it, and again packed and unpacked', async () => {
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const address = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    assert.deepEqual(await checkHost(address, first.sha256), []);
    const { zip } = packBuild(dist);
    const folder = mkdtempSync(`${tmpdir()}/minhajna-dashboard-`);
    writeFileSync(`${folder}/build.zip`, zip);
    execFileSync('unzip', ['-q', `${folder}/build.zip`, '-d', `${folder}/dist`]);
    assert.equal(packBuild(pathToFileURL(`${folder}/dist/`)).zip.equals(zip), true);
  });
});
