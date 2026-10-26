// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A crash kept on the web is read back by the phone app's own crash report
// (#249, #250): the app's crash-report.ts and the web module, bundled as the
// web build bundles them, with a made-up version built in; the report the
// module kept is offered with its type, frames, last screens and version,
// and the browser's own name left out.

import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { resolvePlugin } from '../scripts/resolve.ts';

const kept = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  },
});

const out = join(tmpdir(), `minhajna-crash-${process.pid}.mjs`);
after(() => rmSync(out, { force: true }));

describe('a crash kept on the web', () => {
  it('is offered by the phone app’s own crash report', async () => {
    const help = fileURLToPath(new URL('../../android/src/help/', import.meta.url));
    await build({
      stdin: {
        contents: `export * from './crash-report.ts'; export { default as Crash } from '../native/NativeMinhajnaCrash';`,
        resolveDir: help,
        loader: 'ts',
      },
      outfile: out,
      bundle: true,
      format: 'esm',
      platform: 'node',
      jsx: 'automatic',
      loader: { '.js': 'jsx', '.png': 'empty' },
      resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
      define: { __DEV__: 'false', MINHAJNA_WEB_VERSION: '"9.8.7"' },
      plugins: [resolvePlugin],
      logLevel: 'error',
    });
    const { Crash, ...report } = (await import(out)) as typeof import('../../android/src/help/crash-report.ts') & {
      Crash: typeof import('../src/native/Crash.ts').default;
    };
    Crash.setReports(true);
    Crash.steps(['Welcome', ...Array.from({ length: 11 }, (_, index) => `Screen${index}`)]);
    assert.equal(Crash.keep('TypeError', ['onPress 1:2']), true);
    assert.deepEqual(report.offeredCrash(), {
      type: 'TypeError',
      frames: ['onPress 1:2'],
      steps: Array.from({ length: 10 }, (_, index) => `Screen${index + 1}`),
      version: '9.8.7',
      android: '',
    });
  });
});
