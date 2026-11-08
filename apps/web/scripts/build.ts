// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC web app's fixed bundle (#250, R-6.6-01, R-6.6-07, answer 501), as
// scripts/bundle.ts builds every browser app, with this app's own esbuild:
// the phone app's code in dist/, with its page, manifest and offline worker,
// whose update offer reads notes.json, and the PDF engine for a curator's
// source PDF, its worker and its assets with their notices (answer 743).

import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { buildApp, stopsBuild, TARGET } from './bundle.ts';
import { pdfAssets } from './pdf-assets.ts';

const root = new URL('../', import.meta.url);

/** Builds the PDF engine's worker into `output` and copies its assets, with their notices. */
async function pdfEngine(output: URL) {
  const pdf = await build({
    absWorkingDir: fileURLToPath(root),
    entryPoints: ['src/pdf/worker.ts'],
    outfile: fileURLToPath(new URL('pdf-worker.js', output)),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: TARGET,
    minify: true,
    legalComments: 'external',
    logLevel: 'warning',
  });
  if (stopsBuild(pdf)) throw new Error('The PDF worker build failed');
  return pdfAssets(root, output);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildApp({ root, esbuild: build, name: 'Minhajna for the web', notes: true, extra: pdfEngine });
}
