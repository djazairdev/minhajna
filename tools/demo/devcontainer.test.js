// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dev container (#634): it runs the server's PostgreSQL and S3 stand-in
// from apps/server/compose.yaml with no port on the computer, installs the
// lockfiles as CI does, and forwards the demo's two ports; inside it, `npm
// run demo` uses that PostgreSQL and runs no Docker, and `--fresh` empties
// the demo database alone.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { describe, it } from 'node:test';
import { URL } from 'node:url';
import { clearing } from './clear.js';
import { preparation, services } from './plan.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const config = JSON.parse(read('.devcontainer/devcontainer.json'));
const compose = read('.devcontainer/compose.yaml');
const words = (steps) => steps.map((step) => [step.cwd ?? '.', step.command, ...step.args].join(' '));
const DEMO = 'postgresql://minhajna@127.0.0.1:5432/minhajna_demo';

describe('the dev container', () => {
  it('runs the server’s PostgreSQL and S3 stand-in, publishing no port, and forwards the demo’s', () => {
    assert.deepEqual(config.dockerComposeFile, ['../apps/server/compose.yaml', 'compose.yaml']);
    assert.deepEqual(config.runServices, ['workspace', 'database', 'objects']);
    assert.deepEqual(config.forwardPorts, [3000, 4180]);
    assert.match(compose, /image: node:22\.\d+\.\d+-trixie@sha256:[0-9a-f]{64}\n/);
    assert.match(compose, /network_mode: service:database\n/);
    assert.equal(compose.match(/ports: !reset \[\]/g)?.length, 2);
    assert.match(compose, new RegExp(`MINHAJNA_DEMO_DATABASE: ${DEMO}\n`));
    assert.match(compose, /TEST_DATABASE_URL: postgresql:\/\/minhajna@127\.0\.0\.1:5432\/minhajna_test\n/);
    assert.match(read('apps/server/compose.yaml'), /POSTGRES_DB: minhajna_demo\n/);
    assert.match(read('apps/server/test-database.sql'), /CREATE DATABASE minhajna_test/);
  });

  it('installs every lockfile as CI does, into volumes of its own, and the server’s tools', () => {
    assert.equal(config.postCreateCommand, 'bash .devcontainer/install.sh');
    const installs = read('.devcontainer/install.sh')
      .split('\n')
      .filter((line) => line.startsWith('npm '));
    assert.deepEqual(installs, [
      'npm ci --no-audit',
      'npm ci --no-audit --prefix apps/android',
      'npm ci --no-audit --prefix apps/web',
      'npm ci --no-audit --prefix apps/server',
      'npm run tools --prefix apps/server',
      'npm run generate --prefix apps/server',
    ]);
    const folders = ['', 'apps/android/', 'apps/web/', 'apps/server/', 'apps/server/tools/prisma/'];
    for (const folder of folders) {
      assert.match(compose, new RegExp(`- [a-z]+-modules:/workspaces/minhajna/${folder}node_modules\n`), folder);
    }
    const owned = /MODULES: >-\n((?: {8}.+\n)+)/.exec(compose)?.[1].trim().split(/\s+/);
    assert.deepEqual(
      owned,
      folders.map((folder) => `/workspaces/minhajna/${folder}node_modules`),
    );
  });

  it('runs the demo on its PostgreSQL with no Docker, and empties it with --fresh', () => {
    assert.deepEqual(words(preparation('/repo', { fresh: false, database: DEMO }, () => false)), [
      'apps/server npm run build',
      'apps/web npm run build',
    ]);
    const fresh = preparation('/repo', { fresh: true, database: DEMO }, (folder) => folder === 'apps/server');
    assert.deepEqual(words(fresh), [
      'apps/server npm ci --no-audit --no-fund',
      `. ${process.execPath} tools/demo/clear.js`,
      'apps/server npm run build',
      'apps/web npm run build',
    ]);
    assert.deepEqual(fresh[1].env, { DATABASE_URL: DEMO });
    assert.equal(services(DEMO)[0].env.DATABASE_URL, DEMO);
  });

  it('empties the demo database alone', () => {
    assert.match(clearing(DEMO), /^DROP SCHEMA IF EXISTS public CASCADE; .* CREATE SCHEMA public$/);
    for (const other of [
      'postgresql://minhajna@127.0.0.1:5432/minhajna_test',
      'postgresql://minhajna@elsewhere.test:5432/minhajna_demo',
      'postgresql://minhajna@127.0.0.1:5432/minhajna_demo?host=elsewhere.test',
    ]) {
      assert.match(clearing(other).message, /only minhajna_demo here/, other);
    }
  });
});
