// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC web app's fixed bundle (#250, R-6.6-01, R-6.6-07, answer 501): the
// phone app's code bundled once with esbuild into dist/, with the app's own
// fonts and drawn images, its page, manifest and offline worker, and the
// licences. Nothing is loaded from anywhere else. The version is the Android
// app's. build.json, written last, gives each file's SHA-256 and the build's
// checksum: the SHA-256 of those lines as sha256sum writes them, sorted by
// name, so anyone can recompute it with standard tools. The app shows the
// checksum, and the worker checks every file against its line. The same
// sources give the same checksum. notes.json, among the files, holds the
// version and version code, so the checksum covers them, and the release's
// short notes in each language (answer 517), from release-notes.json when
// it is written for this version, else none.

import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { vectorToSvg } from './drawables.ts';
import { checksum, fileHashes } from './hashes.ts';
import { notices } from './licences.ts';
import { resolvePlugin } from './resolve.ts';

const root = new URL('../', import.meta.url);
const repository = new URL('../../', root);
const output = new URL('dist/', root);
const fontFolder = new URL('apps/android/android/app/src/main/res/font/', repository);
const drawables = new URL('apps/android/android/app/src/main/res/drawable/', repository);
const licences = new URL('apps/android/android/app/src/main/assets/licenses/', repository);

/**
 * Each font alias of the phone app (src/design/fonts.ts), its file and its
 * weight, and for Naskh the Noto Sans file of the same weight: Naskh has no
 * Latin letters, which Android draws in its own sans-serif, so the browser
 * draws them in Noto Sans rather than its serif.
 */
const FONTS: ReadonlyArray<readonly [string, string, number, string?]> = [
  ['Aref Ruqaa', 'aref_ruqaa_bold', 700],
  ['Noto Naskh Arabic', 'noto_naskh_arabic_regular', 400, 'noto_sans_regular'],
  ['Noto Naskh Arabic Medium', 'noto_naskh_arabic_medium', 500, 'noto_sans_medium'],
  ['Noto Naskh Arabic SemiBold', 'noto_naskh_arabic_semibold', 600, 'noto_sans_semibold'],
  ['Noto Naskh Arabic Bold', 'noto_naskh_arabic_bold', 700, 'noto_sans_bold'],
  ['Noto Sans', 'noto_sans_regular', 400],
  ['Noto Sans Medium', 'noto_sans_medium', 500],
  ['Noto Sans SemiBold', 'noto_sans_semibold', 600],
  ['Noto Sans Bold', 'noto_sans_bold', 700],
];

const HEAD =
  '/* SPDX-FileCopyrightText: 2026 The Minhajna contributors */\n/* SPDX-License-Identifier: AGPL-3.0-or-later */\n';

/** The Android app's version name and code, from its Gradle build. */
export function androidVersion(gradle: string): { version: string; versionCode: number } {
  const name = /versionName "([^"]+)"/u.exec(gradle)?.[1];
  const code = /versionCode (\d+)/u.exec(gradle)?.[1];
  if (name === undefined || code === undefined) throw new Error('No version in the Android build');
  return { version: name, versionCode: Number(code) };
}

/** The languages of the release notes, the interface's. */
export const NOTE_LANGUAGES = ['ar', 'fr', 'en'] as const;

export type ReleaseNotes = { version: string; versionCode: number } & Record<(typeof NOTE_LANGUAGES)[number], string[]>;

/**
 * The build's version and the release's notes for it: up to five short
 * lines in each language, as many in each, or none when they were written
 * for another version. Malformed notes stop the build.
 */
export function releaseNotes(text: string, version: string, versionCode: number): ReleaseNotes {
  const notes = JSON.parse(text) as Partial<Record<string, unknown>>;
  const none = { version, versionCode, ar: [], fr: [], en: [] };
  if (notes.version !== version) return none;
  const lines = NOTE_LANGUAGES.map((language) => notes[language]);
  const fine = (list: unknown): list is string[] =>
    Array.isArray(list) && list.length <= 5 && list.every((line) => typeof line === 'string' && line.length <= 160);
  if (!lines.every(fine) || new Set(lines.map((list) => list.length)).size !== 1) {
    throw new Error('release-notes.json needs at most five lines of 160 characters, as many lines in each language');
  }
  const [ar, fr, en] = lines as [string[], string[], string[]];
  return { version, versionCode, ar, fr, en };
}

