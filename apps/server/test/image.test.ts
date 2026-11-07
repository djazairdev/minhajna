// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The container image (#633): built from the Dockerfile, run against the S3
// stand-in of compose.yaml's archive profile, stopped, and run again on an
// empty disk, where the world must be as it was; a restore of each base backup
// tested and logged by the container, passed with the bucket, and failed with
// it out of reach, with a WAL file refused, and with a migration the copy
// lacks, the second container's WAL switched too rarely to archive it, which
// the operators' view of the server says with its archiving, and nothing of the
// copy left after any of them (#620). A start says each step, and stops if its
// first backup can't archive its WAL in time. It needs Docker, so it runs only
// with TEST_IMAGE=1, as the image workflow sets; every world here is made up.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SEALED_BATCH_BYTES } from '../src/spaces/space-rules.js';

type ServerPackage = { dependencies: Record<string, string> };

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const compose = ['compose', '-f', 'apps/server/compose.yaml', '--profile', 'archive'];
const image = 'minhajna-server:test';
const prefix = `s3://demo-archive/test-${randomBytes(6).toString('hex')}`;
const sealing = randomBytes(32).toString('hex');
const pass = 'cGFzcy1mb3ItYS1tYWRlLXVwLWRlbW8td29ybGQtMDQ';
const json = { 'content-type': 'application/json', 'x-world-pass': pass };
const started: string[] = [];

