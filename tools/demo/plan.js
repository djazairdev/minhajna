// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What `npm run demo` does, as data the tests can read (#543): PostgreSQL
// from apps/server/compose.yaml, then each part's locked dependencies when
// they are missing or older than its lockfile, the server and the PC web
// app built, and the two started on this machine. `--fresh` clears the
// database's volume first.

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

export const SERVER_PORT = 3000;
export const WEB_PORT = 4180;
export const DATABASE_URL = 'postgresql://minhajna@127.0.0.1:54320/minhajna_demo';
const COMPOSE = ['compose', '-f', 'apps/server/compose.yaml'];

/** The options in `npm run demo -- …`, or an Error naming the one it does not know. */
export function demoOptions(args) {
  const unknown = args.find((arg) => arg !== '--fresh');
  if (unknown !== undefined) return new Error(`npm run demo knows only --fresh, not ${unknown}`);
  return { fresh: args.includes('--fresh') };
}

/** Whether a folder's installed dependencies are missing or older than its lockfile. */
export function needsInstall(folder) {
  const installed = join(folder, 'node_modules', '.package-lock.json');
  if (!existsSync(installed)) return true;
  return statSync(join(folder, 'package-lock.json')).mtimeMs > statSync(installed).mtimeMs;
}

/** The commands that prepare the demo, in order, from the repository's root. */
export function preparation(root, { fresh }, stale = (folder) => needsInstall(join(root, folder))) {
  const steps = [];
  if (fresh)
    steps.push({ what: 'Clearing the demo database', command: 'docker', args: [...COMPOSE, 'down', '--volumes'] });
  steps.push({ what: 'Starting PostgreSQL', command: 'docker', args: [...COMPOSE, 'up', '--detach', '--wait'] });
  for (const [what, folder] of [
    ['the shared packages', '.'],
    ['the Android app, whose screens the web app builds', 'apps/android'],
    ['the web app', 'apps/web'],
    ['the server', 'apps/server'],
    ["the server's build tools", 'apps/server/tools/prisma'],
  ]) {
    if (stale(folder)) {
      steps.push({ what: `Installing ${what}`, command: 'npm', args: ['ci', '--no-audit', '--no-fund'], cwd: folder });
    }
  }
  steps.push({ what: 'Building the server', command: 'npm', args: ['run', 'build'], cwd: 'apps/server' });
  steps.push({ what: 'Building the web app', command: 'npm', args: ['run', 'build'], cwd: 'apps/web' });
  return steps;
}

/** The two programs the demo runs until it is stopped, and what each is told. */
export function services() {
  return [
    {
      what: 'the server',
      command: process.execPath,
      args: ['dist/src/main.js'],
      cwd: 'apps/server',
      env: { PORT: String(SERVER_PORT), DATABASE_URL },
    },
    {
      what: 'the web app',
      command: process.execPath,
      args: ['scripts/serve.ts'],
      cwd: 'apps/web',
      env: { PORT: String(WEB_PORT) },
    },
  ];
}

export const STOP = { what: 'Stopping PostgreSQL', command: 'docker', args: [...COMPOSE, 'stop'] };
