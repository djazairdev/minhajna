// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The release tools on made-up versions and files: which commit is a release
// and which is the latest, the notes from a changelog section and the
// refusal of an incomplete one, the checksums and the web build's checksum,
// and a signed APK that is its build plus a signature, or more. The real
// changelog's newest release must read as a section too.

import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { URL } from 'node:url';
import { fileSums, sumsFile, webChecksum } from './assemble.js';
import { releaseFiles, releaseNotes, releaseSection } from './changelog.js';
import { appVersion, compareVersions, releasePlan, taggedVersions } from './plan.js';
import { signatureOnly } from './signed-apk.js';

const ARABIC = '\u0646\u0635';
const gradle = (name) =>
  `android {\n    defaultConfig {\n        versionCode 90099\n        versionName "${name}"\n    }\n}\n`;
const changelog = [
  '# Changelog\n\n## Unreleased\n\nNot released yet.\n',
  `## 9.1.0 (2031-01-02)\n\nA made-up release.\n\n${ARABIC}\n\nThanks to made-up contributors.\n`,
  `### New\n\n- A made-up feature.\n  - ${ARABIC} 1\n- Another one.\n  - ${ARABIC} 2\n`,
  `### Privacy\n\n- Nothing leaves the phone.\n  - ${ARABIC} 3\n`,
  `## 9.0.0 (2031-01-01)\n\nAn older one.\n\n${ARABIC}\n\n### Fixed\n\n- A made-up fix.\n  - ${ARABIC}\n`,
].join('\n');
const listing = ['v9.0.0', 'app-v0.1.0', 'v8.0.0-beta.1', 'server-v1.0.0']
  .map((tag, at) => `${String(at).repeat(40)}\trefs/tags/${tag}`)
  .join('\n');

describe('the release plan', () => {
  it('reads the version and the app tags', () => {
    assert.deepEqual(appVersion(gradle('9.1.0')), { name: '9.1.0', code: 90099 });
    assert.throws(() => appVersion(gradle('9.1')), /not a release version/u);
    assert.deepEqual(taggedVersions(listing), ['9.0.0', '8.0.0-beta.1']);
  });

  it('orders versions, a beta before its release', () => {
    assert.equal(compareVersions('9.1.0', '9.0.10'), 1);
    assert.equal(compareVersions('9.1.0-beta.2', '9.1.0'), -1);
    assert.equal(compareVersions('9.1.0-beta.2', '9.1.0-beta.10'), -1);
    assert.equal(compareVersions('9.1.0', '9.1.0'), 0);
  });

  it('releases an untagged, dated version pushed to a branch, and rehearses a pull request', () => {
    const plan = (name, event, tags = listing) =>
      releasePlan({ gradle: gradle(name), changelog, listing: tags, event });
    assert.deepEqual(
      [plan('9.1.0', 'push')].map(({ build, release, latest }) => ({ build, release, latest })),
      [{ build: true, release: true, latest: true }],
    );
    assert.equal(plan('9.0.0', 'push').release, false);
    assert.equal(plan('9.2.0', 'push').release, false);
    assert.match(plan('9.2.0', 'push').note, /no dated heading/u);
    assert.deepEqual([plan('9.0.0', 'pull_request').build, plan('9.0.0', 'pull_request').release], [true, false]);
    assert.equal(plan('9.1.0', 'push', `${listing}\n${'9'.repeat(40)}\trefs/tags/v9.2.0`).latest, false);
    assert.equal(plan('9.1.0', 'push', `${listing}\n${'9'.repeat(40)}\trefs/tags/v9.2.0-beta.1`).latest, true);
    assert.equal(plan('9.1.0', 'pull_request', `${listing}\n${'9'.repeat(40)}\trefs/tags/v9.1.0`).prerelease, false);
  });
});

