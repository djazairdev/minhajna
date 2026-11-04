// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Loading the PDF engine can fail apart from the PDF: offline, or when the
// host has moved past the installed build. Each case is told from a PDF that
// can't be opened. The worker is a stand-in; the bytes are made up.

import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { engine, openBytes } from '../src/native/PdfSource.ts';
import { pdfFixture } from './pdf-fixture.ts';

class StandIn extends EventTarget {
  static last: StandIn | undefined;
  terminated = false;
  constructor() {
    super();
    StandIn.last = this;
  }
  postMessage() {}
  terminate() {
    this.terminated = true;
  }
}

const real = Reflect.get(globalThis, 'Worker') as unknown;
afterEach(() => {
  Reflect.set(globalThis, 'Worker', real);
  mock.timers.reset();
});

const settle = () => new Promise((done) => setImmediate(done));

test('an engine that can’t be imported, or never arrives, is E_PDF_ENGINE, and the bytes are wiped', async () => {
  await assert.rejects(
    engine(() => Promise.reject(new Error('Made-up offline'))),
    { message: 'E_PDF_ENGINE' },
  );
  const data = pdfFixture();
  await assert.rejects(
    openBytes(data, 0, () => Promise.reject(new Error('Made-up offline'))),
    { message: 'E_PDF_ENGINE' },
  );
  assert.ok(data.every((byte) => byte === 0));
  mock.timers.enable({ apis: ['setTimeout'] });
  const waiting = engine(() => new Promise(() => undefined));
  mock.timers.tick(30000);
  await assert.rejects(waiting, { message: 'E_PDF_ENGINE' });
});

test('a worker that fails before it has said anything is E_PDF_ENGINE', async () => {
  Reflect.set(globalThis, 'Worker', StandIn);
  const opening = openBytes(pdfFixture(), 0);
  await settle();
  StandIn.last!.dispatchEvent(new Event('error'));
  await assert.rejects(opening, { message: 'E_PDF_ENGINE' });
  for (let waited = 0; waited < 50 && !StandIn.last!.terminated; waited += 1)
    await new Promise((done) => setTimeout(done, 20));
  assert.equal(StandIn.last!.terminated, true);
});

test('a worker that started and then fails is a PDF that can’t be opened', async () => {
  Reflect.set(globalThis, 'Worker', StandIn);
  const opening = openBytes(pdfFixture(), 0);
  await settle();
  StandIn.last!.dispatchEvent(new MessageEvent('message', { data: 'ready' }));
  StandIn.last!.dispatchEvent(new Event('error'));
  await assert.rejects(opening, { message: 'E_PDF_OPEN' });
});
