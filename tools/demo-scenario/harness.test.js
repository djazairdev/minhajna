// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the scenarios at the school and above it stand on (#630, answer 722): a
// scenario's own steps run in order on each person's device, on the date its
// last move gave, and one that fails names itself with its code; each is
// refused before it runs when its person has not joined; a seeded kit draws the
// same bytes for a seed and others for another; the kit signs in the phone's
// DER form and agrees a secret both sides share; the app's modules load in
// Node, a path naming its file or none; and a device reaches the server through
// the app's own client, its pass going with each request and the date's answers
// read as the harness reads them. Every world here is made up.

import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { appFile, appModule } from './app.js';
import { appAccess } from './device.js';
import { seededKit, worldKit } from './kit.js';
import { runScenario, scenarioProblem } from './scenario.js';

const { leaveWorldNetwork, enterWorldNetwork } = await appModule('network/world-network.ts');
const days = { date: '2026-12-17', announcedDays: ['2027-02-18'] };
const here = fileURLToPath(new URL('.', import.meta.url));
const app = resolve(here, '../../apps/android/src');

/** A stand-in for how a scenario's devices meet a server, counting what it is asked. */
function standIn() {
  const moves = [];
  return {
    moves,
    stage: { paper: new Map() },
    left: 0,
    leave() {
      this.left += 1;
    },
    startWorld: async () => ({ code: 'CODE', kind: 'national', signer: 'S', date: days.date, starter: 'T' }),
    joinWorld: async () => ({ code: 'CODE', kind: 'national', signer: 'S', date: days.date }),
    moveDate: async (_server, device) => {
      moves.push(device);
      return device.starter ? { status: 200, date: days.announcedDays[0] } : { status: 403, date: null };
    },
    dateOf: async () => days.date,
  };
}

after(() => leaveWorldNetwork());

describe('a scenario’s own steps', () => {
  const base = { name: 'Own', kind: 'national' };

  it('runs them on each person’s device, on the date its last move gave', async () => {
    const seen = [];
    const actions = {
      note: async (stage, device, step) => {
        device.notes = (device.notes ?? 0) + 1;
        seen.push([step.as, step.who, device.date, device.notes, stage.paper.size]);
      },
    };
    const steps = [
      { as: 'ministry', do: 'start' },
      { as: 'teacher', who: 'a', do: 'join' },
      { as: 'teacher', who: 'b', do: 'join' },
      { as: 'teacher', who: 'a', do: 'note' },
      { as: 'ministry', do: 'move', expect: 'moved' },
      { as: 'teacher', who: 'a', do: 'note' },
      { as: 'teacher', who: 'b', do: 'note' },
    ];
    const said = [];
    const access = standIn();
    await runScenario({ ...base, steps, actions }, 'http://demo', { access, days, say: (one) => said.push(one) });
    assert.deepEqual(seen, [
      ['teacher', 'a', days.date, 1, 0],
      ['teacher', 'a', days.announcedDays[0], 2, 0],
      ['teacher', 'b', days.announcedDays[0], 1, 0],
    ]);
    assert.equal(said[3], '4. teacher:a note: ok');
    assert.equal(access.left, 1);
  });

  it('names the step that fails, with its code, and still leaves the world', async () => {
    const actions = {
      fails: async () => {
        throw Object.assign(new Error('The school said no'), { code: 'E_SCHOOL' });
      },
      plain: async () => {
        throw new Error('It reads otherwise');
      },
    };
    const start = { as: 'ministry', do: 'start' };
    const scenario = (one) => ({ ...base, actions, steps: [start, one] });
    const access = standIn();
    await assert.rejects(
      runScenario(scenario({ as: 'ministry', do: 'fails' }), 'http://demo', { access, days }),
      /^Error: Own, step 2 \(ministry fails\): E_SCHOOL: The school said no$/,
    );
    assert.equal(access.left, 1);
    await assert.rejects(
      runScenario(scenario({ as: 'ministry', do: 'plain' }), 'http://demo', { access, days }),
      /^Error: Own, step 2 \(ministry plain\): It reads otherwise$/,
    );
  });

  it('refuses one whose person has not joined, or that no one knows, before it runs', () => {
    const actions = { note: async () => {} };
    const steps = [
      { as: 'ministry', do: 'start' },
      { as: 'teacher', who: 'a', do: 'join' },
      { as: 'teacher', who: 'b', do: 'note' },
    ];
    assert.equal(scenarioProblem({ ...base, steps, actions }), 'step 3: teacher:b has not joined');
    const named = [steps[0], { as: 'ministry', do: 'toString' }];
    assert.equal(scenarioProblem({ ...base, steps: named, actions }), 'step 2: no step does toString');
    const late = [steps[0], { as: 'teacher', who: 'a', do: 'see', day: 0 }];
    assert.equal(scenarioProblem({ ...base, steps: late, actions }), 'step 2: teacher:a has not joined');
  });
});

