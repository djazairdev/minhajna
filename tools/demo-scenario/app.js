// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The app's own session code for a demo scenario (#630, answer 722), so a
// scenario does what each role's screens do and finds what they would find.
// Node strips the types from apps/android as they load; these hooks give it
// what Metro gives the app: a relative path without its extension finds its .ts
// file, a JSON file loads as JSON, @minhajna/data is the repository's data
// folder, and react-native is a stand-in that holds no native module, whose
// calls answer nothing, since a session reaches the platform only through the
// kit and the store it is given. A file with a screen in it does not load. The
// hooks answer for nothing outside the app. A module's path is given from
// apps/android/src.

import { existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const APP = resolve(ROOT, 'apps/android');
const SOURCE = resolve(APP, 'src');
const NATIVE = [
  'const silent = new Proxy({}, { get: () => () => null });',
  'export const TurboModuleRegistry = { get: () => silent, getEnforcing: () => silent };',
  "export const Platform = { OS: 'android', select: (choices) => choices.android ?? choices.default };",
].join('\n');

const isFile = (path) => existsSync(path) && statSync(path).isFile();

/** The file a relative path from a file of the app names, or null when it names none. */
export function appFile(specifier, parent) {
  const base = resolve(dirname(fileURLToPath(parent)), specifier);
  return [base, `${base}.ts`].find(isFile) ?? null;
}

const inApp = (url) => url?.startsWith('file:') === true && fileURLToPath(url).startsWith(`${APP}/`);

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react-native') {
      return { url: `data:text/javascript,${encodeURIComponent(NATIVE)}`, shortCircuit: true };
    }
    if (specifier.startsWith('@minhajna/data/')) {
      const path = resolve(ROOT, 'data', specifier.slice('@minhajna/data/'.length));
      return { url: pathToFileURL(path).href, importAttributes: { type: 'json' }, shortCircuit: true };
    }
    const parent = context.parentURL;
    const file = specifier.startsWith('.') && inApp(parent) ? appFile(specifier, parent) : null;
    if (file === null) return next(specifier, context);
    const attributes = file.endsWith('.json') ? { importAttributes: { type: 'json' } } : {};
    return { url: pathToFileURL(file).href, ...attributes, shortCircuit: true };
  },
  load(url, context, next) {
    const typed = inApp(url) && fileURLToPath(url).endsWith('.ts');
    return next(url, typed ? { ...context, format: 'module-typescript' } : context);
  },
});

/** A module of the app, its path given from apps/android/src. */
export const appModule = (path) => import(pathToFileURL(resolve(SOURCE, path)).href);
