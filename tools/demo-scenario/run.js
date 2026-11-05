// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// `node tools/demo-scenario/run.js [--server URL] [--wait SECONDS]` (#629):
// waits for the demo server's health check, by default for `npm run demo`'s
// server on this machine, then runs the demo scenarios one after another,
// saying each step, and exits with 1 at the first that fails, or if a run stops
// without finishing them. CI runs it against `npm run demo` (test.yml). The
// server lets one address start only a few worlds an hour (START_LIMIT) and
// make only so many requests in ten minutes (RELAY_LIMIT), and one run of the
// scenario at the school takes about a third of those, so the scenarios share
// both budgets.

import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { parseArgs } from 'node:util';
import { waitFor } from '../demo/demo.js';
import { SERVER_PORT } from '../demo/plan.js';
import { runScenario, SAMPLE } from './scenario.js';

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
  const { SCHOOL } = await import('./school.js');
  const { NATIONAL } = await import('./national.js');
  const scenarios = [SAMPLE, SCHOOL, NATIONAL];
  for (const scenario of scenarios) {
    process.stdout.write(`${scenario.name}\n`);
    await runScenario(scenario, values.server, { say: (line) => process.stdout.write(`  ${line}\n`) });
  }
  process.stdout.write(`${scenarios.length} demo scenario(s) passed\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = 1;
  main().then(
    () => {
      process.exitCode = 0;
    },
    (error) => {
      const cause = error.cause ?? error;
      const fault = [TypeError, ReferenceError, SyntaxError].some((kind) => cause instanceof kind);
      process.stderr.write(`${error.message}\n${fault ? `${cause.stack}\n` : ''}`);
    },
  );
}
