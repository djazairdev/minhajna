// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The web bundle's licence notices (#250): one for every package esbuild put
// in the bundle, by name and version with its own licence file, and the
// phone app's notices for the reference data and the fonts, which the web
// app ships too. The app's licences screen reads them from licences.json. A
// package whose archive holds no licence file is credited with its
// repository's licence, as the phone app's notices do. A package's NOTICE
// file and the licences of the parts it embeds, in its `licenses` folder,
// follow its licence, as Apache-2.0 asks of ECharts (answer 574).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import type { Metafile } from 'esbuild';

/** A notice as the licences module gives it. */
export type Notice = { name: string; text: string };

const LICENCE = /^(?:licen[cs]e|copying)(?:\.(?:md|txt))?$/iu;
const NOTICE = /^notice(?:\.(?:md|txt))?$/iu;

/** Packages with no licence file: the package whose licence text is their repository's, and why. */
const BORROWED: Readonly<Record<string, { from: string; why: string }>> = {
  '@react-native/normalize-colors': {
    from: 'react',
    why: 'Its npm archive holds no LICENSE file. It is MIT, and its files point to the licence of facebook/react-native, which is the text below, the same as React’s.',
  },
};

/**
 * The folder of each package the bundle's inputs come from, each its own,
 * even a package nested in another's, under `base`, esbuild's working folder.
 */
export function bundledPackages(metafile: Metafile, base: string): string[] {
  const folders = new Set<string>();
  for (const input of Object.keys(metafile.inputs)) {
    const at = input.lastIndexOf('node_modules/') + 'node_modules/'.length;
    if (at < 'node_modules/'.length) continue;
    const parts = input.slice(at).split('/');
    const name = parts[0]?.startsWith('@') === true ? parts.slice(0, 2).join('/') : parts[0];
    if (name !== undefined) folders.add(`${base}${input.slice(0, at)}${name}/`);
  }
  return [...folders].sort();
}

/** The notice of the package in `folder` under `modules`: its name, version and licence file. */
export function packageNotice(folder: string, modules: string): Notice {
  const manifest = JSON.parse(readFileSync(`${folder}package.json`, 'utf8')) as { name: string; version: string };
  const file = readdirSync(folder).find((name) => LICENCE.test(name));
  const borrowed = BORROWED[manifest.name];
  if (file === undefined && borrowed === undefined) throw new Error(`No licence file in ${manifest.name}`);
  const text =
    file === undefined
      ? `${borrowed?.why ?? ''}\n\n${readFileSync(`${modules}${borrowed?.from ?? ''}/LICENSE`, 'utf8').trim()}`
      : readFileSync(`${folder}${file}`, 'utf8').trim();
  const more = [...extraNotices(folder)].map(([name, words]) => `\n\n${name}\n\n${words}`).join('');
  return {
    name: `${manifest.name} ${manifest.version}`,
    text: `${manifest.name} ${manifest.version}\n\n${text}${more}\n`,
  };
}

/** A package's NOTICE file, then each licence in its `licenses` folder, by file name. */
function* extraNotices(folder: string): Generator<[string, string]> {
  for (const name of readdirSync(folder)
    .filter((one) => NOTICE.test(one))
    .sort()) {
    yield [name, readFileSync(`${folder}${name}`, 'utf8').trim()];
  }
  if (!existsSync(`${folder}licenses/`)) return;
  for (const name of readdirSync(`${folder}licenses/`).sort()) {
    yield [`licenses/${name}`, readFileSync(`${folder}licenses/${name}`, 'utf8').trim()];
  }
}

/** Every notice: the phone app's own, for `kept` names, then each bundled package's, from esbuild's `base`. */
export function notices(metafile: Metafile, base: string, assets: string, kept: readonly string[]): Notice[] {
  const own = kept.map((name) => {
    const path = `${assets}${name}.txt`;
    if (!existsSync(path)) throw new Error(`No notice ${name}.txt`);
    return { name, text: readFileSync(path, 'utf8') };
  });
  return [...own, ...bundledPackages(metafile, base).map((folder) => packageNotice(folder, `${base}node_modules/`))];
}
