// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The server answers its health check with its version alone, hides what it
// is built with, and refuses any other path.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

describe('the health check', () => {
  let app: NestNodeApplication;
  let base: string;

  before(async () => {
    app = await createApp(false);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it("answers the package's version and nothing else", async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { version: pkg.version });
  });

  it('does not say what it is built with', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  it('refuses any other path', async () => {
    const res = await fetch(`${base}/worlds`);
    assert.equal(res.status, 404);
  });
});
