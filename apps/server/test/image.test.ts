// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The container image (#633): built from the Dockerfile, run against the
// S3 stand-in of compose.yaml's archive profile, stopped, and run again on
// an empty disk, where the world must be as it was. It needs Docker, so it
// runs only with TEST_IMAGE=1, as the image workflow sets; every world here
// is made up.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SEALED_BATCH_BYTES } from '../src/spaces/space-rules.js';

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
    assert.equal((await upload(1)).status, 201);
    docker('stop', '-t', '120', 'minhajna-image-first');
    assert.equal(docker('inspect', '-f', '{{.State.ExitCode}}', 'minhajna-image-first'), '0');

    const second = await serve('minhajna-image-second');
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
    const server = docker(...asServer, 'cat /proc/$(pgrep -x -u minhajna node)/environ');
    assert.doesNotMatch(server, /AWS_|WALG_/);
    const written = `${logs('minhajna-image-first')}\n${logs('minhajna-image-second')}`;
    assert.match(written, /restoring the latest backup/);
    assert.doesNotMatch(written, /\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}/);
  });
});
