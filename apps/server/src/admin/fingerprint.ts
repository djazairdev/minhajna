// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The server's fingerprint (#618, answer 655): the SHA-256 of its own built
// code, every file under dist/src, which the image carries as it was built.
// For each file, in the order of the paths' code units: its path from
// dist/src, with / between folders, a newline, the lowercase hex SHA-256 of
// its bytes, and a newline; the fingerprint is the lowercase hex SHA-256 of
// all of that. A build of the same source with the same lockfiles gives the
// same fingerprint, so anyone can rebuild the published source and compare
// (`npm run fingerprint`). It is worked out once, as the server loads, so it
// describes the code it runs, and is null when that code cannot be read or
// holds anything but folders and plain files.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The built code's folder: dist/src, one above this file's. */
export const BUILT = new URL('../', import.meta.url);

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

/** The fingerprint of the code in a folder; throws on a link or anything but folders and plain files. */
export function fingerprintOf(folder: URL): string {
  const root = fileURLToPath(folder);
  const files = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => {
      if (entry.isFile()) return true;
      if (entry.isDirectory()) return false;
      throw new Error(`not a plain file or folder: ${entry.name}`);
    })
    .map((entry) => {
      const full = join(entry.parentPath, entry.name);
      return { path: relative(root, full).split(sep).join('/'), full };
    })
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return sha256(files.map((file) => `${file.path}\n${sha256(readFileSync(file.full))}\n`).join(''));
}

/** The fingerprint of the code in a folder, or null when it cannot be worked out. */
export function readFingerprint(folder: URL): string | null {
  try {
    return fingerprintOf(folder);
  } catch {
    return null;
  }
}

/** The running server's fingerprint, worked out as it loaded. */
export const FINGERPRINT: string | null = readFingerprint(BUILT);
