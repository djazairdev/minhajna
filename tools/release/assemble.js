// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Writes a release's SHA256SUMS.txt and release-notes.md beside its files
// (releases.md, items 12 and 13): `node tools/release/assemble.js <folder>
// [--rehearsal]`, with VERSION, COMMIT, RUN_URL, CERTIFICATE and, when the
// release has a checklist issue, ISSUE in the environment. The folder must
// hold the three APKs, the two maps and the web app's ZIP under their
// published names, and nothing else is listed. The ZIP's build.json must
// be this version's, and gives the build checksum the notes print. Only
// Node's built-ins and the build machines' unzip are used.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { releaseFiles, releaseNotes, releaseSection } from './changelog.js';

/** Each published file's SHA-256, by name, in the order SHA256SUMS.txt lists them. */
export function fileSums(folder, version) {
  return Object.fromEntries(
    Object.values(releaseFiles(version)).map((name) => [
      name,
      createHash('sha256')
        .update(readFileSync(join(folder, name)))
        .digest('hex'),
    ]),
  );
}

/** SHA256SUMS.txt, as sha256sum writes it. */
export function sumsFile(sums) {
  return Object.entries(sums)
    .map(([name, hash]) => `${hash}  ${name}\n`)
    .join('');
}

/** The web app's build checksum, from the build.json in its ZIP, which must be this version's. */
export function webChecksum(zip, version, read = (file) => execFileSync('unzip', ['-p', file, 'build.json'])) {
  const built = JSON.parse(read(zip).toString('utf8'));
  assert.equal(built.version, version, `The web ZIP holds ${built.version}, not ${version}`);
  assert.match(built.sha256, /^[0-9a-f]{64}$/u);
  return built.sha256;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [folder = '', flag] = process.argv.slice(2);
  const { VERSION = '', COMMIT = '', RUN_URL = '', CERTIFICATE = '', ISSUE = '' } = process.env;
  assert.match(COMMIT, /^[0-9a-f]{40}$/u, 'COMMIT is the release commit');
  assert.match(CERTIFICATE, /^[0-9a-f]{64}$/u, 'CERTIFICATE is the signing certificate SHA-256');
  assert.match(ISSUE, /^\d*$/u, 'ISSUE is a number or empty');
  const changelog = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');
  const section = releaseSection(changelog, VERSION);
  assert.ok(section, `CHANGELOG.md has no dated section for ${VERSION}`);
  const sums = fileSums(folder, VERSION);
  const notes = releaseNotes(section, {
    sums,
    certificate: CERTIFICATE,
    webChecksum: webChecksum(join(folder, releaseFiles(VERSION).web), VERSION),
    commit: COMMIT,
    run: RUN_URL,
    issue: ISSUE,
    rehearsal: flag === '--rehearsal',
  });
  writeFileSync(join(folder, 'SHA256SUMS.txt'), sumsFile(sums));
  writeFileSync(join(folder, 'release-notes.md'), notes);
  process.stdout.write(sumsFile(sums));
}
