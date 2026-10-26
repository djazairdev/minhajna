// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How the web build finds the phone app's modules (#250, answer 499). The
// app's own code is bundled as it is; only its imports are redirected:
// React Native to React Native Web, each native module to its web version in
// src/native, the core and the reference data to their folders, and every
// package to this app's own locked install, so one React runs. The core's
// test support never enters the bundle. esbuild runs the filters in Go, so
// they carry no flags.

import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'esbuild';

const web = fileURLToPath(new URL('../', import.meta.url));
const repository = fileURLToPath(new URL('../../../', import.meta.url));

/** A native module's spec in the phone app, such as `../native/NativeMinhajnaStorage`. */
const NATIVE = /(?:^|\/)NativeMinhajna([A-Z][A-Za-z]+)$/;

/** The web version of the native module `name`, which the build refuses to do without. */
export function webModule(name: string): string {
  const path = `${web}src/native/${name}.ts`;
  if (!existsSync(path)) throw new Error(`No web version of NativeMinhajna${name} in src/native`);
  return path;
}

export const resolvePlugin: Plugin = {
  name: 'minhajna-web',
  setup(build) {
    build.onResolve({ filter: /^react-native$/ }, () => ({ path: `${web}src/react-native.js` }));
    build.onResolve({ filter: NATIVE }, (args) => ({ path: webModule(NATIVE.exec(args.path)?.[1] ?? '') }));
    build.onResolve({ filter: /^@minhajna\/core\/test-support/ }, (args) => ({
      path: basename(args.path),
      namespace: 'test-support',
    }));
    build.onLoad({ filter: /.*/, namespace: 'test-support' }, () => ({
      contents: 'export const makeDemoYear = undefined, historyStoreTests = undefined;',
      loader: 'js',
    }));
    build.onResolve({ filter: /^@minhajna\/core$/ }, () => ({ path: `${repository}packages/core/src/index.ts` }));
    build.onResolve({ filter: /^@minhajna\/data\// }, (args) => ({
      path: `${repository}data/${args.path.slice('@minhajna/data/'.length)}`,
    }));
    build.onResolve({ filter: /^[^./]/ }, async (args) => {
      if (args.pluginData === 'web' || args.importer.startsWith(`${web}node_modules/`)) return undefined;
      const found = await build.resolve(args.path, { resolveDir: web, kind: args.kind, pluginData: 'web' });
      return found.errors.length > 0 ? { errors: found.errors } : found;
    });
  },
};
