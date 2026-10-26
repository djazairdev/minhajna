// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The web app runs the phone app's own code, so every package both apps use
// takes the phone's exact version (#250): a bump on the phone that the web
// misses fails here. React DOM follows React.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

type Manifest = { dependencies: Record<string, string> };

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Manifest;

describe('the shared packages', () => {
  it('takes the phone app’s exact version of every package both use', () => {
    const web = read('../package.json').dependencies;
    const phone = read('../../android/package.json').dependencies;
    const shared = Object.keys(web).filter((name) => name in phone);
    assert.ok(shared.length >= 8);
    for (const name of shared) assert.equal(web[name], phone[name], name);
    assert.equal(web['react-dom'], phone.react);
  });
});
