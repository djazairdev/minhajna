// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC web app as one file for its host and the release (answer 528):
// dist/ packed into release/minhajna-web-<version>.zip. Every file is
// checked against build.json first, so a stale or changed dist/ is never
// packed. The ZIP stores the files uncompressed, in name order, all dated
// 1 January 1980, with nothing else in it, so the same build always packs
// to the same bytes, on any system, and the release can publish one SHA-256
// for it. Any unzip tool opens it.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { checksum, fileHashes } from './hashes.ts';

type Built = { version: string; sha256: string; files: Record<string, string> };

/** DOS date of 1 January 1980, the earliest a ZIP can hold. */
const DAY = (1 << 5) | 1;

/** A ZIP of the build in `folder`, refused when any file differs from build.json. */
export function packBuild(folder: URL): { version: string; zip: Buffer } {
  const built = JSON.parse(readFileSync(new URL('build.json', folder), 'utf8')) as Built;
  const names = Object.keys(built.files);
  const found = fileHashes(folder, names);
  const changed = names.filter((name) => found[name] !== built.files[name]);
  if (changed.length > 0 || checksum(built.files) !== built.sha256) {
    throw new Error(`dist/ does not match build.json: ${changed.join(', ') || 'checksum'}`);
  }
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const name of [...names, 'build.json'].sort()) {
    const data = readFileSync(new URL(name, folder));
    const path = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(10, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(DAY, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(path.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(10, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(DAY, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(path.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, path, data);
    centrals.push(central, path);
    offset += local.length + path.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(names.length + 1, 8);
  end.writeUInt16LE(names.length + 1, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return { version: built.version, zip: Buffer.concat([...locals, directory, end]) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { version, zip } = packBuild(new URL('../dist/', import.meta.url));
  const folder = new URL('../release/', import.meta.url);
  mkdirSync(folder, { recursive: true });
  const file = new URL(`minhajna-web-${version}.zip`, folder);
  writeFileSync(file, zip);
  const sha256 = createHash('sha256').update(zip).digest('hex');
  process.stdout.write(`${sha256}  minhajna-web-${version}.zip\n${fileURLToPath(file)}\n`);
}
