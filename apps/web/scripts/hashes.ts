// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The build's hashes (R-6.6-07), with Node.js alone, so that the host check
// runs from a checkout with nothing installed: each file's SHA-256, and the
// build's checksum over them, as build.json gives both.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Each file's SHA-256, by name in name order. */
export function fileHashes(folder: URL, names: readonly string[]): Record<string, string> {
  const sorted = [...names].sort();
  return Object.fromEntries(
    sorted.map((name) => [
      name,
      createHash('sha256')
        .update(readFileSync(new URL(name, folder)))
        .digest('hex'),
    ]),
  );
}

/** The build's checksum: the SHA-256 of `hash  name` lines, as sha256sum writes them, in name order. */
export function checksum(hashes: Readonly<Record<string, string>>): string {
  const lines = Object.keys(hashes)
    .sort()
    .map((name) => `${hashes[name] ?? ''}  ${name}\n`)
    .join('');
  return createHash('sha256').update(lines).digest('hex');
}
