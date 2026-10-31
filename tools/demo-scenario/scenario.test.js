// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo scenarios (#629), against a stand-in for the demo server's worlds
// API on this machine, which keeps the pass and the starter token hashed as
// the server does and can be told to answer a request otherwise: the sample
// passes step by step and moves the date once; a start retries a taken ID and
// gives up after three; an answer the app would not take, keys that do not
// open, and a world of another kind or signer fail; a step that sees another
// date, or a move the server answers otherwise, fails naming the step; a
// scenario that cannot run is refused before anything is sent; the roles,
// the kinds and the signer's holder are the app's; a new world's days come
// from the bundled calendar; the command checks its options and the health
// check; and CI runs the scenarios against `npm run demo` on a database the
// demo may empty.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import process from 'node:process';
import { after, before, beforeEach, describe, it } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { WORLD_KINDS } from '@minhajna/core';
import { clearing } from '../demo/clear.js';
import { ROLES, runScenario, SAMPLE, scenarioProblem } from './scenario.js';
import * as access from './world.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const hash = (text) =>
  createHash('sha256')
    .update(text ?? '')
    .digest('hex');
const worlds = new Map();
const requests = [];
const forced = [];
const start = { as: 'ministry', do: 'start' };

/** The worlds API as the demo server answers it, in memory. */
function answer(method, path, headers, body) {
  const [, id, date] = /^\/worlds(?:\/([^/]+))?(\/date)?$/.exec(path) ?? [];
  if (method === 'POST' && id === undefined) {
    if (worlds.has(body.world)) return [409, {}];
    const starter = `starter-${body.world}-token`;
    worlds.set(body.world, { ...body, passHash: hash(body.pass), starterHash: hash(starter), moves: 0 });
    return [201, { starter }];
  }
  const world = worlds.get(id);
  if (world === undefined || hash(headers['x-world-pass']) !== world.passHash) return [404, {}];
  if (method === 'GET') return [200, date ? { date: world.date } : { sealed: world.sealed, date: world.date }];
  if (hash(headers.authorization?.replace(/^Bearer /, '')) !== world.starterHash) return [403, {}];
  const next = world.announcedDays.find((day) => day > world.date);
  if (next === undefined) return [409, {}];
  Object.assign(world, { date: next, moves: world.moves + 1 });
  return [200, { date: next }];
}

const server = createServer((request, response) => {
  let text = '';
  request.on('data', (chunk) => (text += chunk));
  request.on('end', () => {
    const asked = `${request.method} ${request.url}`;
    requests.push(asked);
    const at = forced.findIndex((one) => one.match.test(asked));
    const given = at < 0 ? null : forced.splice(at, 1)[0].answer;
    const [status, body] =
      given ?? answer(request.method, request.url, request.headers, text ? JSON.parse(text) : null);
    response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  });
});
let url;

/** Runs the command with its arguments: its exit code and what it wrote to stderr. */
function command(...args) {
  const run = fileURLToPath(new URL('run.js', import.meta.url));
  return new Promise((done) => {
    execFile(process.execPath, [run, ...args], (error, _out, err) => done({ code: error?.code ?? 0, err }));
  });
}