describe('the release notes', () => {
  it('read a version’s section, and refuse a missing Arabic line, an unknown or out-of-order section', () => {
    const section = releaseSection(changelog, '9.1.0');
    assert.equal(section?.date, '2031-01-02');
    assert.deepEqual(
      section?.sections.map(({ name, entries }) => [name, entries.length]),
      [
        ['New', 2],
        ['Privacy', 1],
      ],
    );
    assert.equal(releaseSection(changelog, '9.3.0'), undefined);
    const broken = (text) => () => releaseSection(changelog.replace(`  - ${ARABIC} 2\n`, text), '9.1.0');
    assert.throws(broken(''), /no Arabic line for: Another one/u);
    assert.throws(
      () => releaseSection(changelog.replace('### Privacy', '### Fixes'), '9.1.0'),
      /no section is called Fixes/u,
    );
    assert.throws(() => releaseSection(changelog.replace('### New', '### Security'), '9.1.0'), /out of order/u);
  });

  it('give each file’s checksum, the build’s, the source and both languages', () => {
    const files = releaseFiles('9.1.0');
    const sums = Object.fromEntries(Object.values(files).map((name, at) => [name, String(at).repeat(64)]));
    const notes = releaseNotes(releaseSection(changelog, '9.1.0'), {
      sums,
      certificate: 'c'.repeat(64),
      webChecksum: 'w'.repeat(64),
      commit: 'a'.repeat(40),
      run: 'https://example.test/run',
      issue: '7',
      rehearsal: false,
    });
    assert.ok(notes.startsWith(`A made-up release.\n\n${ARABIC}\n\nThanks to made-up contributors.\n`));
    assert.ok(
      notes.includes(
        '| `minhajna-9.1.0.apk` | **Any phone with Android 8 or later.** Use this one if unsure. | ' +
          `\`${'0'.repeat(64)}\` |`,
      ),
    );
    assert.ok(notes.includes(`\`${'w'.repeat(64)}\``));
    assert.ok(
      notes.includes('the tag `v9.1.0` (aaaaaaa), signed, by [the release workflow](https://example.test/run)'),
    );
    assert.ok(notes.includes('Release checklist: #7.'));
    assert.ok(notes.includes('### New\n\n- A made-up feature.\n- Another one.\n'));
    assert.ok(notes.includes(`\n- ${ARABIC} 1\n- ${ARABIC} 2\n`));
    assert.ok(!notes.includes('rehearsal'));
  });

  it('read the changelog’s newest release', () => {
    const text = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');
    const newest = /^## (\d+\.\d+\.\d+(?:-beta\.\d+)?) \(/mu.exec(text)?.[1] ?? '';
    assert.ok(releaseSection(text, newest)?.sections.length);
  });
});

describe('the release files', () => {
  it('list each file’s checksum, and the web build’s, which must be this version’s', () => {
    const folder = mkdtempSync(join(tmpdir(), 'minhajna-release-'));
    for (const name of Object.values(releaseFiles('9.1.0'))) writeFileSync(join(folder, name), name);
    const sums = fileSums(folder, '9.1.0');
    assert.equal(Object.keys(sums)[0], 'minhajna-9.1.0.apk');
    assert.match(sumsFile(sums), /^[0-9a-f]{64} {2}minhajna-9\.1\.0\.apk\n/u);
    const built = (version) => () => Buffer.from(JSON.stringify({ version, sha256: 'b'.repeat(64) }));
    assert.equal(webChecksum('made-up.zip', '9.1.0', built('9.1.0')), 'b'.repeat(64));
    assert.throws(() => webChecksum('made-up.zip', '9.1.0', built('9.0.0')), /holds 9\.0\.0, not 9\.1\.0/u);
  });
});

describe('a signed APK', () => {
  const entries = Buffer.from('made-up entries');
  const directory = Buffer.from('made-up central directory');
  const end = (offset) => {
    const record = Buffer.alloc(22);
    record.writeUInt32LE(0x06054b50, 0);
    record.writeUInt32LE(offset, 16);
    return record;
  };
  const block = () => {
    const size = Buffer.alloc(8);
    size.writeBigUInt64LE(32n);
    return Buffer.concat([size, Buffer.alloc(8, 7), size, Buffer.from('APK Sig Block 42')]);
  };
  const unsigned = Buffer.concat([entries, directory, end(entries.length)]);
  const signedWith = (body) => Buffer.concat([body, Buffer.alloc(4), block(), directory, end(body.length + 4 + 40)]);

  it('is its build plus a signature, or says what else changed', () => {
    assert.equal(signatureOnly(signedWith(entries), unsigned), undefined);
    assert.equal(signatureOnly(signedWith(Buffer.from('changed entries')), unsigned), 'the entries differ');
    assert.equal(signatureOnly(unsigned, unsigned), 'no APK Signing Block');
  });
});
