// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Every native module of the phone app has a web version (#250), so a new
// one cannot reach the bundle without it: the build refuses a module it has
// no web version of.

import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { webModule } from '../scripts/resolve.ts';

describe('the native modules on the web', () => {
  it('has a web version of every spec in the phone app', () => {
    const specs = readdirSync(new URL('../../android/src/native/', import.meta.url))
      .map((name) => /^NativeMinhajna([A-Za-z]+)\.ts$/u.exec(name)?.[1])
      .filter((name) => name !== undefined);
    assert.equal(specs.length, 16);
    for (const name of specs) assert.match(webModule(name), new RegExp(`src/native/${name}\\.ts$`, 'u'));
  });

  it('refuses a module with no web version', () => {
    assert.throws(() => webModule('Teleport'), /No web version of NativeMinhajnaTeleport/u);
  });
});
