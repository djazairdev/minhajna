// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the network guard does not cover, the app's code never uses (#559,
// answer 570): no image from a remote address written in the code, which React
// Native loads natively, as no code builds an image's address; no React Native
// networking or socket module reached around the globals; no HTTP or socket of
// Android's own in the app's Kotlin; and no WebView that may load from the
// network: each one the code makes blocks network loads. The phone's code, the
// PC's and the app's Kotlin are read as text; nothing runs or connects.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const APP = join(__dirname, '..');

function files(folder: string, ending: RegExp): string[] {
  return readdirSync(folder, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && ending.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

const SCRIPT = /\.(?:[cm]?js|tsx?)$/u;
const scripts = [
  ...files(join(APP, 'src'), SCRIPT),
  ...files(join(APP, '..', 'web', 'src'), SCRIPT),
  join(APP, 'App.tsx'),
  join(APP, 'index.js'),
];
const kotlin = files(join(APP, 'android', 'app', 'src'), /\.kt$/u);

const AROUND_THE_GUARD = [
  /\buri:\s*['"`]\s*(?:https?|wss?|ftp):/iu,
  /\bImage\.(?:prefetch|getSize|getSizeWithHeaders|queryCache)\b/u,
  /react-native\/Libraries\/(?:Network|WebSocket)\b/u,
  /\bNativeModules\.(?:Networking|WebSocketModule)\b/u,
  /\b(?:TurboModuleRegistry|NativeModules)\b[^;]*['"](?:Networking|WebSocketModule)['"]/u,
];
const ANDROID_NETWORK = [
  /\b(?:openConnection|HttpURLConnection|HttpsURLConnection)\b/u,
  /\b(?:OkHttpClient|SSLSocket|DownloadManager)\b|java\.net\.Socket\b/u,
];

function hits(paths: readonly string[], patterns: readonly RegExp[]): string[] {
  return paths.flatMap((path) => {
    const text = readFileSync(path, 'utf8');
    return patterns.filter((pattern) => pattern.test(text)).map((pattern) => `${relative(APP, path)}: ${pattern}`);
  });
}

test('the scan reads the phone’s code, the PC’s and the app’s Kotlin', () => {
  expect(scripts.length).toBeGreaterThan(300);
  expect(scripts.some((path) => path.includes(join('web', 'src')))).toBe(true);
  expect(kotlin.length).toBeGreaterThan(30);
});

test('no script reaches the network around the guarded globals', () => {
  expect(hits(scripts, AROUND_THE_GUARD)).toEqual([]);
});

test('no Kotlin of the app opens a connection, and every WebView it makes blocks network loads', () => {
  expect(hits(kotlin, ANDROID_NETWORK)).toEqual([]);
  const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;
  const views = kotlin.map((path) => readFileSync(path, 'utf8')).filter((text) => /\bWebView\(/u.test(text));
  expect(views.length).toBeGreaterThan(0);
  for (const text of views) {
    expect(count(text, /\bblockNetworkLoads = true\b/gu)).toBeGreaterThanOrEqual(count(text, /\bWebView\(/gu));
  }
});

test('the scan finds each way around the guard', () => {
  const samples = [
    "<Image source={{ uri: 'https://example.com/a.png' }} />",
    'Image.prefetch(address)',
    "import WebSocket from 'react-native/Libraries/WebSocket/WebSocket';",
    'NativeModules.Networking.sendRequest()',
    "TurboModuleRegistry.get('Networking')",
  ];
  for (const [at, sample] of samples.entries()) expect(AROUND_THE_GUARD[at].test(sample)).toBe(true);
  for (const [at, sample] of ['URL(address).openConnection()', 'val client = OkHttpClient()'].entries()) {
    expect(ANDROID_NETWORK[at].test(sample)).toBe(true);
  }
  expect(AROUND_THE_GUARD.some((pattern) => pattern.test("source={{ uri: 'chalk_dust' }}"))).toBe(false);
});
