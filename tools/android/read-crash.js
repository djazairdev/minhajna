// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads a crash report a teacher sent back to the source (#460, R-1.5-07):
// its places in the code, in any of the app's languages, as the report
// shares them. A JavaScript frame, a function's name with its line and its
// offset in a release's Hermes bytecode bundle, is found in the release's
// source map; a debug build's columns would read one off. A Java or Kotlin
// frame, class.method:line as R8 renamed it, is passed to the Android SDK's
// retrace with the release's R8 mapping. The maps come from the release's
// files (release-maps.js); docs/contributing/crash-reports.md says how to
// use it. Only Node's built-ins and the SDK's retrace are used.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { log } from 'node:console';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const SCRIPT = /(?<![\w$.<>?[\]-])([A-Za-z_$<?][\w$.<>?[\]-]{0,59}) (\d{1,9}):(\d{1,9})/gu;
const NATIVE = /(?<![\w$.])((?:[A-Za-z_$][\w$]*\.)+[\w$<>-]+):(-?\d{1,9})(?![\d:])/gu;

/** The report's frames in order, without the bidi marks the report wraps them in. */
export function reportFrames(text) {
  const plain = text.replace(/[\u2066-\u2069\u200e\u200f]/gu, '');
  const script = [...plain.matchAll(SCRIPT)].map((match) => [
    match.index,
    { kind: 'script', name: match[1], line: Number(match[2]), column: Number(match[3]) },
  ]);
  const native = [...plain.matchAll(NATIVE)].map((match) => [
    match.index,
    { kind: 'native', frame: match[1], line: Number(match[2]) },
  ]);
  return [...script, ...native].sort((a, b) => a[0] - b[0]).map(([, frame]) => frame);
}

/** Each generated line's segments, decoded from the map's base64 VLQ. */
export function decodeMappings(mappings) {
  const lines = [];
  const state = [0, 0, 0, 0, 0];
  for (const text of mappings.split(';')) {
    state[0] = 0;
    const segments = [];
    for (const segment of text.split(',')) {
      if (segment === '') continue;
      const values = vlq(segment);
      values.forEach((value, index) => (state[index] += value));
      segments.push(values.length >= 4 ? [...state.slice(0, values.length >= 5 ? 5 : 4)] : [state[0]]);
    }
    lines.push(segments);
  }
  return lines;
}

function vlq(segment) {
  const values = [];
  let value = 0;
  let shift = 0;
  for (const char of segment) {
    const digit = BASE64.indexOf(char);
    assert.ok(digit !== -1, `Not a source map segment: ${segment}`);
    value += (digit & 31) << shift;
    if (digit & 32) shift += 5;
    else {
      values.push(value & 1 ? -(value >>> 1) : value >>> 1);
      value = 0;
      shift = 0;
    }
  }
  return values;
}

/** Where a bundle position comes from: the source, its 1-based line and column, and the name; null if unmapped. */
export function originalPosition(map, lines, line, column) {
  const segments = lines[line - 1] ?? [];
  let found = null;
  for (const segment of segments) {
    if (segment[0] > column) break;
    found = segment;
  }
  if (found === null || found.length < 4) return null;
  return {
    source: map.sources[found[1]],
    line: found[2] + 1,
    column: found[3] + 1,
    name: found.length === 5 ? map.names[found[4]] : null,
  };
}

/** Reads every frame: JavaScript ones from the source map, native ones through retrace. */
export function readCrash(text, bundleMap, mapping, retrace = sdkRetrace) {
  const frames = reportFrames(text);
  const map = JSON.parse(readFileSync(bundleMap, 'utf8'));
  const lines = decodeMappings(map.mappings);
  return frames.map((frame) => {
    if (frame.kind === 'native') return `${frame.frame}:${frame.line} -> ${retrace(mapping, stackLine(frame))}`;
    const place = originalPosition(map, lines, frame.line, frame.column);
    const where = place === null ? 'not in the source map' : `${place.source}:${place.line}:${place.column}`;
    return `${frame.name} ${frame.line}:${frame.column} -> ${where}`;
  });
}

function stackLine({ frame, line }) {
  return `    at ${frame}(SourceFile:${line})`;
}

/** The SDK's retrace of one frame; the frames R8 inlined into it, or other candidates, joined by " <- ". */
function sdkRetrace(mapping, stack) {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  assert.ok(sdk, 'Set ANDROID_HOME to the Android SDK, which has cmdline-tools/latest/bin/retrace');
  const folder = mkdtempSync(join(tmpdir(), 'minhajna-retrace-'));
  try {
    const file = join(folder, 'stack.txt');
    writeFileSync(file, `${stack}\n`);
    return retraced(execFileSync(join(sdk, 'cmdline-tools/latest/bin/retrace'), [mapping, file], { encoding: 'utf8' }));
  } finally {
    rmSync(folder, { recursive: true });
  }
}

/** Retrace's output for one frame on one line: each frame or candidate, without "at" or "<OR>", joined by " <- ". */
export function retraced(out) {
  return out
    .split('\n')
    .map((line) => line.trim().replace(/^(?:<OR>\s*)?at\s+/u, ''))
    .filter((line) => line !== '' && line !== '<OR>')
    .join(' <- ');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [report, bundleMap, mapping] = process.argv.slice(2);
  assert.ok(report && bundleMap && mapping, 'Usage: read-crash.js <report.txt> <bundle map> <R8 mapping>');
  for (const line of readCrash(readFileSync(report, 'utf8'), bundleMap, mapping)) log(line);
}
