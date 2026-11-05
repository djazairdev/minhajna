// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The image's notices (tools/notices.ts), on a made-up node_modules folder:
// each package once by name and version, scoped and nested ones too, with the
// licence it declares and the files it ships, what the image adds first, and
// what ships no licence file said plainly.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { notices } from '../tools/notices.js';

const parent = mkdtempSync(join(tmpdir(), 'notices-'));
const modules = join(parent, 'node_modules');
after(() => rmSync(parent, { recursive: true, force: true }));

function made(path: string, license: unknown, files: Record<string, string> = {}, more: object = {}): void {
  const folder = join(modules, path);
  mkdirSync(folder, { recursive: true });
  const name = path.split('node_modules/').at(-1);
  writeFileSync(join(folder, 'package.json'), JSON.stringify({ name, version: '1.2.3', license, ...more }));
  for (const [file, text] of Object.entries(files)) writeFileSync(join(folder, file), text);
}

made('zeta-made-up', 'MIT', { LICENSE: 'Made-up MIT text\r\nwith a second line\n', 'index.js': 'not a notice' });
made('alpha-made-up', 'Apache-2.0', {
  'LICENSE.txt': 'Made-up Apache text',
  NOTICE: 'Made-up notice text',
  'CopyrightNotice.txt': 'Made-up copyright notice',
  'THIRD-PARTY-NOTICES.txt': 'Made-up third parties',
});
made('@scope-made-up/inner', 'ISC', { 'license.md': 'Made-up ISC text' });
made('bare-made-up', 'BSD-3-Clause');
made('no-licence-made-up', undefined);
made('object-made-up', { type: 'MIT', url: 'https://licence.example' }, { LICENSE: 'Made-up object text' });
made('old-made-up', undefined, { LICENSE: 'Made-up old text' }, { licenses: [{ type: 'MIT' }, { type: 'Zlib' }] });
made('zeta-made-up/node_modules/nested-made-up', 'MIT', { LICENCE: 'Made-up nested text' });
made('zeta-made-up/node_modules/alpha-made-up', 'Apache-2.0', { 'LICENSE.txt': 'Made-up Apache text' });
mkdirSync(join(modules, '.bin'));

describe('the image’s notices', () => {
  const written = notices(modules, 'What the image adds\n');

  it('starts with what the image adds, and ends with a new line', () => {
    assert.ok(written.startsWith('What the image adds\n\n---'));
    assert.ok(written.endsWith('\n'));
  });

  it('lists every package once, in order, with what it declares and ships', () => {
    const titles = [...written.matchAll(/^(\S+ 1\.2\.3): (.+)$/gmu)].map((match) => [match[1], match[2]]);
    assert.deepEqual(titles, [
      ['@scope-made-up/inner 1.2.3', 'ISC'],
      ['alpha-made-up 1.2.3', 'Apache-2.0'],
      ['bare-made-up 1.2.3', 'BSD-3-Clause'],
      ['nested-made-up 1.2.3', 'MIT'],
      ['no-licence-made-up 1.2.3', 'no licence declared'],
      ['object-made-up 1.2.3', 'MIT'],
      ['old-made-up 1.2.3', 'MIT OR Zlib'],
      ['zeta-made-up 1.2.3', 'MIT'],
    ]);
  });

  it('carries each NOTICE and licence file, with its line ends made plain, and nothing else', () => {
    const shipped = [
      'Made-up Apache text',
      'Made-up notice text',
      'Made-up copyright notice',
      'Made-up third parties',
      'Made-up ISC text',
      'Made-up nested text',
    ];
    for (const text of shipped) {
      assert.ok(written.includes(text), text);
    }
    assert.ok(written.includes('Made-up MIT text\nwith a second line'));
    assert.equal(written.includes('not a notice'), false);
  });

  it('says plainly when a package ships no licence file', () => {
    assert.ok(written.includes('bare-made-up 1.2.3: BSD-3-Clause\n\nIt ships no licence file.'));
    assert.ok(written.includes('no-licence-made-up 1.2.3: no licence declared\n\nIt ships no licence file.'));
  });
});
