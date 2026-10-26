// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The maps that read a release's crash reports (#460, R-1.5-07, answer 483):
// R8's mapping for Java and Kotlin frames, and the Hermes bundle's source map
// for JavaScript frames. The three APKs of a release carry the same code and
// the same bundle, so one pair serves them all. The source map names its
// sources relative to the repository, so two builds at different paths give
// the same files. Neither map goes into an APK; both are published with the
// release. Only Node's built-ins and the build machines' unzip are used.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { log } from 'node:console';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { releaseApks } from './release-apks.js';

/** Where the build leaves each map, under the app's build directory. */
export const buildMaps = {
  mapping: 'outputs/mapping/release/mapping.txt',
  bundle: 'generated/sourcemaps/react/release/index.android.bundle.map',
};

/** The published names of a release's two maps. */
export function mapNames(version) {
  return { mapping: `minhajna-${version}-mapping.txt`, bundle: `minhajna-${version}-index.android.bundle.map` };
}

/** The source map with each source named from the repository's root; a source outside it is refused. */
export function relativeSources(map, root) {
  const sources = map.sources.map((source) => {
    const path = isAbsolute(source) ? relative(root, source) : source;
    assert.ok(path !== '' && !path.startsWith('..') && !isAbsolute(path), `A source outside the repository: ${source}`);
    return path.split(sep).join('/');
  });
  return { ...map, sources };
}

/** The release's version, checking that its APKs share one code and one bundle, so one pair of maps serves all. */
export function sharedCode(apkDirectory, read = unzip) {
  const apks = releaseApks(apkDirectory);
  const metadata = JSON.parse(readFileSync(join(apkDirectory, 'output-metadata.json'), 'utf8'));
  const versions = new Set(metadata.elements.map((element) => element.versionName));
  assert.equal(versions.size, 1, 'One version name');
  const [version] = versions;
  assert.match(version, /^\d+\.\d+\.\d+(-beta\.\d+)?$/u);
  const prints = apks.map(
    ({ file }) => `${hash(read(file, 'classes*.dex'))} ${hash(read(file, 'assets/index.android.bundle'))}`,
  );
  assert.equal(new Set(prints).size, 1, 'Every APK of a release must carry the same code and bundle');
  return version;
}

/** Writes the release's two maps under their published names, and gives their paths. */
export function collectMaps(buildDirectory, outDirectory, root = repositoryRoot()) {
  const version = sharedCode(join(buildDirectory, 'outputs/apk/release'));
  const names = mapNames(version);
  const map = JSON.parse(readFileSync(join(buildDirectory, buildMaps.bundle), 'utf8'));
  mkdirSync(outDirectory, { recursive: true });
  const files = {
    mapping: join(outDirectory, names.mapping),
    bundle: join(outDirectory, names.bundle),
  };
  writeFileSync(files.mapping, readFileSync(join(buildDirectory, buildMaps.mapping)));
  writeFileSync(files.bundle, JSON.stringify(relativeSources(map, root)));
  for (const file of Object.values(files)) log(`${file}: SHA-256 ${hash(readFileSync(file))}`);
  return files;
}

/** Requires the same maps, byte for byte, from two builds. */
export function compareMaps(first, second) {
  const names = readdirSync(first).sort();
  assert.deepEqual(readdirSync(second).sort(), names);
  assert.equal(names.length, 2, 'A mapping and a source map');
  for (const name of names) {
    const bytes = readFileSync(join(first, name));
    assert.ok(bytes.equals(readFileSync(join(second, name))), `${name} differs between clean builds`);
    log(`${name}: identical, SHA-256 ${hash(bytes)}`);
  }
}

function repositoryRoot() {
  return fileURLToPath(new URL('../../', import.meta.url));
}

function unzip(file, entry) {
  return execFileSync('unzip', ['-p', file, entry], { maxBuffer: 64 * 1024 * 1024 });
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, first, second] = process.argv.slice(2);
  assert.ok(first && second, 'Usage: release-maps.js collect <app build directory> <out> | compare <first> <second>');
  if (command === 'collect') collectMaps(first, second);
  else {
    assert.equal(command, 'compare');
    compareMaps(first, second);
  }
}