describe('the kit', () => {
  it('draws the same bytes for a seed, others for another, and as many as asked', () => {
    const [one, same, other] = [seededKit('a world'), seededKit('a world'), seededKit('another')];
    assert.deepEqual(one.random(40), same.random(40));
    assert.deepEqual(one.random(5), same.random(5));
    assert.notDeepEqual(seededKit('a world').random(16), other.random(16));
    assert.equal(seededKit('a world').random(100).length, 100);
    assert.notDeepEqual(worldKit.random(16), worldKit.random(16));
  });

  it('signs in the phone’s DER form, checked with the key’s other half only', async () => {
    const [pair, other] = [await worldKit.newPair(), await worldKit.newPair()];
    const signature = await worldKit.sign(pair.pkcs8, 'a made-up text');
    assert.equal(Buffer.from(signature, 'base64')[0], 0x30);
    assert.equal(await worldKit.verify(pair.spki, 'a made-up text', signature), true);
    assert.equal(await worldKit.verify(pair.spki, 'another text', signature), false);
    assert.equal(await worldKit.verify(other.spki, 'a made-up text', signature), false);
  });

  it('agrees one secret between two pairs, and refuses what is no point', async () => {
    const [a, b] = [await worldKit.newAgreement(), await worldKit.newAgreement()];
    assert.equal(a.publicKey.length, 65);
    assert.deepEqual(await worldKit.agree(a.pkcs8, b.publicKey), await worldKit.agree(b.pkcs8, a.publicKey));
    await assert.rejects(worldKit.agree(a.pkcs8, new Uint8Array(64)), RangeError);
  });
});

describe('the app’s modules in Node', () => {
  it('finds a relative path’s file, with or without its ending, or none', () => {
    const parent = pathToFileURL(resolve(app, 'demo/world-mode.ts')).href;
    assert.equal(appFile('./world-session', parent), resolve(app, 'demo/world-session.ts'));
    assert.equal(appFile('../text/ar.json', parent), resolve(app, 'text/ar.json'));
    assert.equal(appFile('./DemoBand', parent), null);
    assert.equal(appFile('./no-such-file', parent), null);
  });

  it('loads a session with its catalogues and reference, and no native module', async () => {
    const { catalogues } = await appModule('text/i18n.ts');
    assert.equal(typeof catalogues.en.demo.closure, 'string');
    const { bundledReference, readReference } = await appModule('reference.ts');
    assert.equal(readReference(bundledReference).ok, true);
    await assert.rejects(appModule('demo/DemoBand.tsx'));
  });
});

describe('a device through the app’s client', () => {
  const PASS = 'cGFzcy1mb3ItYS1tYWRlLXVwLWRlbW8td29ybGQtMDE';
  const WORLD = 'K1MT1';
  const answering = (asked, status, body) => async (address, init) => {
    asked.push([address, init.method, init.headers['X-World-Pass'], init.headers.Authorization]);
    return new globalThis.Response(JSON.stringify(body), { status });
  };

  it('reads the date and moves it at the given server, the pass going with each', async () => {
    const asked = [];
    const access = appAccess('http://127.0.0.1:3999', 'Client', answering(asked, 200, { date: '2027-02-18' }));
    leaveWorldNetwork();
    enterWorldNetwork(WORLD, PASS);
    assert.equal(await access.dateOf('', { world: WORLD }), '2027-02-18');
    const starter = 'starter-of-a-made-up-world';
    assert.deepEqual(await access.moveDate('', { world: WORLD, starter }), { status: 200, date: '2027-02-18' });
    assert.deepEqual(asked, [
      ['http://127.0.0.1:3999/worlds/K1MT1/date', 'GET', PASS, undefined],
      ['http://127.0.0.1:3999/worlds/K1MT1/date', 'POST', PASS, `Bearer ${starter}`],
    ]);
    access.leave();
  });

  it('says a refused move and a date it could not read', async () => {
    const access = appAccess('http://127.0.0.1:3999', 'Client', answering([], 403, {}));
    leaveWorldNetwork();
    enterWorldNetwork(WORLD, PASS);
    assert.deepEqual(await access.moveDate('', { world: WORLD, starter: null }), { status: 403, date: null });
    await assert.rejects(access.dateOf('', { world: WORLD }), /Reading the date: the demo server answered 403/);
    access.leave();
  });
});
