// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Existing TypeScript compiler only: no bundler, CDN or runtime dependency.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
rmSync(output, { recursive: true, force: true });
execFileSync(
  process.execPath,
  [
    fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', root)),
    '-p',
    fileURLToPath(new URL('tsconfig.build.json', root)),
  ],
  { stdio: 'inherit' },
);
mkdirSync(output, { recursive: true });
for (const name of readdirSync(new URL('public/', root)))
  copyFileSync(new URL(`public/${name}`, root), new URL(name, output));
copyFileSync(new URL('../../data/dz/profile.json', root), new URL('profile.json', output));
copyFileSync(new URL('../../data/dz/calendar-2026-2027.json', root), new URL('calendar.json', output));
copyFileSync(new URL('../../LICENSES/AGPL-3.0-or-later.txt', root), new URL('LICENSE.txt', output));
copyFileSync(new URL('../../LICENSES/CC-BY-SA-4.0.txt', root), new URL('DATA-LICENSE.txt', output));
const files = readdirSync(output, { recursive: true, encoding: 'utf8' })
  .filter((name) => /\.(js|json|html|css|svg|webmanifest|txt)$/.test(name))
  .map((name) => name.replaceAll('\\', '/'))
  .sort();
const hash = createHash('sha256');
for (const name of files) hash.update(name).update(readFileSync(new URL(name, output)));
const version = hash.digest('hex');
const assets = ['./', ...files.map((name) => `./${name.replaceAll('\\', '/')}`), './assets.js', './build.json'];
writeFileSync(
  new URL('assets.js', output),
  `// SPDX-FileCopyrightText: 2026 The Minhajna contributors\n// SPDX-License-Identifier: AGPL-3.0-or-later\nexport const version = ${JSON.stringify(version)};\nexport const assets = ${JSON.stringify(assets)};\n`,
);
writeFileSync(new URL('build.json', output), JSON.stringify({ format: 1, sha256: version }));
process.stdout.write(`Static diagnostic built: ${fileURLToPath(output)}\nSHA-256 source/assets: ${version}\n`);
