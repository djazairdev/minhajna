// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world as the app's own devices meet it (#630, answer 722): each role's
// device has its own record book, as the world's store the app opens, and works
// through the app's own network client, pointed at the given server, its pass
// and its paths checked as on a phone. Starting seeds a national world as the
// app's start does, joining opens its keys and the world's date is read from
// the server. The network client holds one world open, as a device does, so a
// join shuts it first: a scenario's devices all act in one world, in turn. The
// kit's random bytes come from a seed (kit.js), the scenario's name, so it
// plays the same world each time: on a server where that world is already
// taken, it says to clear the demo's database instead of playing another. A
// deployed server keeps its worlds, so a run there sets MINHAJNA_SCENARIO_RUN,
// and the name and that value seed the kit, a world of its own for each run.

import process from 'node:process';
import { appModule } from './app.js';
import { seededKit } from './kit.js';

const { startSeededWorld } = await appModule('demo/world-seed.ts');
const { joinWorld, moveWorldDate, WORLD_SIGNER } = await appModule('demo/world-session.ts');
const { openWorld } = await appModule('demo/world-mode.ts');
const { DEMO_SERVER, leaveWorldNetwork, worldRequest } = await appModule('network/world-network.ts');
const { bundledReference, readReference } = await appModule('reference.ts');
const { FakeStorage } = await appModule('../jest/fake-storage.ts');

const read = readReference(bundledReference);
if (!read.ok) throw new RangeError('The bundled reference does not read');

/** The bundled reference data a world's devices read. */
export const reference = read;

/** A device's own store, as the app's world module keeps it, in memory. */
async function storeOf(found) {
  const storage = new FakeStorage().asSpec();
  const world = {
    enterWorld: () => storage.openHistory(),
    leaveWorld: () => Promise.resolve(),
    loadHistory: () => storage.loadHistory(),
    appendEntry: (entry) => storage.appendEntry(entry),
    eraseContent: (ids) => storage.eraseContent(ids),
  };
  return openWorld(found, storage, world);
}

const signerOf = (keys) => keys.trusted.find((one) => one.id === WORLD_SIGNER)?.fingerprint;

/** The seed of a scenario's kit: its name alone, or with the run's value on a server that keeps its worlds. */
export const runSeed = (name, run = process.env.MINHAJNA_SCENARIO_RUN) => (run ? `${name}\n${run}` : name);

/** How a scenario's devices meet the server through the app, for a scenario of that name: its `access`. */
export function appAccess(server, seed, fetcher = globalThis.fetch) {
  const kit = seededKit(runSeed(seed));
  const send = async (request) => {
    const answer = await worldRequest(request, (address, init) => fetcher(address.replace(DEMO_SERVER, server), init));
    if (request.method === 'POST' && request.path === '/worlds' && answer.status === 409) {
      throw new Error('This scenario already ran on this server: start the demo again with `npm run demo -- --fresh`');
    }
    return answer;
  };
  const device = async ({ code, keys, date, sealing }, kind, starter) => {
    const open = await storeOf({ world: keys.world, kind, code, date, starter });
    const held = { world: keys.world, keys, sealing };
    return { ...open, held, signer: signerOf(keys) };
  };
  return {
    stage: { kit, send, reference, paper: new Map() },
    leave: leaveWorldNetwork,
    async startWorld(_server, kind) {
      leaveWorldNetwork();
      const started = await startSeededWorld(kind, reference.calendar, reference, kit, send);
      return device(started, kind, started.starter);
    },
    async joinWorld(_server, code) {
      leaveWorldNetwork();
      const joined = await joinWorld(code, kit, send);
      return device({ ...joined, code }, joined.keys.kind, null);
    },
    async moveDate(_server, device) {
      const { world, starter } = device;
      if (starter !== null) {
        device.date = await moveWorldDate(world, starter, device.date, send);
        return { status: 200, date: device.date };
      }
      const answer = await send({ method: 'POST', path: `/worlds/${world}/date` });
      return { status: answer.status, date: null };
    },
    async dateOf(_server, { world }) {
      const answer = await send({ method: 'GET', path: `/worlds/${world}/date` });
      if (answer.status !== 200) throw new Error(`Reading the date: the demo server answered ${answer.status}`);
      return answer.body.date;
    },
  };
}
