// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { compareApks, phoneAbis, releaseApks, verifyContents } from './release-apks.js';

function fixture(t, change = () => {}) {
  const directory = mkdtempSync(join(tmpdir(), 'minhajna-apks-test-'));
  t.after(() => rmSync(directory, { recursive: true }));
  const elements = phoneAbis.map((abi) => ({
    outputFile: `app-${abi}-release-unsigned.apk`,
    filters: [{ filterType: 'ABI', value: abi }],
  }));
  const metadata = { variantName: 'release', applicationId: 'dz.minhajna.preview', elements };
  change(metadata);
  writeFileSync(join(directory, 'output-metadata.json'), JSON.stringify(metadata));
  for (const { outputFile } of elements) writeFileSync(join(directory, outputFile), 'synthetic APK test bytes');
  return directory;
}

test('requires both phone APKs and agrees with Gradle output metadata', (t) => {
  const directory = fixture(t);
  assert.deepEqual(
    releaseApks(directory).map(({ abi }) => abi),
    phoneAbis,
  );
});

test('rejects a missing ABI instead of checking only the APK that exists', (t) => {
  const directory = fixture(t);
  rmSync(join(directory, 'app-arm64-v8a-release-unsigned.apk'));
  assert.throws(() => releaseApks(directory));
});

test('rejects a stale universal APK beside the two new outputs', (t) => {
  const directory = fixture(t);
  writeFileSync(join(directory, 'app-release-unsigned.apk'), 'stale synthetic output');
  assert.throws(() => releaseApks(directory));
});

test('rejects an APK whose filename and ABI filter disagree', (t) => {
  const directory = fixture(t, (metadata) => {
    metadata.elements[0].filters[0].value = 'arm64-v8a';
  });
  assert.throws(() => releaseApks(directory));
});

test('rejects debug or wrong-application output metadata', (t) => {
  assert.throws(() =>
    releaseApks(
      fixture(t, (metadata) => {
        metadata.variantName = 'debug';
      }),
    ),
  );
  assert.throws(() =>
    releaseApks(
      fixture(t, (metadata) => {
        metadata.applicationId = 'other.app';
      }),
    ),
  );
});

test('compares both ABI outputs and rejects a difference in either one', (t) => {
  const first = fixture(t);
  const second = fixture(t);
  compareApks(first, second);
  for (const abi of phoneAbis) {
    const file = join(second, `app-${abi}-release-unsigned.apk`);
    const original = readFileSync(file);
    writeFileSync(file, 'different synthetic output');
    assert.throws(() => compareApks(first, second), /differs between clean builds/);
    writeFileSync(file, original);
  }
});

function contents() {
  const font = Buffer.from('synthetic font bytes');
  const notice = Buffer.from('synthetic licence bytes');
  const files = new Map([
    ['res/font/demo.ttf', font],
    ['assets/licenses/demo.txt', notice],
    ...['libappmodules.so', 'libreactnative.so', 'libhermesvm.so', 'libsqlcipher.so'].map((name) => [
      `lib/arm64-v8a/${name}`,
      Buffer.from('synthetic native library'),
    ]),
  ]);
  return {
    files,
    verify: () =>
      verifyContents(
        [...files.keys()],
        (name) => files.get(name),
        'arm64-v8a',
        [createHash('sha256').update(font).digest('hex')],
        new Map([['demo.txt', notice]]),
      ),
  };
}

test('checks font bytes and notices even when resource paths are shortened', () => {
  const { files, verify } = contents();
  const bytes = files.get('res/font/demo.ttf');
  files.delete('res/font/demo.ttf');
  files.set('res/a.ttf', bytes);
  verify();
});

test('rejects a native library for the wrong processor', () => {
  const { files, verify } = contents();
  files.set('lib/armeabi-v7a/libextra.so', Buffer.from('synthetic library'));
  assert.throws(verify);
});

test('rejects removal of a required JNI library', () => {
  const { files, verify } = contents();
  files.delete('lib/arm64-v8a/libsqlcipher.so');
  assert.throws(verify, /Missing libsqlcipher/);
});

test('rejects a removed or changed font', () => {
  const { files, verify } = contents();
  files.set('res/font/demo.ttf', Buffer.from('changed synthetic font'));
  assert.throws(verify, /Every bundled font/);
  files.delete('res/font/demo.ttf');
  assert.throws(verify, /Every bundled font/);
});

test('rejects a removed or changed licence notice', () => {
  const { files, verify } = contents();
  files.set('assets/licenses/demo.txt', Buffer.from('changed synthetic notice'));
  assert.throws(verify, /Changed demo/);
  files.delete('assets/licenses/demo.txt');
  assert.throws(verify, /Missing demo/);
});
