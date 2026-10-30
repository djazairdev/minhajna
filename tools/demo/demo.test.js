// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The local demo's command (#543): its options, what it prepares on a clean
// checkout and on one already installed, what --fresh adds, the two programs
// it runs, waiting for the health check, and a compose file that pins
// PostgreSQL and keeps it on this machine.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { describe, it } from 'node:test';
import { URL } from 'node:url';
import { runnable, stopper, waitFor } from './demo.js';
import { DATABASE_URL, demoOptions, needsInstall, preparation, services, STOP } from './plan.js';

const compose = readFileSync(new URL('../../apps/server/compose.yaml', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const words = (steps) => steps.map((step) => [step.cwd ?? '.', step.command, ...step.args].join(' '));

describe('npm run demo', () => {
  it('is the root package’s demo script, and its tests run with the root tests', () => {
    assert.equal(pkg.scripts.demo, 'node tools/demo/demo.js');
    assert.match(pkg.scripts.test, /tools\/demo\/\*\.test\.js/);
  });

  it('knows only --fresh', () => {
    assert.deepEqual(demoOptions([]), { fresh: false });
    assert.deepEqual(demoOptions(['--fresh']), { fresh: true });
    assert.match(demoOptions(['--fresh', '--seed']).message, /not --seed/);
  });

  it('installs what a clean checkout lacks, then builds the server and the web app', () => {
    assert.deepEqual(words(preparation('/repo', { fresh: false }, () => true)), [
      '. docker compose -f apps/server/compose.yaml up --detach --wait',
      '. npm ci --no-audit --no-fund',
      'apps/android npm ci --no-audit --no-fund',
      'apps/web npm ci --no-audit --no-fund',
      'apps/server npm ci --no-audit --no-fund',
      'apps/server/tools/prisma npm ci --no-audit --no-fund',
      'apps/server npm run build',
      'apps/web npm run build',
    ]);
  });

  it('installs nothing already there, and clears the database first with --fresh', () => {
    assert.deepEqual(words(preparation('/repo', { fresh: true }, () => false)), [
      '. docker compose -f apps/server/compose.yaml down --volumes',
      '. docker compose -f apps/server/compose.yaml up --detach --wait',
      'apps/server npm run build',
      'apps/web npm run build',
    ]);
    assert.deepEqual(words([STOP]), ['. docker compose -f apps/server/compose.yaml stop']);
  });

  it('runs the server against the demo database, and the web app beside it', () => {
    const [server, web] = services();
    assert.deepEqual(
      [server.cwd, server.args, server.env],
      ['apps/server', ['dist/src/main.js'], { PORT: '3000', DATABASE_URL }],
    );
    assert.deepEqual([web.cwd, web.args, web.env], ['apps/web', ['scripts/serve.ts'], { PORT: '4180' }]);
    assert.equal(DATABASE_URL, 'postgresql://minhajna@127.0.0.1:54320/minhajna_demo');
  });

  it('waits for the health check to answer, and gives up after the time it was given', async () => {
    let calls = 0;
    const server = createServer((_, res) => {
      calls += 1;
      res.writeHead(calls < 3 ? 503 : 200).end();
    });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    const { port } = server.address();
    try {
      assert.equal(await waitFor(`http://127.0.0.1:${port}/health`, 5), true);
      assert.equal(calls, 3);
    } finally {
      server.close();
    }
    assert.equal(await waitFor(`http://127.0.0.1:${port}/health`, 1), false);
  });

  it('installs a folder whose dependencies are missing or older than its lockfile', () => {
    const folder = mkdtempSync(join(tmpdir(), 'demo-'));
    writeFileSync(join(folder, 'package-lock.json'), '{}');
    assert.equal(needsInstall(folder), true);
    mkdirSync(join(folder, 'node_modules'));
    writeFileSync(join(folder, 'node_modules', '.package-lock.json'), '{}');
    utimesSync(join(folder, 'package-lock.json'), 1000, 1000);
    utimesSync(join(folder, 'node_modules', '.package-lock.json'), 2000, 2000);
    assert.equal(needsInstall(folder), false);
    utimesSync(join(folder, 'package-lock.json'), 3000, 3000);
    assert.equal(needsInstall(folder), true);
  });

  it('runs npm through Node when npm says where it is, so no shell is needed', () => {
    const step = { command: 'npm', args: ['run', 'build'] };
    assert.deepEqual(runnable(step, '/npm/bin/npm-cli.js'), {
      command: process.execPath,
      args: ['/npm/bin/npm-cli.js', 'run', 'build'],
    });
    assert.deepEqual(runnable(step, ''), step);
    assert.deepEqual(runnable(step, '/yarn/bin/yarn.js'), step);
    assert.deepEqual(runnable(step, 'C:\\npm\\bin\\npm-cli.js').command, process.execPath);
    assert.deepEqual(runnable(STOP, '/npm/bin/npm-cli.js'), { command: 'docker', args: STOP.args });
  });

  it('stops every program and PostgreSQL once, even when stopping PostgreSQL fails', () => {
    const killed = [];
    const children = [
      { kill: (signal) => killed.push(`a ${signal}`) },
      { kill: (signal) => killed.push(`b ${signal}`) },
    ];
    const exits = [];
    let stops = 0;
    const halt = stopper(
      children,
      () => {
        stops += 1;
        throw new Error('docker is not running');
      },
      (code) => exits.push(code),
    );
    halt(1);
    halt(0);
    assert.deepEqual(killed, ['a SIGTERM', 'b SIGTERM']);
    assert.equal(stops, 1);
    assert.deepEqual(exits, [1]);
  });

  it('gives up on a server that takes the connection but never answers', async () => {
    const silent = createServer(() => {});
    await new Promise((done) => silent.listen(0, '127.0.0.1', done));
    try {
      const started = Date.now();
      assert.equal(await waitFor(`http://127.0.0.1:${silent.address().port}/health`, 1), false);
      assert.ok(Date.now() - started < 5000);
    } finally {
      silent.closeAllConnections();
      silent.close();
    }
  });

  it('pins PostgreSQL by version and digest, on this machine only, with its data in one volume', () => {
    assert.match(compose, /image: postgres:\d+\.\d+-alpine@sha256:[0-9a-f]{64}\n/);
    assert.match(compose, /- 127\.0\.0\.1:54320:5432\n/);
    assert.doesNotMatch(compose, /^\s+- (0\.0\.0\.0:)?\d+:\d+$/m);
    assert.match(compose, /- demo-data:\/var\/lib\/postgresql\n/);
    assert.match(compose, /test: \[CMD, pg_isready, -h, 127\.0\.0\.1,/);
    const weblate = readFileSync(new URL('../../infra/weblate/compose.yaml', import.meta.url), 'utf8');
    assert.equal(compose.match(/image: (postgres:\S+)/)[1], weblate.match(/image: (postgres:\S+)/)[1]);
  });
});
