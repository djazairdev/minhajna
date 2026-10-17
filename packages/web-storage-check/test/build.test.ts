// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Local artifact checks only. Browser installation and real IndexedDB are not mocked here.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);

function build(): string {
  execFileSync(process.execPath, [fileURLToPath(new URL('scripts/build.ts', root))]);
  const metadata = JSON.parse(readFileSync(new URL('dist/build.json', root), 'utf8')) as { sha256: string };
  return metadata.sha256;
}

describe('The standalone static diagnostic', () => {
  it('builds reproducibly with no external scripts and caches all local module imports', () => {
    const first = build();
    const second = build();
    assert.equal(first, second);
    assert.match(first, /^[0-9a-f]{64}$/);
    const html = readFileSync(new URL('dist/index.html', root), 'utf8');
    assert.match(html, /script-src 'self'/);
    assert.doesNotMatch(html, /(?:src|href)="https?:/);
    const source = readFileSync(new URL('dist/assets.js', root), 'utf8');
    const match = /export const assets = (\[.*\]);/.exec(source);
    assert.ok(match?.[1]);
    const assets = JSON.parse(match[1]) as string[];
    for (const path of assets.filter((path) => path !== './')) {
      const contents = readFileSync(new URL(`dist/${path}`, root), 'utf8');
      if (path.endsWith('.js')) {
        assert.doesNotMatch(contents, /from ['"]node:/);
        for (const imported of contents.matchAll(/from ['"]([^'"]+)['"]/g)) {
          const value = imported[1];
          assert.ok(value !== undefined);
          assert.ok(value?.startsWith('./') || value?.startsWith('../'));
          const target = new URL(value, new URL(`dist/${path}`, root));
          const relative = `./${fileURLToPath(target)
            .slice(fileURLToPath(new URL('dist/', root)).length)
            .replaceAll('\\', '/')}`;
          assert.ok(assets.includes(relative), relative);
        }
      }
    }
    const manifest = JSON.parse(readFileSync(new URL('dist/manifest.webmanifest', root), 'utf8')) as {
      display: string;
      start_url: string;
    };
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, './');
  });
});
