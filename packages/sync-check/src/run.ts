// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Runs the sync check and prints its tables in Markdown.
// Run with `npm run check -w packages/sync-check`.
// Everything is made up and stays in memory; no server is reached.

import { parseDay, verifyHistory } from '@minhajna/core';
import { decodeChanges, encodeChanges, makeKey, openBatches, sealBatches } from './batches.ts';
import { conflictNotice, findConflicts } from './conflicts.ts';
import { between, demoYear, deps, twoDevices } from './demo.ts';
import { PROFILES, SimulatedLink } from './link.ts';
import { daySizes, fixedCost, sizes, transferRow, type Load } from './measure.ts';
import { BatchServer, download, upload } from './transfer.ts';

const SIZE = 4096;
const RUNS = 25;
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const seconds = (ms: number) => (Number.isNaN(ms) ? '–' : `${(ms / 1000).toFixed(1)} s`);

const cem = await demoYear('cem');
const primary = await demoYear('primary');
const loads: Load[] = [
  { name: 'Middle-school year', entries: cem.entries },
  { name: 'Primary year', entries: primary.entries },
  { name: 'A school day', entries: between(cem.entries, parseDay('2026-10-14'), parseDay('2026-10-14')) },
  { name: 'A school week', entries: between(cem.entries, parseDay('2026-10-11'), parseDay('2026-10-15')) },
];

console.log(`## Sizes, in batches of ${SIZE} bytes\n`);
console.log('| Load | Entries | JSON | Compressed | Batches | Sealed |\n|---|---:|---:|---:|---:|---:|');
for (const load of loads) {
  const one = await sizes(load, SIZE);
  console.log(
    `| ${load.name} | ${one.entries} | ${kb(one.json)} | ${kb(one.compressed)} | ${one.batches} | ${kb(one.sealed)} |`,
  );
}

const key = await makeKey();
const years = loads.slice(0, 2);
const daily = loads.slice(2);
console.log(`\n## A full year: the first sync up, a new phone's restore down; ${RUNS} seeded runs each\n`);
console.log(
  '| Link | Year | Way | Resume: median | Slowest | Bytes | Restart: median | Slowest | Bytes | Unfinished |\n' +
    '|---|---|---|---:|---:|---:|---:|---:|---:|---:|',
);
for (const profile of PROFILES) {
  for (const load of years) {
    for (const direction of ['upload', 'download'] as const) {
      const resume = await transferRow(key, load, profile, direction, 'resume', SIZE, RUNS);
      const restart = await transferRow(key, load, profile, direction, 'restart', SIZE, RUNS);
      console.log(
        `| ${profile.name} | ${load.name} | ${direction} | ${seconds(resume.medianMs)} | ${seconds(resume.worstMs)} | ` +
          `${kb(resume.medianBytes)} | ${seconds(restart.medianMs)} | ${seconds(restart.worstMs)} | ` +
          `${kb(restart.medianBytes)} | ${RUNS - resume.completed} / ${RUNS - restart.completed} |`,
      );
    }
  }
}

console.log(`\n## Daily syncs, resuming; ${RUNS} seeded runs each\n`);
console.log('| Link | Load | Median time | Slowest | Median bytes | Unfinished |\n|---|---|---:|---:|---:|---:|');
for (const profile of PROFILES) {
  for (const load of daily) {
    const row = await transferRow(key, load, profile, 'upload', 'resume', SIZE, RUNS);
    console.log(
      `| ${profile.name} | ${load.name} | ${seconds(row.medianMs)} | ${seconds(row.worstMs)} | ` +
        `${kb(row.medianBytes)} | ${RUNS - row.completed} |`,
    );
  }
}

console.log('\n## Fixed batches: a month of one batch at each set time\n');
console.log('| Batch | Set times a day | A month | School days that fit | Busiest day |\n|---:|---:|---:|---:|---:|');
const days = await daySizes(cem.entries);
for (const size of [2048, 4096, 8192, 16384]) {
  for (const setTimes of [2, 4, 6]) {
    const cost = fixedCost(days, size, setTimes);
    console.log(
      `| ${kb(size)} | ${setTimes} | ${kb(cost.monthBytes)} | ${(cost.daysFitting * 100).toFixed(0)}% | ` +
        `${cost.busiestDay} batches |`,
    );
  }
}

console.log('\n## A full year, end to end\n');
const server = new BatchServer();
const sent = await sealBatches(key, 'year', 0, await encodeChanges(cem.entries), SIZE);
const up = upload(new SimulatedLink(PROFILES[0]!, 7), server, 'year', sent, 'resume');
const down = download(new SimulatedLink(PROFILES[0]!, 8), server, 'year', 0, 'resume');
const received = (await Promise.all((await openBatches(key, 'year', down.batches)).map(decodeChanges))).flat();
const problems = await verifyHistory(deps.digest, received);
console.log(
  `Sent in ${seconds(up.ms)} with ${up.drops} drops, received in ${seconds(down.result.ms)} with ` +
    `${down.result.drops} drops; ${received.length} entries, ${problems.length} problems, ` +
    `${JSON.stringify(received) === JSON.stringify(cem.entries) ? 'identical' : 'DIFFERENT'}.`,
);

console.log('\n## A conflict\n');
const devices = await twoDevices(cem, parseDay('2026-10-14'));
const shared = new BatchServer();
const fromPhone = await sealBatches(key, 'phone', 0, await encodeChanges(devices.phone), SIZE);
upload(new SimulatedLink(PROFILES[0]!, 9), shared, 'phone', fromPhone, 'resume');
const arrived = download(new SimulatedLink(PROFILES[0]!, 10), shared, 'phone', 0, 'resume');
const onComputer = (await Promise.all((await openBatches(key, 'phone', arrived.batches)).map(decodeChanges))).flat();
const conflicts = findConflicts(devices.computer, onComputer);
console.log(
  `The phone sent ${devices.phone.length} entries and the computer had ${devices.computer.length} of its own: ` +
    `${JSON.stringify(conflictNotice(conflicts))}; ${conflicts.map((one) => one.key.split('/')[0]).join(', ')}.`,
);
