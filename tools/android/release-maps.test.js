// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { releaseOutputs } from './release-apks.js';
import { compareMaps, mapNames, relativeSources, sharedCode } from './release-maps.js';

function folder(t) {
  const directory = mkdtempSync(join(tmpdir(), 'minhajna-maps-test-'));
  t.after(() => rmSync(directory, { recursive: true }));
  return directory;
}

function apks(t, versionName = '0.5.0') {
  const directory = folder(t);
  const elements = releaseOutputs.map(({ abi, digit }) => ({
    outputFile: `app-${abi}-release-unsigned.apk`,
    filters: abi === 'universal' ? [] : [{ filterType: 'ABI', value: abi }],
    versionCode: 500990 + digit,
    versionName,
  }));
  const metadata = { variantName: 'release', applicationId: 'dz.minhajna.preview', elements };
  writeFileSync(join(directory, 'output-metadata.json'), JSON.stringify(metadata));
  for (const { outputFile } of elements) writeFileSync(join(directory, outputFile), 'synthetic APK');
  return directory;
}

test('names the maps by version', () => {
  assert.deepEqual(mapNames('0.5.0'), {
    mapping: 'minhajna-0.5.0-mapping.txt',
    bundle: 'minhajna-0.5.0-index.android.bundle.map',
  });
});

test('names each source from the repository root, and refuses one outside it', () => {
  const map = { version: 3, sources: ['/build/minhajna/apps/android/index.js', 'packages/core/src/day.ts'] };
  assert.deepEqual(relativeSources(map, '/build/minhajna').sources, [
    'apps/android/index.js',
    'packages/core/src/day.ts',
  ]);
  assert.throws(() => relativeSources({ sources: ['/elsewhere/a.js'] }, '/build/minhajna'), /outside the repository/);
});

test('gives the version when every APK carries the same code and bundle, and refuses otherwise', (t) => {
  assert.equal(
    sharedCode(apks(t), () => Buffer.from('same')),
    '0.5.0',
  );
  const other = (file, entry) => Buffer.from(file.includes('arm64') && entry.includes('bundle') ? 'other' : 'same');
  assert.throws(() => sharedCode(apks(t), other), /same code and bundle/);
  assert.throws(() => sharedCode(apks(t, 'next'), () => Buffer.from('same')));
});

test('compares the two maps of two builds byte for byte', (t) => {
  const [first, second] = [folder(t), folder(t)];
  for (const directory of [first, second]) {
    writeFileSync(join(directory, 'minhajna-0.5.0-mapping.txt'), 'mapping');
    writeFileSync(join(directory, 'minhajna-0.5.0-index.android.bundle.map'), '{}');
  }
  compareMaps(first, second);
  writeFileSync(join(second, 'minhajna-0.5.0-index.android.bundle.map'), '{"sources":[]}');
  assert.throws(() => compareMaps(first, second), /differs between clean builds/);
  const lone = folder(t);
  mkdirSync(join(lone, 'empty'));
  assert.throws(() => compareMaps(first, lone));
});
