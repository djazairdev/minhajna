// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard app's fixed bundle (answer 855), built as the PC web app's is,
// by the web app's scripts/bundle.ts with this app's own esbuild and locked
// packages: the dashboard in dist/, with the phone app's fonts and drawn
// images, its page and the licences, and build.json with each file's SHA-256
// and the build's checksum. There is no offline worker, update offer or PDF
// engine, so no notes.json.

import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { buildApp } from '../../web/scripts/bundle.ts';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildApp({ root: new URL('../', import.meta.url), esbuild: build, name: 'Minhajna dashboard', notes: false });
}
