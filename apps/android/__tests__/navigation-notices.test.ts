// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="node" />

// The two emitted files were rebuilt from the immutable upstream 0.0.9 commit
// recorded in the audit. They also match the previously locked 0.0.8 bytes.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import manifest from '../package.json';

const assets = join(__dirname, '../android/app/src/main/assets/licenses');
const dependency = join(__dirname, '../node_modules/standard-navigation');
const files = readdirSync(assets).filter((name) => name.startsWith('navigation-'));
const notices = files.map((name) => readFileSync(join(assets, name), 'utf8')).join('\n');

test('pins the source-verifiable replacement with byte-identical runtime and types', () => {
  expect(manifest.overrides['standard-navigation']).toBe('0.0.9');
  const packageJson = JSON.parse(readFileSync(join(dependency, 'package.json'), 'utf8')) as { version: string };
  expect(packageJson.version).toBe('0.0.9');
  for (const [path, expected] of [
    ['lib/src/index.js', '770d8b338177d7f92f484cab466c973455f30a18eb69fe5ce14996996b67cf9e'],
    ['lib/src/index.d.ts', '0c2e0ce5a7faeafb27b23e99eb5408b6a97ba9dfdcc76e7f73b0120a40bcdbba'],
  ]) {
    expect(
      createHash('sha256')
        .update(readFileSync(join(dependency, path)))
        .digest('hex'),
    ).toBe(expected);
  }
  expect(notices).toContain(readFileSync(join(dependency, 'LICENSE'), 'utf8').trim());
  expect(notices).toContain('4ebc8b3229da88cb6ade1ff4484491915bedd7cc');
});

test('keeps every navigation-package notice and the native Apache licence in small files', () => {
  expect(files.sort()).toEqual(['navigation-android.txt', 'navigation-frameworks.txt', 'navigation-helpers.txt']);
  const names = [
    '@react-navigation/bottom-tabs',
    '@react-navigation/core',
    '@react-navigation/elements',
    '@react-navigation/native',
    '@react-navigation/native-stack',
    '@react-navigation/routers',
    'react-is',
    'use-sync-external-store',
    'color',
    'color-string',
    'fast-deep-equal',
    'nanoid',
    'react-freeze',
    'react-native-screens',
    'sf-symbols-typescript',
    'simple-swizzle',
    'is-arrayish',
    'standard-navigation',
    'use-latest-callback',
    'warn-once',
  ];
  const urls = (notices.match(/^https:\/\/registry\.npmjs\.org\/\S+/gm) ?? []).map(decodeURIComponent);
  for (const name of names)
    expect(urls.some((url) => url.startsWith(`https://registry.npmjs.org/${name}/`))).toBe(true);
  expect(notices).toContain(readFileSync(join(__dirname, '../../../LICENSES/Apache-2.0.txt'), 'utf8').trim());
  for (const file of files) {
    expect(readFileSync(join(assets, file), 'utf8').trimEnd().split('\n').length).toBeLessThanOrEqual(300);
  }
});
