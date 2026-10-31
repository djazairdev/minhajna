// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// `node tools/demo-scenario/run.js [--server URL] [--wait SECONDS]` (#629):
// waits for the demo server's health check, by default for `npm run demo`'s
// server on this machine, then runs the demo scenarios one after another,
// saying each step, and exits with 1 at the first that fails. CI runs it
// against `npm run demo` (test.yml). The server lets one address start only a
// few worlds an hour (START_LIMIT), so the scenarios share that budget.

import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { parseArgs } from 'node:util';
import { waitFor } from '../demo/demo.js';
import { SERVER_PORT } from '../demo/plan.js';
import { runScenario, SAMPLE } from './scenario.js';

export const SCENARIOS = [SAMPLE];

async function main() {
  const { values } = parseArgs({
    options: {
      server: { type: 'string', default: `http://127.0.0.1:${SERVER_PORT}` },
      wait: { type: 'string', default: '30' },
    },
  });
  const seconds = Number(values.wait);
  if (!Number.isInteger(seconds) || seconds < 1) throw new RangeError('--wait takes a whole number of seconds');
  if (!(await waitFor(new URL('/health', values.server).href, seconds)))
    throw new Error(`${values.server} did not answer /health`);
  for (const scenario of SCENARIOS) {
    process.stdout.write(`${scenario.name}\n`);
    await runScenario(scenario, values.server, { say: (line) => process.stdout.write(`  ${line}\n`) });
  }
  process.stdout.write(`${SCENARIOS.length} demo scenario(s) passed\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
