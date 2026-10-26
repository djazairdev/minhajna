// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { compareApks, phoneAbis, releaseApks, releaseOutputs, verifyContents } from './release-apks.js';

function fixture(t, change = () => {}) {
  const directory = mkdtempSync(join(tmpdir(), 'minhajna-apks-test-'));
  t.after(() => rmSync(directory, { recursive: true }));
  const elements = releaseOutputs.map(({ abi, digit }) => ({
    outputFile: `app-${abi}-release-unsigned.apk`,
    filters: abi === 'universal' ? [] : [{ filterType: 'ABI', value: abi }],
    versionCode: 100990 + digit,
  }));
  const metadata = { variantName: 'release', applicationId: 'dz.minhajna.preview', elements };
  change(metadata);
  writeFileSync(join(directory, 'output-metadata.json'), JSON.stringify(metadata));
  for (const { outputFile } of elements) writeFileSync(join(directory, outputFile), 'synthetic APK test bytes');
  return directory;
}

test('requires the universal and both phone APKs and agrees with Gradle output metadata', (t) => {
  const directory = fixture(t);
  assert.deepEqual(
    releaseApks(directory).map(({ abi, versionCode }) => [abi, versionCode]),
    [
      ['universal', 100990],
      ['armeabi-v7a', 100991],
      ['arm64-v8a', 100992],
    ],
  );
});

test('rejects an APK without its processor digit, or from another version', (t) => {
  assert.throws(
    () =>
      releaseApks(
        fixture(t, (metadata) => {
          metadata.elements[2].versionCode = 100990;
        }),
      ),
    /version code digit 2/,
  );
  assert.throws(
    () =>
      releaseApks(
        fixture(t, (metadata) => {
          metadata.elements[1].versionCode = 101001;
        }),
      ),
    /One version/,
  );
});

test('rejects a missing universal APK', (t) => {
  const directory = fixture(t);
  rmSync(join(directory, 'app-universal-release-unsigned.apk'));
  assert.throws(() => releaseApks(directory));
});

test('rejects a missing ABI instead of checking only the APK that exists', (t) => {
  const directory = fixture(t);
  rmSync(join(directory, 'app-arm64-v8a-release-unsigned.apk'));
  assert.throws(() => releaseApks(directory));
});

test('rejects a stale single APK from before the split beside the new outputs', (t) => {
  const directory = fixture(t);
  writeFileSync(join(directory, 'app-release-unsigned.apk'), 'stale synthetic output');
  assert.throws(() => releaseApks(directory));
});

test('rejects an APK whose filename and ABI filter disagree', (t) => {
  const directory = fixture(t, (metadata) => {
    metadata.elements[1].filters[0].value = 'arm64-v8a';
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

test('compares every APK and rejects a difference in any one', (t) => {
  const first = fixture(t);
  const second = fixture(t);
  compareApks(first, second);
  for (const { abi } of releaseOutputs) {
    const file = join(second, `app-${abi}-release-unsigned.apk`);
    const original = readFileSync(file);
    writeFileSync(file, 'different synthetic output');
    assert.throws(() => compareApks(first, second), /differs between clean builds/);
    writeFileSync(file, original);
  }
});

function contents(abis = ['arm64-v8a']) {
  const font = Buffer.from('synthetic font bytes');
  const notice = Buffer.from('synthetic licence bytes');
  const files = new Map([
    ['res/font/demo.ttf', font],
    ['assets/licenses/demo.txt', notice],
    ...abis.flatMap((abi) =>
      ['libappmodules.so', 'libreactnative.so', 'libhermesvm.so', 'libsqlcipher.so'].map((name) => [
        `lib/${abi}/${name}`,
        Buffer.from('synthetic native library'),
      ]),
    ),
  ]);
  return {
    files,
    verify: () =>
      verifyContents(
        [...files.keys()],
        (name) => files.get(name),
        abis,
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

test('requires both processors in the universal APK', () => {
  const { files, verify } = contents(phoneAbis);
  verify();
  files.delete('lib/armeabi-v7a/libhermesvm.so');
  assert.throws(verify, /Missing libhermesvm.so for armeabi-v7a/);
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

test('rejects a crash-report map inside an APK', () => {
  const { files, verify } = contents();
  files.set('assets/index.android.bundle.map', Buffer.from('synthetic map'));
  assert.throws(verify, /No crash-report map/);
  files.delete('assets/index.android.bundle.map');
  files.set('mapping.txt', Buffer.from('synthetic mapping'));
  assert.throws(verify, /No crash-report map/);
});
