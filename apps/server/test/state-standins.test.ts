// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The stand-in receiving system (#590, answer 618): each world's own receiving
// key, marked a stand-in's, only with the pass; a term export the core's
// certificates certify, signed by the teacher's key and sealed for it step by
// step as the app seals a key to a device, opened, marks with two decimals, a
// pupil absent from the exam with no average, and an export with no formula and
// no averages included, kept only as a receipt that names no pupil, the same
// receipt for the same export sent again, the receipts listed newest first;
// refused with nothing kept when sealed for another world or kind, signed by a
// key another world certified or by another key, altered, shaped otherwise in
// any field, an average missing under a formula, given without one or beside an
// absence, or with more than two decimals, and an absence from T included, or
// not base64; absences refused while a world records no roll call; a delivery
// refused before any key was made making none; the largest export of the shape
// taken over HTTP and a longer text refused; the cap of receipts, erased with
// the world; and its requests counted with the other world requests. The server
// does not depend on the core, so the test loads its certify.ts at run time, as
// Node strips its types. Every world, pupil, mark and teacher here is made up.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { NestNodeApplication } from '@nestjs/platform-node';
import { createApp } from '../src/app.js';
import { MAX_TEXT } from '../src/state-standins/term-export-read.js';
import { MAX_RECEIPTS, MemoryWorldStore } from '../src/worlds/world-store.js';
import {
  freshId,
  OPEN,
  PASS,
  row,
  seal,
  signer,
  termExport,
  WITH_PASS,
  type Certificate,
  type Core,
} from './state-kit.js';

