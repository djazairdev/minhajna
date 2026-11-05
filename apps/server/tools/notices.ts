// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Writes the notices of what the server's image runs (#536): `node
// tools/notices.ts <node_modules> <what the image adds>`, to stdout. The
// image's build runs it once the development packages are gone, so it lists
// exactly what the image holds, and can't fall behind the lockfile: for each
// package, by name and version, its licence as it declares it, then its NOTICE
// and licence files as it ships them, as Apache-2.0 asks. A package that ships
// no licence file says so, with the licence it declares. What the image adds
// beside the packages (Node.js, PostgreSQL, WAL-G) comes first, from a file of
// its own. It uses Node's built-ins alone.

import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const TEXTS = /^(?:licen[cs]e|copying)(?:[.-].*)?$|notices?(?:\.(?:txt|md|rst))?$/iu;

/** A package folder's name, with its scope, under a node_modules folder. */
function packages(modules: string): string[] {
  const names: string[] = [];
  for (const entry of readdirSync(modules, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (!entry.name.startsWith('@')) names.push(entry.name);
    else for (const inner of readdirSync(join(modules, entry.name))) names.push(`${entry.name}/${inner}`);
  }
  return names.sort();
}

/** Every copy of a package in a node_modules folder, those nested inside others too. */
function folders(modules: string): string[] {
  return packages(modules).flatMap((name) => {
    const folder = join(modules, name);
    const inner = join(folder, 'node_modules');
    const nested = readdirSync(folder).includes('node_modules') ? folders(inner) : [];
    return [folder, ...nested];
  });
}

/** The licence a package declares, in any of the forms package.json has had. */
function declared(meta: { license?: unknown; licenses?: unknown }): string {
  const named = (one: unknown) => (typeof one === 'string' ? one : (one as { type?: unknown } | null)?.type);
  const all = [meta.license, ...(Array.isArray(meta.licenses) ? (meta.licenses as unknown[]) : [])].map(named);
  const names = all.filter((name): name is string => typeof name === 'string');
  return names.length > 0 ? names.join(' OR ') : 'no licence declared';
}

/** One package's notice. */
function notice(folder: string): { title: string; text: string } {
  const meta = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8')) as {
    name: string;
    version: string;
    license?: unknown;
    licenses?: unknown;
  };
  const files = readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && TEXTS.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const texts = files.map((file) => readFileSync(join(folder, file), 'utf8').replace(/\r\n/gu, '\n').trim());
  const title = `${meta.name} ${meta.version}`;
  return {
    title,
    text: [`${title}: ${declared(meta)}`, ...(texts.length > 0 ? texts : ['It ships no licence file.'])].join('\n\n'),
  };
}

/** The notices of every package in a node_modules folder, in order, after what the image adds. */
export function notices(modules: string, added: string): string {
  const seen = new Map<string, string>();
  for (const folder of folders(modules)) {
    const { title, text } = notice(folder);
    if (!seen.has(title)) seen.set(title, text);
  }
  const titles = [...seen.keys()].sort();
  const rule = `\n\n${'-'.repeat(72)}\n\n`;
  return `${[added.trim(), ...titles.map((title) => seen.get(title))].join(rule)}\n`;
}

if (process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const [modules, added] = process.argv.slice(2);
  if (modules === undefined || added === undefined) {
    process.stderr.write('usage: node tools/notices.ts <node_modules> <what the image adds>\n');
    process.exit(2);
  }
  process.stdout.write(notices(modules, readFileSync(added, 'utf8')));
}
