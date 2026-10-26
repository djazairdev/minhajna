// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The web app's fixed bundle (#250, R-6.6-01, R-6.6-07): built twice to the
// same checksum, which build.json gives with each file's SHA-256 and which
// sha256sum's lines reproduce; the version in the bundle; a page whose
// security policy loads nothing from elsewhere and runs no inline script;
// every font alias of the phone app, every drawable as an SVG, and a licence
// notice for every package in the bundle. The browser's own install and
// offline start are checked by hand (docs/checks/web-shell.md).

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { androidVersion, checksum, fileHashes } from '../scripts/build.ts';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);

type Built = { format: number; version: string; versionCode: number; sha256: string; files: Record<string, string> };

function build(): Built {
  execFileSync(process.execPath, [fileURLToPath(new URL('scripts/build.ts', root))], { stdio: 'ignore' });
  return JSON.parse(readFileSync(new URL('build.json', dist), 'utf8')) as Built;
}

const text = (name: string) => readFileSync(new URL(name, dist), 'utf8');

describe('the web bundle', () => {
  const first = build();
  const second = build();
  const files = readdirSync(dist, { recursive: true, encoding: 'utf8' })
    .map((name) => name.replaceAll('\\', '/'))
    .filter((name) => /\.[a-z]+$/u.test(name));

  it('builds to the same checksum twice, over every file but build.json', () => {
    assert.match(first.sha256, /^[0-9a-f]{64}$/u);
    assert.equal(second.sha256, first.sha256);
    const others = files.filter((name) => name !== 'build.json');
    assert.deepEqual(first.files, fileHashes(dist, others));
    assert.equal(checksum(first.files), first.sha256);
  });

  it('gives a checksum that sha256sum’s lines reproduce', () => {
    const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
    const lines = files
      .filter((name) => name !== 'build.json')
      .sort()
      .map((name) => `${hash(readFileSync(new URL(name, dist)))}  ${name}\n`)
      .join('');
    assert.equal(hash(lines), first.sha256);
  });

  it('gives the Android app’s version', () => {
    const gradle = readFileSync(new URL('../android/android/app/build.gradle', root), 'utf8');
    assert.deepEqual({ version: first.version, versionCode: first.versionCode }, androidVersion(gradle));
    assert.throws(() => androidVersion('android {}'), /No version/u);
  });

  it('lists every file for the offline worker, and nothing that is not there', () => {
    assert.deepEqual(Object.keys(first.files), files.filter((name) => name !== 'build.json').sort());
    assert.ok('index.html' in first.files && 'app.js' in first.files);
  });

  it('builds the version into the bundle for crash reports', () => {
    assert.ok(text('app.js').includes(JSON.stringify(first.version)));
    assert.doesNotMatch(text('app.js'), /MINHAJNA_WEB_VERSION/u);
  });

  it('loads nothing from elsewhere and runs no inline script', () => {
    const html = text('index.html');
    const policy = /content="(default-src[^"]+)"/u.exec(html)?.[1] ?? '';
    assert.match(policy, /default-src 'none'/u);
    assert.match(policy, /script-src 'self';/u);
    assert.match(policy, /connect-src 'self';/u);
    assert.doesNotMatch(policy, /unsafe|https?:|\*/u);
    assert.doesNotMatch(html, /(?:src|href)="(?!\.\/)/u);
    assert.doesNotMatch(html, /<script(?![^>]*src=)/u);
    assert.doesNotMatch(text('fonts.css') + text('page.css'), /url\((?!'\.\/)/u);
  });

  it('has every font alias of the phone app, and every drawable', () => {
    const css = text('fonts.css');
    const fonts = readFileSync(new URL('../android/src/design/fonts.ts', root), 'utf8');
    const aliases = [...fonts.matchAll(/'\d00': '([^']+)'/gu)].map((match) => match[1]);
    assert.equal(aliases.length, 9);
    for (const family of aliases) assert.match(css, new RegExp(`font-family: '${family ?? ''}';`, 'u'));
    const drawables = readdirSync(new URL('../android/android/app/src/main/res/drawable/', root)).filter((name) =>
      /^(?:icon_|chalk_|minhajna_)/u.test(name),
    );
    for (const name of drawables) assert.ok(files.includes(`drawables/${name.replace('.xml', '.svg')}`), name);
  });

  it('gives a licence notice for every package in the bundle', () => {
    const { version, notices } = JSON.parse(text('licences.json')) as {
      version: string;
      notices: { name: string; text: string }[];
    };
    assert.equal(version, first.version);
    const names = notices.map((notice) => notice.name);
    for (const name of ['data', 'fonts', 'react 19.3.1', 'react-dom 19.3.1', 'react-native-web 0.21.4'])
      assert.ok(names.includes(name), name);
    for (const notice of notices.slice(2)) assert.ok(notice.text.startsWith(`${notice.name}\n\n`), notice.name);
    assert.match(
      notices.find((notice) => notice.name.startsWith('@react-native/normalize-colors'))?.text ?? '',
      /MIT/u,
    );
  });
});