function docker(...args: string[]): string {
  return execFileSync('docker', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Everything a container wrote, on stdout and stderr alike. */
function logs(name: string): string {
  const result = spawnSync('docker', ['logs', name], { encoding: 'utf8' });
  return `${result.stdout}${result.stderr}`;
}

function bucket(endpoint = 'http://objects:8333'): string[] {
  return [
    ...['-e', `WALG_S3_PREFIX=${prefix}`, '-e', `AWS_ENDPOINT=${endpoint}`, '-e', 'AWS_REGION=us-east-1'],
    ...['-e', 'AWS_S3_FORCE_PATH_STYLE=true', '-e', 'AWS_ACCESS_KEY_ID=made-up', '-e', 'AWS_SECRET_ACCESS_KEY=made-up'],
    ...['-e', `WALG_LIBSODIUM_KEY=${sealing}`, '-e', 'WALG_LIBSODIUM_KEY_TRANSFORM=hex'],
  ];
}

/** Runs the image to its end, and answers its exit code and what it wrote. */
function runToEnd(...args: string[]): { status: number | null; output: string } {
  const result = spawnSync('docker', ['run', '--rm', '--network', 'minhajna-demo_default', ...args, image], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** The operators' view of the server and its admin log, through the made-up world. */
async function operators(base: string): Promise<{
  system: Record<string, unknown>;
  log: { action: string; detail: Record<string, unknown> }[];
}> {
  const system = (await (await fetch(`${base}/worlds/K7QF4/admin/system`, { headers: json })).json()) as never;
  const read = (await (await fetch(`${base}/worlds/K7QF4/admin/log`, { headers: json })).json()) as never;
  return { system, log: (read as { lines: { action: string; detail: Record<string, unknown> }[] }).lines };
}

const today = () => new Date().toISOString().slice(0, 10);

/** The result of a restore test, its day checked to be this test's own, across midnight too. */
function resultOf(restore: unknown, opened: string): unknown {
  const { day, result } = restore as { day: string; result: string };
  assert.ok([opened, today()].includes(day));
  return result;
}

/** What is left of a restore test: its folder or its second PostgreSQL, none of them once it ended. */
function leftOf(name: string): string {
  const folders = 'ls -d "$PGDATA.restore-test" /var/run/postgresql/restore-test 2>/dev/null';
  const second = 'pgrep -af "^postgres -D .*[.]restore-test"';
  return docker('exec', name, 'sh', '-c', `${folders}; ${second} || true`);
}

/** Runs a restore test in a running container, and answers what it wrote. */
function restoreTest(
  name: string,
  env: string[],
  script = 'exec minhajna-restore-test',
): { status: number | null; output: string } {
  const run = spawnSync('docker', ['exec', ...env, name, 'sh', '-c', script], { encoding: 'utf8', timeout: 120_000 });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

async function healthy(base: string): Promise<boolean> {
  try {
    return (await fetch(`${base}/health`)).ok;
  } catch {
    return false;
  }
}

/** Starts the image against the stand-in bucket, and answers its address once it is healthy. */
async function serve(name: string, ...env: string[]): Promise<string> {
  started.push(name);
  const options = ['-d', '--name', name, '--network', 'minhajna-demo_default', '-p', '127.0.0.1::8080'];
  docker('run', ...options, ...bucket(), ...env, image);
  const base = `http://${docker('port', name, '8080').split('\n')[0]!}`;
  for (let tries = 0; tries < 180; tries++) {
    if (await healthy(base)) return base;
    await setTimeout(500);
  }
  throw new Error(`${name} did not answer /health:\n${logs(name)}`);
}

describe('the server image', { skip: process.env['TEST_IMAGE'] === '1' ? false : 'TEST_IMAGE is not 1' }, () => {
  before(() => {
    docker('build', '-q', '-f', 'apps/server/Dockerfile', '-t', image, '.');
    docker(...compose, 'rm', '-sfv', 'objects');
    docker(...compose, 'up', '-d', '--wait', 'objects');
    docker(...compose, 'exec', '-T', 'objects', 'sh', '-c', 'echo "s3.bucket.create -name demo-archive" | weed shell');
  });

  after(() => {
    for (const name of started) spawnSync('docker', ['rm', '-f', name]);
    spawnSync('docker', [...compose, 'rm', '-sfv', 'objects'], { cwd: root });
  });

  it('holds the notices of what it runs, its packages among them', () => {
    const version = (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as ServerPackage)
      .dependencies['@nestjs/core'];
    const held = spawnSync(
      'docker',
      ['run', '--rm', '--entrypoint', 'sh', image, '-c', 'cat NOTICES.txt; echo LISTED; ls licenses'],
      { encoding: 'utf8' },
    );
    assert.equal(held.status, 0);
    assert.match(held.stdout, /^The notices of what this image holds/);
    assert.ok(held.stdout.includes(`@nestjs/core ${version}: MIT`));
    const listed = held.stdout.slice(held.stdout.lastIndexOf('LISTED'));
    for (const text of ['AGPL-3.0-or-later.txt', 'Apache-2.0.txt', 'libatomic1.txt', 'node.txt', 'wal-g.txt']) {
      assert.ok(listed.includes(text), text);
    }
  });

  it('refuses to start with no bucket, unless told to keep nothing', () => {
    const run = runToEnd();
    assert.equal(run.status, 1);
    assert.match(run.output, /fatal \[Container\] set WALG_S3_PREFIX/);
  });

  it('refuses to start when the bucket cannot be read, rather than start an empty database', () => {
    const run = runToEnd(...bucket('http://nowhere.invalid:8333'), '-e', 'BUCKET_WAIT=5');
    assert.equal(run.status, 1);
    assert.match(run.output, /fatal \[Container\] cannot read the bucket/);
  });

  it('says each step of a start, and stops when the first backup outruns its time', () => {
    const lines = ['#!/bin/sh', '[ \\"\\$1\\" = wal-push ] && exit 1', 'exec /usr/local/bin/minhajna-wal-g \\"\\$@\\"'];
    const refuse = `printf "${lines.join('\\n')}\\n" > /tmp/stuck/minhajna-wal-g`;
    const stuck = `mkdir -p /tmp/stuck && ${refuse} && chmod -R 755 /tmp/stuck`;
    const limit = ['-e', `WALG_S3_PREFIX=${prefix}-first-backup`, '-e', 'BACKUP_WAIT=15', '--entrypoint', 'sh'];
    const start = `${stuck} && PATH=/tmp/stuck:$PATH exec minhajna-start`;
    const args = ['run', '--rm', '--network', 'minhajna-demo_default', ...bucket(), ...limit, image, '-c', start];
    const run = spawnSync('docker', args, { cwd: root, encoding: 'utf8', timeout: 120_000 });
    const said = `${run.stdout}${run.stderr}`;
    assert.equal(run.status, 1);
    for (const step of ['starting', 'reading the bucket', 'making a new database', 'starting PostgreSQL']) {
      assert.match(said, new RegExp(`log \\[Container\\] ${step}\\n`));
    }
    assert.match(said, /log \[Container\] backing up the new database\n[^]*Calling pg_stop_backup/);
    assert.match(said, /fatal \[Container\] cannot back up the new database/);
  });

  it('fetches a WAL file again when the bucket fails, and stops recovery rather than skip it', () => {
    const fetchWal = (endpoint: string): number | null =>
      spawnSync(
        'docker',
        ['run', '--rm', '--network', 'minhajna-demo_default', ...bucket(endpoint)]
          .concat(['-e', 'WALG_S3_MAX_RETRIES=0', '--entrypoint', 'minhajna-wal-fetch', image])
          .concat(['000000010000000000000009', '/tmp/wal']),
        { timeout: 120_000 },
      ).status;
    assert.equal(fetchWal('http://objects:8333'), 1);
    assert.equal(fetchWal('http://nowhere.invalid:8333'), 255);
  });

  it('keeps every world through a new container on an empty disk, and logs no clock time', async () => {
    const batches = [0, 1].map(() => randomBytes(SEALED_BATCH_BYTES).toString('base64url'));
    const opened = today();
    const first = await serve('minhajna-image-first', '-e', 'BACKUP_EVERY=4');
    const start = { world: 'K7QF4', sealed: 'c2VhbGVk', date: '2026-12-01', announcedDays: ['2026-12-06'], pass };
    assert.equal(
      (await fetch(`${first}/worlds`, { method: 'POST', headers: json, body: JSON.stringify(start) })).status,
      201,
    );
    const space = `${first}/worlds/K7QF4/spaces/national`;
    assert.equal((await fetch(space, { method: 'PUT', headers: json, body: '{"kind":"national"}' })).status, 200);
    const upload = (first: number): Promise<Response> => {
      const body = JSON.stringify({ stream: 'cGhvbmUtb2YtdGVhY2hlci1h', first, batches: [batches[first]] });
      return fetch(`${space}/batches`, { method: 'POST', headers: json, body });
    };
    assert.equal((await upload(0)).status, 201);
    for (let tries = 0; (logs('minhajna-image-first').match(/Wrote backup/g) ?? []).length < 2; tries++) {
      assert.ok(tries < 60, 'the container takes a base backup every BACKUP_EVERY seconds');
      await setTimeout(500);
    }
    for (let tries = 0; !/log \[Restore test\] (passed|failed)/.test(logs('minhajna-image-first')); tries++) {
      assert.ok(tries < 360, 'the container tests a restore after each base backup');
      await setTimeout(500);
    }
    assert.match(logs('minhajna-image-first'), /log \[Restore test\] passed/);
    const tested = await operators(first);
    assert.deepEqual([tested.system['archive'], tested.system['archiving']], ['on', 'ok']);
    assert.equal(resultOf(tested.system['restore'], opened), 'passed');
    assert.deepEqual(tested.log.find((line) => line.action === 'restore.tested')?.detail, { result: 'passed' });
    assert.equal(leftOf('minhajna-image-first'), '');
    assert.equal((await upload(1)).status, 201);
    docker('stop', '-t', '120', 'minhajna-image-first');
    assert.equal(docker('inspect', '-f', '{{.State.ExitCode}}', 'minhajna-image-first'), '0');

    const second = await serve('minhajna-image-second', '-e', 'ARCHIVE_TIMEOUT=3600');
    const joined = await fetch(`${second}/worlds/K7QF4`, { headers: json });
    assert.deepEqual(await joined.json(), { sealed: 'c2VhbGVk', date: '2026-12-01', announcedDays: ['2026-12-06'] });
    const read = await fetch(`${second}/worlds/K7QF4/spaces/national/batches?after=0`, { headers: json });
    const kept = (await read.json()) as { batches: { bytes: string }[] };
    assert.deepEqual(
      kept.batches.map((one) => one.bytes),
      batches,
    );
    const role = ['exec', '-u', 'minhajna', 'minhajna-image-second', 'psql', '-h', '/var/run/postgresql'];
    assert.equal(
      docker(...role, '-d', 'minhajna', '-Atc', 'SELECT rolsuper FROM pg_roles WHERE rolname = current_user'),
      'f',
    );
    const asServer = ['exec', '-u', 'minhajna', 'minhajna-image-second', 'sh', '-c'];
    const server = docker(...asServer, 'cat /proc/$(pgrep -o -u minhajna -f "^node dist/src/main.js")/environ');
    assert.doesNotMatch(server, /AWS_|WALG_/);
    const asPostgres = ['exec', '-u', 'postgres', 'minhajna-image-second', 'psql', '-h', '/var/run/postgresql'];
    const noWal = 'mkdir -p /tmp/no-wal && printf "#!/bin/sh\\nexit 1\\n" > /tmp/no-wal/minhajna-wal-fetch';
    const noFetch = `${noWal} && chmod -R 755 /tmp/no-wal && PATH=/tmp/no-wal:$PATH exec minhajna-restore-test`;
    const out = [
      '-e',
      'AWS_ENDPOINT=http://nowhere.invalid:8333',
      '-e',
      'WALG_S3_MAX_RETRIES=0',
      '-e',
      'RESTORE_WAIT=30',
    ];
    const failures: [string, string[], string | undefined, (() => void)?, (() => void)?][] = [
      ['fetch', out, undefined],
      ['recover', ['-e', 'RESTORE_WAIT=90'], noFetch],
      [
        'check',
        ['-e', 'RESTORE_WAIT=90'],
        undefined,
        () =>
          docker(
            ...asPostgres,
            '-d',
            'minhajna',
            '-c',
            "INSERT INTO minhajna_meta.migration (name) VALUES ('0000_made_up')",
          ),
        () =>
          docker(
            ...asPostgres,
            '-d',
            'minhajna',
            '-c',
            "DELETE FROM minhajna_meta.migration WHERE name = '0000_made_up'",
          ),
      ],
    ];
    let said = '';
    for (const [step, env, script, setUp, undo] of failures) {
      setUp?.();
      const failing = restoreTest('minhajna-image-second', env, script);
      undo?.();
      said += failing.output;
      assert.equal(failing.status, 1, step);
      assert.match(failing.output, new RegExp(`log \\[Restore test\\] failed: ${step}`));
      const failed = await operators(second);
      assert.equal(resultOf(failed.system['restore'], opened), 'failed');
      const line = failed.log.find((one) => one.action === 'restore.tested');
      assert.deepEqual(line?.detail, { result: 'failed', step });
      assert.equal(leftOf('minhajna-image-second'), '');
    }
    const written = `${logs('minhajna-image-first')}\n${logs('minhajna-image-second')}\n${said}`;
    assert.match(written, /restoring the latest backup/);
    assert.doesNotMatch(written, /\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}/);
  });
});
