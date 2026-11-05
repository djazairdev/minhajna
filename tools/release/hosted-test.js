// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Whether a hosted test may run (answer 755, docs/demo-host.md): `node
// tools/release/hosted-test.js <ref> <file>`, the file holding what `git
// ls-remote --tags --refs origin` lists. It must start from main or a release
// branch, and no release with a demo server may be tagged yet, beta or not:
// teachers' apps would then be using the server it replaces. It prints the
// server's version as a `version=` line for GITHUB_OUTPUT, or says why not and
// exits 1. Only Node's built-ins are used.

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { compareVersions, taggedVersions } from './plan.js';

/** The first release that holds a demo server, its first beta included. */
const FIRST_SERVER = '0.7.0-beta.0';

/** Why a hosted test may not run, or undefined when it may. */
export function refusal(ref, listing) {
  if (ref !== 'refs/heads/main' && !ref.startsWith('refs/heads/release/')) {
    return `${ref} is neither main nor a release branch`;
  }
  const served = taggedVersions(listing).filter((version) => compareVersions(version, FIRST_SERVER) >= 0);
  if (served.length > 0) return `v${served[0]} is tagged, so teachers' apps use the demo server now`;
  return undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const why = refusal(process.argv[2] ?? '', readFileSync(process.argv[3] ?? '', 'utf8'));
  if (why !== undefined) {
    process.stderr.write(`::error title=Hosted test::${why} (docs/demo-host.md)\n`);
    process.exit(1);
  }
  const server = new URL('../../apps/server/package.json', import.meta.url);
  process.stdout.write(`version=${JSON.parse(readFileSync(server, 'utf8')).version}\n`);
}