describe('the stand-in receiving system', () => {
  let app: NestNodeApplication;
  let base: string;
  let core: Core;
  const store = new MemoryWorldStore();
  const teacher = signer();

  async function start(): Promise<string> {
    const world = freshId();
    const res = await fetch(`${base}/worlds`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ world, sealed: 'c2VhbGVkLXdvcmxk', date: '2026-12-01', announcedDays: [], pass: PASS }),
    });
    assert.equal(res.status, 201);
    return world;
  }

  const get = (world: string, path: string, headers: Record<string, string> = WITH_PASS) =>
    fetch(`${base}/worlds/${world}/state/${path}`, { headers });

  async function point(world: string): Promise<string> {
    return ((await (await get(world, 'receiver')).json()) as { publicKey: string }).publicKey;
  }

  async function certificate(world: string, who = teacher): Promise<Certificate> {
    const request = await core.certificateRequest(world, randomBytes(16).toString('hex'), who);
    const res = await fetch(`${base}/worlds/${world}/certificates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...WITH_PASS },
      body: JSON.stringify(request),
    });
    return (await res.json()) as Certificate;
  }

  /** The teacher's export signed under its certificate, as the device signs it. */
  async function signed(text: string, key: Certificate, who = teacher) {
    const { world, subject, publicKey, serial } = key;
    const signature = await who.sign(
      `minhajna/signed-export/1\n${world}\n${subject}\n${publicKey}\n${serial}\n${text}`,
    );
    return { text, signature, certificate: key };
  }

  function deliver(world: string, body: unknown, headers: Record<string, string> = WITH_PASS) {
    return fetch(`${base}/worlds/${world}/state/deliveries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  /** A delivery of the signed export, sealed for the world's receiving key under the kind. */
  async function sealed(world: string, delivery: unknown, kind = 'marks', to = world) {
    const info = `minhajna/state-delivery/1\n${to}\n${kind}`;
    return { kind, sealed: seal(Buffer.from(JSON.stringify(delivery), 'utf8'), await point(to), info) };
  }

  const receipts = async (world: string) =>
    ((await (await get(world, 'deliveries')).json()) as { receipts: Record<string, unknown>[] }).receipts;

  before(async () => {
    const certifyTs = new URL('../../../../packages/core/src/certify.ts', import.meta.url);
    core = (await import(certifyTs.href)) as Core;
    app = await createApp(false, { store, starts: OPEN, joins: OPEN });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it('gives each world its own receiving key, marked a stand-in’s, only with the pass', async () => {
    const [one, two] = [await start(), await start()];
    const res = await get(one, 'receiver');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const read = (await res.json()) as { standIn: boolean; publicKey: string };
    assert.equal(read.standIn, true);
    assert.match(read.publicKey, /^04[0-9a-f]{128}$/);
    assert.equal(await point(one), read.publicKey);
    assert.notEqual(await point(two), read.publicKey);
    assert.equal((await get(one, 'receiver', { 'x-world-pass': PASS.replace(/^c/, 'd') })).status, 404);
    assert.equal((await get(one, 'receiver', {})).status, 404);
    assert.equal((await get('ZZZZZ', 'receiver')).status, 404);
  });

  it('opens a signed export sealed for it, keeps only its receipt, and lists receipts newest first', async () => {
    const world = await start();
    const key = await certificate(world);
    const first = await deliver(world, await sealed(world, await signed(JSON.stringify(termExport(world)), key)));
    assert.equal(first.status, 201);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    const receipt = (await first.json()) as Record<string, unknown>;
    const { id, ...rest } = receipt;
    assert.match(String(id), /^[0-9a-f]{32}$/);
    assert.deepEqual(rest, {
      standIn: true,
      kind: 'marks',
      term: 1,
      class: '1م2',
      subject: 'math',
      rows: 2,
      signed: '2026-11-29',
      received: '2026-12-01',
      signer: key.subject,
    });
    const decimals = {
      ...row('MADE-UP-0003'),
      values: { T: 9.3, F: 16.4, E: 15.75 },
      average: 14.78,
    };
    const absent = { ...row('MADE-UP-0005'), values: { T: 10, F: 12, E: 'absent' }, average: null };
    const second = termExport(world, { term: 2, rows: [decimals, absent] });
    assert.equal((await deliver(world, await sealed(world, await signed(JSON.stringify(second), key)))).status, 201);
    const unaveraged = termExport(world, { term: 3, formula: null, rows: [{ ...row('MADE-UP-0004'), average: null }] });
    assert.equal(
      (await deliver(world, await sealed(world, await signed(JSON.stringify(unaveraged), key)))).status,
      201,
    );
    const again = await deliver(world, await sealed(world, await signed(JSON.stringify(termExport(world)), key)));
    assert.deepEqual([again.status, await again.json()], [200, receipt]);
    const listed = await receipts(world);
    assert.deepEqual(
      listed.map((one) => [one['term'], one['rows']]),
      [
        [3, 1],
        [2, 2],
        [1, 2],
      ],
    );
    assert.deepEqual(listed[2], receipt);
    assert.equal(JSON.stringify(listed).includes('MADE-UP'), false);
    assert.deepEqual(await receipts(await start()), []);
  });

  it('refuses what is not sealed for it, not signed by a key its world certified, or not an export', async () => {
    const world = await start();
    const elsewhere = await start();
    const key = await certificate(world);
    const text = JSON.stringify(termExport(world));
    const good = await signed(text, key);
    const theirs = await signed(text, await certificate(elsewhere));
    const rows = Array.from({ length: 81 }, (_, at) => row(`MADE-UP-${String(at).padStart(4, '0')}`));
    const shapes: Record<string, unknown>[] = [
      { format: 'minhajna/term-export/2' },
      { world: elsewhere },
      { term: 4 },
      { subject: 'Maths' },
      { signed: '2026-12-02' },
      { scale: 0 },
      { parts: ['E', 'E'] },
      { parts: ['T', 'F', 'É'] },
      { parts: ['T', 'F', 'X'] },
      { formula: 'made-up' },
      { formula: 'CEM' },
      { formula: null },
      { rows },
      { rows: [row('MADE-UP-0001'), row('MADE-UP-0001')] },
      { rows: [{ ...row('MADE-UP-0001'), values: { T: 21, F: 1, E: 1 } }] },
      { rows: [{ ...row('MADE-UP-0001'), values: { T: 1, F: null, E: 1 } }] },
      { rows: [{ ...row('MADE-UP-0001'), average: null }] },
      { rows: [{ ...row('MADE-UP-0001'), values: { T: 1, F: 1, E: 'absent' } }] },
      { rows: [{ ...row('MADE-UP-0001'), values: { T: 'absent', F: 1, E: 1 }, average: null }] },
      { rows: [{ ...row('MADE-UP-0001'), average: 13.9166 }] },
      { rows: [{ ...row('MADE-UP-0001'), appreciation: '' }] },
      { rows: [{ ...row('MADE-UP-0001'), name: 'تلميذ مختلق' }] },
      { extra: true },
    ];
    const bodies = [
      await sealed(world, good, 'marks', elsewhere),
      { ...(await sealed(world, good, 'absences')), kind: 'marks' },
      await sealed(world, theirs),
      await sealed(world, { ...good, text: JSON.stringify(termExport(world, { term: 2 })) }),
      await sealed(world, await signed(text, key, signer())),
      await sealed(world, { ...good, extra: 1 }),
      { ...(await sealed(world, good)), extra: 1 },
      { kind: 'marks', sealed: 'not base64!' },
      { kind: 'grades', sealed: '' },
    ];
    for (const shape of shapes)
      bodies.push(await sealed(world, await signed(JSON.stringify(termExport(world, shape)), key)));
    for (const body of bodies)
      assert.equal((await deliver(world, body)).status, 400, JSON.stringify(body).slice(0, 120));
    const absences = await deliver(world, await sealed(world, good, 'absences'));
    assert.equal(absences.status, 422);
    assert.match(((await absences.json()) as { message: string }).message, /roll call/);
    assert.equal((await deliver(world, await sealed(world, good), {})).status, 404);
    assert.deepEqual(await receipts(world), []);
  });

  it('keeps at most its cap of receipts for a world, and erases them with the world', async () => {
    const world = await start();
    const key = await certificate(world);
    const kept = { standIn: true as const, kind: 'marks' as const, term: 1, class: '1م2', subject: 'math', rows: 1 };
    const filler = { ...kept, signed: '2026-11-29', received: '2026-12-01', signer: key.subject };
    for (let made = 0; made < MAX_RECEIPTS; made += 1) {
      await store.addReceipt(world, { ...filler, id: made.toString(16).padStart(32, '0') });
    }
    const full = await deliver(world, await sealed(world, await signed(JSON.stringify(termExport(world)), key)));
    assert.equal(full.status, 409);
    await store.sweep('2026-12-07');
    assert.equal((await get(world, 'deliveries')).status, 404);
    assert.deepEqual(await store.receipts(world), []);
  });

  it('takes the largest export it allows, refuses a longer text, and makes no key for what it refuses', async () => {
    const world = await start();
    const unopened = { kind: 'marks', sealed: randomBytes(120).toString('base64') };
    assert.equal((await deliver(world, unopened)).status, 400);
    assert.deepEqual([await store.receiverKey(world), await store.caKey(world)], [undefined, undefined]);
    const key = await certificate(world);
    const parts = ['T', 'F', 'E', 'P', 'O'];
    const values = Object.fromEntries(parts.map((part) => [part, part === 'T' || part === 'F' ? 12.25 : 'absent']));
    const appreciation = 'مختلق'.repeat(40);
    const rows = Array.from({ length: 80 }, (_, at) => ({
      ...row(`MADE-UP-${String(at).padStart(24, '0')}`),
      values,
      average: null,
      appreciation,
    }));
    const largest = JSON.stringify(termExport(world, { parts, rows, class: 'ق'.repeat(32) }));
    assert.ok(Buffer.byteLength(largest, 'utf8') <= MAX_TEXT && Buffer.byteLength(largest, 'utf8') > 40_000);
    assert.equal((await deliver(world, await sealed(world, await signed(largest, key)))).status, 201);
    const longer = await deliver(world, await sealed(world, await signed('"'.repeat(MAX_TEXT + 1), key)));
    assert.match(((await longer.json()) as { message: string }).message, /bytes/);
  });

  it('counts its requests with the other world requests', async () => {
    const limited = await createApp(false, { joins: { perAddress: 2, total: 1000, windowMs: 60_000 } });
    await limited.listen(0, '127.0.0.1');
    try {
      const url = await limited.getUrl();
      const answers = [];
      const asked = [
        ['GET', 'receiver'],
        ['GET', 'deliveries'],
        ['POST', 'deliveries'],
      ] as const;
      for (const [method, path] of asked) {
        answers.push((await fetch(`${url}/worlds/S9999/state/${path}`, { method, headers: WITH_PASS })).status);
      }
      assert.deepEqual(answers, [404, 404, 429]);
    } finally {
      await limited.close();
    }
  });
});
