// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="node" />

// Every runtime dependency, and every package its JavaScript bundle pulls in,
// must ship its notice in the APK: `name version` and its full licence, for
// the version installed. The bundled packages come from the release bundle's
// source map; the ones whose npm archive has no licence file take their
// repository's, which is React Native's. Line endings compare as LF, as the
// repository stores them.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import manifest from '../package.json';

const assets = join(__dirname, '../android/app/src/main/assets/licenses');
const files = readdirSync(assets).filter((name) => name.endsWith('.txt'));
const notices = files.map((name) => readFileSync(join(assets, name), 'utf8')).join('\n');
const modules = join(__dirname, '../node_modules');

const version = (name: string) =>
  (JSON.parse(readFileSync(join(modules, name, 'package.json'), 'utf8')) as { version: string }).version;

const licence = (name: string) => {
  const file = readdirSync(join(modules, name)).find((entry) => /^licen[cs]e(\.(md|txt))?$/i.test(entry));
  if (file === undefined) throw new Error(`${name} has no licence file`);
  return readFileSync(join(modules, name, file), 'utf8')
    .replace(/\r\n/g, '\n')
    .trim();
};

const bundled = [
  '@babel/runtime',
  'base64-js',
  'color-convert',
  'color-name',
  'escape-string-regexp',
  'invariant',
  'memoize-one',
  'nullthrows',
  'promise',
  'regenerator-runtime',
  'scheduler',
  'stacktrace-parser',
  'whatwg-fetch',
];

const unlicensed = [
  '@react-native/asset-utils',
  '@react-native/js-polyfills',
  '@react-native/normalize-colors',
  '@react-native/virtualized-lists',
  'metro-runtime',
];

test.each(Object.keys(manifest.dependencies))('ships the notice of the dependency %s', (name) => {
  expect(notices).toContain(`${name} ${version(name)}\n`);
  expect(notices).toContain(licence(name));
});

test.each(bundled)('ships the notice of the bundled package %s', (name) => {
  expect(notices).toContain(`${name} ${version(name)}\n`);
  expect(notices).toContain(licence(name));
});

test.each(unlicensed)("ships %s under its repository's licence", (name) => {
  expect(readdirSync(join(modules, name)).some((entry) => /^licen[cs]e/i.test(entry))).toBe(false);
  expect(notices).toContain(`${name} ${version(name)}\n`);
  expect(notices).toContain(licence('react-native'));
});

test.each(files)('keeps %s within 300 lines', (file) => {
  expect(readFileSync(join(assets, file), 'utf8').trimEnd().split('\n').length).toBeLessThanOrEqual(300);
});
