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
import { makeWorldCode } from '@minhajna/core';
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
  return {
    stage: { paper: new Map() },
    left: 0,
    leave() {
      this.left += 1;
    },
    startWorld: async () => ({ code: 'CODE', kind: 'national', signer: 'S', date: days.date, starter: 'T' }),
    joinWorld: async () => ({ code: 'CODE', kind: 'national', signer: 'S', date: days.date }),
    moveDate: async (_server, device) => {
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
      note: async (_stage, device, step) => {
        device.notes = (device.notes ?? 0) + 1;
        seen.push([step.as, step.who, device.date, device.notes]);
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
      ['teacher', 'a', days.date, 1],
      ['teacher', 'a', days.announcedDays[0], 2],
      ['teacher', 'b', days.announcedDays[0], 1],
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

  it('names a start, a join, a move or a see that fails, as it does its own steps', async () => {
    const failing = (name) => ({
      ...standIn(),
      [name]: async () => {
        throw Object.assign(new Error('It stopped'), { code: 'E_MADE_UP' });
      },
    });
    const steps = [
      { as: 'ministry', do: 'start' },
      { as: 'teacher', do: 'join' },
      { as: 'teacher', do: 'see', day: 0 },
      { as: 'ministry', do: 'move', expect: 'moved' },
    ];
    const scenario = { ...base, steps };
    const cases = [
      ['startWorld', 1, 'ministry start'],
      ['joinWorld', 2, 'teacher join'],
      ['dateOf', 3, 'teacher see day 0'],
      ['moveDate', 4, 'ministry move \\(moved\\)'],
    ];
    for (const [name, step, words] of cases) {
      await assert.rejects(
        runScenario(scenario, 'http://demo', { access: failing(name), days }),
        new RegExp(`^Error: Own, step ${step} \\(${words}\\): E_MADE_UP: It stopped$`),
      );
    }
    const cause = await runScenario(scenario, 'http://demo', { access: failing('joinWorld'), days }).catch((e) => e);
    assert.equal(cause.cause.code, 'E_MADE_UP');
  });

  it('says what a step is about, and refuses to take a join with no signer as the world’s', async () => {
    const said = [];
    const actions = { note: async () => {} };
    const steps = [
      { as: 'ministry', do: 'start' },
      { as: 'ministry', do: 'note', of: 'a', version: 1, expect: 'behind' },
      { as: 'teacher', do: 'join' },
    ];
    await runScenario({ ...base, steps, actions }, 'http://demo', {
      access: standIn(),
      days,
      say: (one) => said.push(one),
    });
    assert.equal(said[1], '2. ministry note of a version 1 (behind): ok');
    const unsigned = { ...standIn(), startWorld: async () => ({ code: 'C', kind: 'national' }) };
    unsigned.joinWorld = async () => ({ code: 'C', kind: 'national' });
    await assert.rejects(
      runScenario({ ...base, steps: [steps[0], steps[2]] }, 'http://demo', { access: unsigned, days }),
      /its signer is not the one/,
    );
  });

  it('starts from the date the world says it started on, and its own access with its name', async () => {
    const asked = [];
    const seen = [];
    const steps = [
      { as: 'ministry', do: 'start' },
      { as: 'ministry', do: 'note' },
    ];
    const access = (server, seed) => {
      asked.push([server, seed]);
      return {
        ...standIn(),
        startWorld: async () => ({ code: 'C', kind: 'national', signer: 'S', date: '2027-01-01', starter: 'T' }),
      };
    };
    const actions = { note: async (_stage, device) => seen.push(device.date) };
    await runScenario({ ...base, steps, actions, access }, 'http://demo', { days });
    assert.deepEqual(asked, [['http://demo', 'Own']]);
    assert.deepEqual(seen, ['2027-01-01']);
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
    const twice = seededKit('a world');
    assert.notDeepEqual(twice.random(16), twice.random(16));
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
    await assert.rejects(appModule('demo/DemoBand.tsx'), { code: 'ERR_UNKNOWN_FILE_EXTENSION' });
  });

  it('holds no native module: a module of the platform answers nothing, and is not a promise', async () => {
    const { default: signature } = await appModule('native/NativeMinhajnaSignature.ts');
    assert.equal(signature.qrMatrix('made-up'), null);
    assert.equal(signature.then, undefined);
    assert.equal(await signature, signature);
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
    const device = { world: WORLD, starter, date: '2026-12-17' };
    assert.deepEqual(await access.moveDate('', device), { status: 200, date: '2027-02-18' });
    assert.equal(device.date, '2027-02-18');
    assert.deepEqual(asked, [
      ['http://127.0.0.1:3999/worlds/K1MT1/date', 'GET', PASS, undefined],
      ['http://127.0.0.1:3999/worlds/K1MT1/date', 'POST', PASS, `Bearer ${starter}`],
    ]);
    access.leave();
  });

  it('throws a date the app would not take, for a device that moves it', async () => {
    const access = appAccess('http://127.0.0.1:3999', 'Client', answering([], 200, { date: '2026-01-01' }));
    leaveWorldNetwork();
    enterWorldNetwork(WORLD, PASS);
    const device = { world: WORLD, starter: 'starter-of-a-made-up-world', date: '2026-12-17' };
    await assert.rejects(access.moveDate('', device));
    access.leave();
  });

  it('says to clear the database when the seeded world is taken, and shuts the last world to join', async () => {
    const access = appAccess('http://127.0.0.1:3999', 'Client', answering([], 409, {}));
    leaveWorldNetwork();
    await assert.rejects(access.startWorld('', 'national'), /--fresh/);
    leaveWorldNetwork();
    enterWorldNetwork(WORLD, PASS);
    const missing = appAccess('http://127.0.0.1:3999', 'Client', answering([], 404, {}));
    await assert.rejects(missing.joinWorld('', makeWorldCode(seededKit('Code').random)), { code: 'E_NO_SUCH_WORLD' });
    missing.leave();
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
