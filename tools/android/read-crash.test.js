// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { decodeMappings, originalPosition, readCrash, reportFrames, retraced } from './read-crash.js';

// Two segments on the bundle's first line: column 0 comes from a.js 1:1,
// named render; column 5 on from b.js 2:3.
const MAP = { version: 3, sources: ['src/a.js', 'src/b.js'], names: ['render'], mappings: 'AAAAA,KCCE' };

const REPORT = [
  'Crash report in Minhajna',
  'Error: TypeError',
  'Where in the code: \u2068render 1:7, a.b.c:12, ?anon_0_ 1:9, d.e$f.run:-1, anonymous\u2069',
  'Version: \u20680.5.0\u2069 \u00b7 Android \u206815\u2069',
  'Last steps: \u2068Today \u203a Help\u2069',
].join('\n');

test('finds the frames in the order shared, without the bidi marks', () => {
  assert.deepEqual(reportFrames(REPORT), [
    { kind: 'script', name: 'render', line: 1, column: 7 },
    { kind: 'native', frame: 'a.b.c', line: 12 },
    { kind: 'script', name: '?anon_0_', line: 1, column: 9 },
    { kind: 'native', frame: 'd.e$f.run', line: -1 },
  ]);
});

test('finds a bundle position in the source map', () => {
  const lines = decodeMappings(MAP.mappings);
  assert.deepEqual(lines, [
    [
      [0, 0, 0, 0, 0],
      [5, 1, 1, 2],
    ],
  ]);
  assert.deepEqual(originalPosition(MAP, lines, 1, 0), { source: 'src/a.js', line: 1, column: 1, name: 'render' });
  assert.deepEqual(originalPosition(MAP, lines, 1, 9), { source: 'src/b.js', line: 2, column: 3, name: null });
  assert.equal(originalPosition(MAP, lines, 2, 0), null);
});

test('reads every frame, the native ones through retrace', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'minhajna-crash-test-'));
  t.after(() => rmSync(directory, { recursive: true }));
  const bundleMap = join(directory, 'bundle.map');
  writeFileSync(bundleMap, JSON.stringify(MAP));
  const asked = [];
  const retrace = (mapping, line) => {
    asked.push([mapping, line]);
    return `dz.Source.method(Source.kt:${asked.length})`;
  };
  assert.deepEqual(readCrash(REPORT, bundleMap, 'mapping.txt', retrace), [
    'render 1:7 -> src/b.js:2:3',
    'a.b.c:12 -> dz.Source.method(Source.kt:1)',
    '?anon_0_ 1:9 -> src/b.js:2:3',
    'd.e$f.run:-1 -> dz.Source.method(Source.kt:2)',
  ]);
  assert.deepEqual(asked, [
    ['mapping.txt', '    at a.b.c(SourceFile:12)'],
    ['mapping.txt', '    at d.e$f.run(SourceFile:-1)'],
  ]);
});

test('puts each frame retrace gives, and each candidate, on one line', () => {
  const out = [
    '    at dz.Keep.run(Keep.kt:61)',
    '    at dz.Keep.start(Keep.kt:12)',
    '    <OR> at dz.Keep.stop(Keep.kt:20)',
    '',
  ].join('\n');
  assert.equal(retraced(out), 'dz.Keep.run(Keep.kt:61) <- dz.Keep.start(Keep.kt:12) <- dz.Keep.stop(Keep.kt:20)');
});