before(async () => {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => {
  worlds.clear();
  forced.length = 0;
});

describe('demo scenarios', () => {
  it('runs the sample step by step, and the Ministry alone moves the date, once', async () => {
    const said = [];
    const sent = requests.length;
    await runScenario(SAMPLE, url, { say: (line) => said.push(line) });
    assert.equal(said.length, SAMPLE.steps.length);
    assert.equal(said[4], '5. teacher move (refused): ok');
    const [world] = worlds.values();
    assert.deepEqual([world.moves, world.date], [1, access.worldDays().announcedDays[0]]);
    assert.equal(requests.slice(sent).filter((one) => one.startsWith('POST /worlds/')).length, 2);
  });

  it('draws a new code for a taken ID, and gives up after three', async () => {
    forced.push({ match: /^POST \/worlds$/, answer: [409, {}] });
    const world = await access.startWorld(url, 'teachers');
    assert.ok(worlds.has(world.world));
    for (let tries = 0; tries < 3; tries += 1) forced.push({ match: /^POST \/worlds$/, answer: [409, {}] });
    await assert.rejects(access.startWorld(url, 'teachers'), /every code drawn was taken/);
  });

  it('refuses answers the app would not take, and keys that do not open', async () => {
    forced.push({ match: /^POST \/worlds$/, answer: [500, {}] });
    await assert.rejects(access.startWorld(url, 'national'), /Starting a world: the demo server answered 500/);
    const one = await access.startWorld(url, 'national');
    const other = await access.startWorld(url, 'national');
    worlds.get(one.world).sealed = worlds.get(other.world).sealed;
    await assert.rejects(access.joinWorld(url, one.code), /its sealed keys do not open with its code/);
    forced.push({ match: /^GET \/worlds\/[^/]+$/, answer: [404, {}] });
    await assert.rejects(access.joinWorld(url, other.code), /Joining a world: the demo server answered 404/);
    forced.push({ match: /\/date$/, answer: [500, {}] });
    await assert.rejects(access.dateOf(url, other), /Reading the date: the demo server answered 500/);
    const joined = { ...other };
    delete joined.starter;
    assert.deepEqual(await access.joinWorld(url, other.code), joined);
  });

  it('fails when a joined world is of another kind or signer', async () => {
    const steps = [start, { as: 'teacher', do: 'join' }];
    for (const [change, problem] of [
      [{ kind: 'teachers' }, /step 2 \(teacher join\): the world is of kind teachers/],
      [{ signer: 'f'.repeat(64) }, /step 2 \(teacher join\): its signer is not the one the world was started with/],
    ]) {
      const joinWorld = async (...args) => ({ ...(await access.joinWorld(...args)), ...change });
      const scenario = { name: 'Other', kind: 'national', steps };
      await assert.rejects(runScenario(scenario, url, { access: { ...access, joinWorld } }), problem);
    }
  });

  it('fails at a step that sees another date, naming it', async () => {
    const early = { ...SAMPLE, steps: [SAMPLE.steps[0], SAMPLE.steps[2], { as: 'teacher', do: 'see', day: 1 }] };
    await assert.rejects(runScenario(early, url), /step 3 \(teacher see\): sees \d{4}-\d{2}-\d{2}, not /);
  });

  it('fails at a move the server answers otherwise, as when no announced day is left', async () => {
    const steps = [{ as: 'teacher', do: 'start' }, ...Array(2).fill({ as: 'teacher', do: 'move', expect: 'moved' })];
    const days = { date: '2027-01-10', announcedDays: ['2027-03-20'] };
    await assert.rejects(
      runScenario({ name: 'Twice', kind: 'teachers', steps }, url, { days }),
      /step 3 \(teacher move\): expected moved, the server answered 409/,
    );
  });

  it('refuses a scenario that cannot run before sending anything', async () => {
    const sent = requests.length;
    const cases = [
      [{ kind: 'regional', steps: [] }, 'no world is of kind regional'],
      [
        { kind: 'national', steps: [{ as: 'observatory', do: 'start' }] },
        'step 1: a national world has no role observatory',
      ],
      [{ kind: 'national', steps: [{ as: 'teacher', do: 'join' }, start] }, 'step 1: the world is not started yet'],
      [{ kind: 'national', steps: [start, start] }, 'step 2: the world is already started'],
      [{ kind: 'national', steps: [start, { as: 'ministry', do: 'erase' }] }, 'step 2: no step does erase'],
      [{ kind: 'national', steps: [start, { as: 'teacher', do: 'see', day: 0 }] }, 'step 2: teacher has not joined'],
      [
        { kind: 'national', steps: [start, { as: 'teacher', do: 'move', expect: 'refused' }] },
        'step 2: teacher has not joined',
      ],
      [{ kind: 'national', steps: [start, { as: 'ministry', do: 'move' }] }, 'step 2: a move expects moved or refused'],
      [
        { kind: 'national', steps: [start, { as: 'ministry', do: 'see', day: -1 }] },
        'step 2: see needs a day, 0 or more',
      ],
    ];
    for (const [scenario, problem] of cases) assert.equal(scenarioProblem(scenario), problem);
    for (const [scenario] of cases) await assert.rejects(runScenario({ name: 'Bad', ...scenario }, url), RangeError);
    assert.equal(requests.length, sent);
  });

  it('knows the kinds of world, their roles and the signer’s holder as the app does', () => {
    assert.deepEqual(Object.keys(ROLES), [...WORLD_KINDS]);
    const modes = read('apps/android/src/demo/world-mode.ts');
    for (const [kind, roles] of Object.entries(ROLES)) {
      assert.deepEqual(new RegExp(`${kind}: \\[([^\\]]*)\\]`).exec(modes)?.[1].match(/[a-z]+/g), roles);
    }
    const session = read('apps/android/src/demo/world-session.ts');
    for (const [language, words] of Object.entries(access.HOLDER))
      assert.ok(session.includes(`${language}: '${words}'`));
  });

  it('dates a new world from the bundled calendar, its announced days after it, in order', () => {
    const { date, announcedDays } = access.worldDays();
    assert.ok(announcedDays.length > 0 && announcedDays.every((day) => day > date));
    assert.deepEqual(announcedDays, [...new Set(announcedDays)].sort());
  });

  it('checks its options and the server’s health check', async () => {
    assert.deepEqual(await command('--wait', '0'), { code: 1, err: '--wait takes a whole number of seconds\n' });
    const closed = createServer();
    await new Promise((done) => closed.listen(0, '127.0.0.1', done));
    const nowhere = `http://127.0.0.1:${closed.address().port}`;
    await new Promise((done) => closed.close(done));
    assert.deepEqual(await command('--server', nowhere, '--wait', '1'), {
      code: 1,
      err: `${nowhere} did not answer /health\n`,
    });
  });

  it('runs with the root tests, and in CI against npm run demo on a database it may empty', () => {
    assert.match(JSON.parse(read('package.json')).scripts.test, /tools\/demo-scenario\/\*\.test\.js/);
    const workflow = read('.github/workflows/test.yml');
    assert.match(workflow, /npm run demo -- --fresh &.*\n(.*\n)*?\s+node tools\/demo-scenario\/run\.js --wait \d+/);
    const database = /MINHAJNA_DEMO_DATABASE: (\S+)/.exec(workflow)?.[1];
    assert.equal(typeof clearing(database ?? ''), 'string');
    assert.match(
      workflow,
      new RegExp(`createdb .*${new URL(database).pathname.slice(1)}\\n\\s+npm run demo -- --fresh &`),
    );
  });
});
