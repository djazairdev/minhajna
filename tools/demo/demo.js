// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// `npm run demo [-- --fresh]` (#543): prepares the local demo as plan.js says,
// starts the server and the web app, waits for the server's health check, and
// prints where they are. Ctrl-C, a failed step or a program that stops stops
// everything, PostgreSQL included, from the moment PostgreSQL starts; the
// database's data stays for the next run unless --fresh clears it. In the dev
// container, its PostgreSQL is left running. npm runs through Node itself, so
// the same commands work on Windows.

import { spawn, spawnSync } from 'node:child_process';
import { get } from 'node:http';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';
import { demoOptions, preparation, SERVER_PORT, services, STOP, WEB_PORT } from './plan.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

function answers(url) {
  return new Promise((done) => {
    const request = get(url, { timeout: 1000 }, (res) => {
      res.resume();
      done(res.statusCode === 200);
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => done(false));
  });
}

/** Waits for a URL to answer 200, checking every half second, for at most `seconds`. */
export async function waitFor(url, seconds) {
  for (let tries = 0; tries < seconds * 2; tries++) {
    if (await answers(url)) return true;
    await setTimeout(500);
  }
  return false;
}

/** A command as it runs here: npm through the Node running this script when npm started it, so no shell is needed. */
export function runnable({ command, args }, npmCli = process.env.npm_execpath) {
  if (command === 'npm' && /npm[^/\\]*$/.test(npmCli ?? ''))
    return { command: process.execPath, args: [npmCli, ...args] };
  return { command, args };
}

function run(step) {
  process.stdout.write(`${step.what}…\n`);
  const { command, args } = runnable(step);
  const env = { ...process.env, ...step.env };
  const result = spawnSync(command, args, { cwd: join(root, step.cwd ?? '.'), env, stdio: 'inherit' });
  if (result.status !== 0) {
    const why = result.error?.message ?? (result.signal ? `stopped by ${result.signal}` : `exit code ${result.status}`);
    throw new Error(`${step.what} failed (${why}): ${step.command} ${step.args.join(' ')}`);
  }
}

/** Stops the programs and PostgreSQL once, whatever called it, then exits with the code. */
export function stopper(children, stopDatabase, exit) {
  let stopping = false;
  return (code) => {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill('SIGTERM');
    try {
      stopDatabase();
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
    }
    exit(code);
  };
}

async function main() {
  const options = demoOptions(process.argv.slice(2));
  if (options instanceof Error) throw options;
  const database = process.env.MINHAJNA_DEMO_DATABASE || undefined;
  const children = [];
  const halt = stopper(
    children,
    () => (database ? undefined : run(STOP)),
    (code) => process.exit(code),
  );
  process.on('SIGINT', () => halt(0));
  process.on('SIGTERM', () => halt(0));
  try {
    for (const step of preparation(root, { ...options, database })) run(step);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    halt(1);
  }
  for (const { what, command, args, cwd, env } of services(database)) {
    const child = spawn(command, args, { cwd: join(root, cwd), env: { ...process.env, ...env }, stdio: 'inherit' });
    child.on('exit', () => {
      process.stderr.write(`${what} stopped\n`);
      halt(1);
    });
    children.push(child);
  }
  if (!(await waitFor(`http://127.0.0.1:${SERVER_PORT}/health`, 30))) {
    process.stderr.write('The server did not answer /health\n');
    halt(1);
  }
  const lines = [
    '',
    'The demo is running:',
    `  server   http://127.0.0.1:${SERVER_PORT}/health`,
    `  web app  http://127.0.0.1:${WEB_PORT}/`,
    'Ctrl-C stops it.',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
