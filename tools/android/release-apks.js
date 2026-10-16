// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// CI must check both processor-specific APKs, never a stale universal APK.
// Only Node's built-ins and the build machines' existing unzip are used.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { log } from 'node:console';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

/** The two phone architectures shipped by the release workflow. */
export const phoneAbis = ['armeabi-v7a', 'arm64-v8a'];

/** Rejects missing, extra, mislabelled or non-release outputs before any CI check. */
export function releaseApks(directory) {
  const expected = phoneAbis.map((abi) => `app-${abi}-release-unsigned.apk`);
  assert.deepEqual(
    readdirSync(directory)
      .filter((name) => name.endsWith('.apk'))
      .sort(),
    expected.toSorted(),
  );
  const metadata = JSON.parse(readFileSync(join(directory, 'output-metadata.json'), 'utf8'));
  assert.equal(metadata.variantName, 'release');
  assert.equal(metadata.applicationId, 'dz.minhajna.preview');
  assert.equal(metadata.elements.length, phoneAbis.length);
  return phoneAbis.map((abi, index) => {
    const name = expected[index];
    const element = metadata.elements.find((entry) => entry.outputFile === name);
    assert.ok(element, `Missing metadata for ${name}`);
    assert.deepEqual(element.filters, [{ filterType: 'ABI', value: abi }]);
    return { abi, name, file: join(directory, name) };
  });
}

/** Checks archive contents so shrinking cannot silently remove fonts, JNI or notices. */
export function verifyApks(directory) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const fontManifest = JSON.parse(readFileSync(join(root, 'apps/android/fonts/manifest.json'), 'utf8'));
  const fontHashes = fontManifest.families.flatMap((family) => family.files.map((font) => font.sha256)).sort();
  const folder = join(root, 'apps/android/android/app/src/main/assets/licenses');
  const notices = new Map(readdirSync(folder).map((name) => [name, readFileSync(join(folder, name))]));
  for (const { abi, name, file } of releaseApks(directory)) {
    const entries = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' }).trim().split('\n');
    verifyContents(entries, (entry) => unzip(file, entry), abi, fontHashes, notices);
    log(`${name}: ${readFileSync(file).length} bytes, SHA-256 ${hash(readFileSync(file))}`);
  }
}

/** Validates extracted archive entries, with byte readers supplied by the caller. */
export function verifyContents(entries, readEntry, abi, fontHashes, notices) {
  const libraries = entries.filter((entry) => entry.startsWith('lib/') && entry.endsWith('.so'));
  assert.deepEqual([...new Set(libraries.map((entry) => entry.split('/')[1]))], [abi]);
  for (const library of ['libappmodules.so', 'libreactnative.so', 'libhermesvm.so', 'libsqlcipher.so']) {
    assert.ok(libraries.includes(`lib/${abi}/${library}`), `Missing ${library} for ${abi}`);
  }
  const fonts = entries
    .filter((entry) => entry.endsWith('.ttf'))
    .map((entry) => hash(readEntry(entry)))
    .sort();
  assert.deepEqual(fonts, fontHashes, 'Every bundled font must remain unchanged');
  for (const [name, bytes] of notices) {
    assert.ok(entries.includes(`assets/licenses/${name}`), `Missing ${name}`);
    assert.ok(readEntry(`assets/licenses/${name}`).equals(bytes), `Changed ${name}`);
  }
}

/** Requires byte equality for each ABI independently, not just one matching output. */
export function compareApks(first, second) {
  const copies = releaseApks(second);
  for (const { name, file } of releaseApks(first)) {
    const other = copies.find((copy) => copy.name === name);
    assert.ok(other);
    assert.ok(readFileSync(file).equals(readFileSync(other.file)), `${name} differs between clean builds`);
    log(`${name}: identical, SHA-256 ${hash(readFileSync(file))}`);
  }
}

function unzip(file, entry) {
  return execFileSync('unzip', ['-p', file, entry], { maxBuffer: 8 * 1024 * 1024 });
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, first, second] = process.argv.slice(2);
  assert.ok(first, 'Usage: release-apks.js verify <directory> | compare <first> <second>');
  if (command === 'verify') verifyApks(first);
  else {
    assert.equal(command, 'compare');
    assert.ok(second, 'A second output directory is required');
    compareApks(first, second);
  }
}