async function main() {
  const { version, versionCode } = androidVersion(
    readFileSync(new URL('apps/android/android/app/build.gradle', repository), 'utf8'),
  );
  rmSync(output, { recursive: true, force: true });
  mkdirSync(new URL('fonts/', output), { recursive: true });
  mkdirSync(new URL('drawables/', output), { recursive: true });
  const result = await build({
    absWorkingDir: fileURLToPath(root),
    entryPoints: [fileURLToPath(new URL('src/index.tsx', root))],
    outfile: fileURLToPath(new URL('app.js', output)),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['chrome120', 'edge120', 'firefox120'],
    minify: true,
    legalComments: 'external',
    jsx: 'automatic',
    loader: { '.js': 'jsx', '.png': 'file' },
    assetNames: 'images/[name]-[hash]',
    resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
    define: {
      __DEV__: 'false',
      'process.env.NODE_ENV': '"production"',
      global: 'globalThis',
      MINHAJNA_WEB_VERSION: JSON.stringify(version),
    },
    plugins: [resolvePlugin],
    logLevel: 'warning',
    metafile: true,
  });
  if (result.errors.length > 0) process.exit(1);
  const face = (family: string, file: string, weight: number) =>
    `@font-face { font-family: '${family}'; src: url('./fonts/${file}.ttf') format('truetype'); font-weight: ${weight}; font-display: block; }`;
  const faces = FONTS.flatMap(([family, file, weight, latin]) => {
    copyFileSync(new URL(`${file}.ttf`, fontFolder), new URL(`fonts/${file}.ttf`, output));
    return latin === undefined
      ? [face(family, file, weight)]
      : [face(family, latin, weight), face(family, file, weight)];
  });
  for (const name of readdirSync(drawables).filter((file) => file.endsWith('.xml'))) {
    const svg = vectorToSvg(readFileSync(new URL(name, drawables), 'utf8'));
    if (svg !== null) writeFileSync(new URL(`drawables/${name.replace(/\.xml$/u, '.svg')}`, output), svg);
  }
  writeFileSync(new URL('fonts.css', output), `${HEAD}${faces.join('\n')}\n`);
  const kept = notices(result.metafile, fileURLToPath(root), fileURLToPath(licences), ['data', 'fonts']);
  writeFileSync(new URL('licences.json', output), `${JSON.stringify({ version, notices: kept })}\n`);
  for (const name of readdirSync(new URL('public/', root)))
    copyFileSync(new URL(`public/${name}`, root), new URL(name, output));
  copyFileSync(new URL('docs/design/system/logo/minhajna-icon.svg', repository), new URL('icon.svg', output));
  copyFileSync(new URL('LICENSES/AGPL-3.0-or-later.txt', repository), new URL('LICENSE.txt', output));
  copyFileSync(new URL('LICENSES/CC-BY-SA-4.0.txt', repository), new URL('DATA-LICENSE.txt', output));
  const notes = releaseNotes(readFileSync(new URL('release-notes.json', root), 'utf8'), version, versionCode);
  writeFileSync(new URL('notes.json', output), `${JSON.stringify(notes)}\n`);
  const files = fileHashes(
    output,
    readdirSync(output, { recursive: true, encoding: 'utf8' })
      .map((name) => name.replaceAll('\\', '/'))
      .filter((name) => /\.[a-z]+$/u.test(name)),
  );
  const sha256 = checksum(files);
  writeFileSync(
    new URL('build.json', output),
    `${JSON.stringify({ format: 2, version, versionCode, sha256, files })}\n`,
  );
  process.stdout.write(`Minhajna ${version} for the web: ${fileURLToPath(output)}\nSHA-256: ${sha256}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
