// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A directorate's request for an inspector's grant (#593, answer 621): read
// only when every field is of its shape, its classes once each by name key and
// its days in order, never with a fingerprint or a teacher; sealed for each
// holder, and only when it reads, travelling on its stream of the school's
// space, opened by every holder and by no other device, each request once,
// another school's, an envelope bound to another ID, one whose request inside
// names another ID or school and what does not open left out, and the stream
// showing by ID which envelopes reached it; its classes turned into the signed
// weeks in its range, course by course in the order of its classes and weeks,
// each once, under the epoch given, with the classes that name none; and the
// requests a directorate made read from its world's store, each once, under
// their own key. Every world, school, class and device here is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  courseId,
  envelopesFor,
  grantRequested,
  grantWeeksOf,
  openGrantEnvelopes,
  openGrantRequests,
  readGrantRequest,
  recordKey,
  requestPlace,
  requestsMade,
  toBase64Url,
  sealGrantEnvelope,
  sealGrantRequest,
  GRANT_REQUEST,
  GRANT_REQUEST_BATCHES,
  type GrantRequest,
} from '../src/index.ts';
import { ascii, fromHex } from '../src/school-key-shape.ts';
import { asciiJson, sealRecord } from '../src/sealed-stream.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { device, random } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const SPACE = 'made-up-school-space-one';

async function request(change: Partial<GrantRequest> = {}): Promise<GrantRequest> {
  const { holder } = await device();
  return {
    format: GRANT_REQUEST,
    id: '0123456789abcdef0123456789abcdef',
    world: 'K7QF4',
    school: SPACE,
    inspector: holder,
    label: 'Made-up inspector of district 3',
    subject: 'arabic',
    classes: ['4M1', '4M2'],
    weeks: { from: d('2029-09-30'), to: d('2029-11-15') },
    until: d('2029-11-27'),
    asked: d('2029-10-01'),
    ...change,
  };
}

describe('a grant request', () => {
  it('reads only when every field is of its shape', async () => {
    const good = await request();
    const bytes = good.inspector.publicKey.length / 2;
    assert.deepEqual(readGrantRequest(good, bytes), good);
    assert.deepEqual(readGrantRequest({ ...good, inspector: { ...good.inspector } }, bytes), good);
    const wrong: Record<string, unknown>[] = [
      { fingerprint: '0000-0000-0000-0000' },
      { teacher: 'A made-up teacher' },
      { label: ' padded label' },
      { label: `hidden${String.fromCharCode(0x200b)}label` },
      { label: 'x'.repeat(81) },
      { subject: 'a subject' },
      { classes: [] },
      { classes: Array.from({ length: 17 }, (_, at) => `4M${at}`) },
      { classes: ['4M1', '4m1'] },
      { classes: ['4M1', 4] },
      { weeks: { from: d('2029-11-16'), to: d('2029-11-15') } },
      { weeks: { from: d('2029-09-30'), to: d('2029-11-28') } },
      { weeks: { from: d('2029-09-30'), to: d('2029-11-15'), extra: 1 } },
      { asked: d('2029-11-28') },
      { world: 'world' },
      { id: 'not-an-id' },
    ];
    for (const change of wrong)
      assert.equal(readGrantRequest({ ...good, ...change }, bytes), null, JSON.stringify(change));
  });

  it('is opened by every holder of the school key, on its stream, and by no other device', async () => {
    const [first, second, stranger] = [await device(), await device(), await device()];
    const asked = await request();
    const other = await request({ id: 'fedcba9876543210fedcba9876543210', school: 'another-made-up-space' });
    const holders = [first.holder, second.holder];
    const envelope = await sealGrantRequest(asked, holders, first.crypto, random, cipher);
    assert.deepEqual(Object.keys(envelope.sealed).sort(), holders.map((one) => one.id).sort());
    const clear = { ...envelope, sealed: Object.keys(envelope.sealed), body: envelope.body.length > 0 };
    assert.doesNotMatch(JSON.stringify(clear), /Made-up|4M1|arabic/u);
    const swapped = { ...(await sealGrantRequest(other, holders, first.crypto, random, cipher)), id: asked.id };
    const elsewhere = await sealGrantRequest(other, holders, first.crypto, random, cipher);
    const place = await requestPlace(SPACE, mac);
    const batches = [];
    for (const one of [{ ...swapped, school: SPACE }, envelope, envelope, elsewhere, { format: 'other' }]) {
      batches.push(...(await sealRecord(place, one, batches.length, GRANT_REQUEST_BATCHES, cipher)));
    }
    const records = await openGrantEnvelopes(place, batches, cipher);
    assert.deepEqual([...envelopesFor(records, SPACE)], [asked.id]);
    const alone = await openGrantEnvelopes(place, await sealGrantEnvelope(place, envelope, 0, cipher), cipher);
    assert.deepEqual(alone, [envelope]);
    for (const one of [first, second]) {
      assert.deepEqual(await openGrantRequests(records, SPACE, one.holder.id, one.crypto, cipher), [asked]);
    }
    assert.deepEqual(await openGrantRequests(records, SPACE, stranger.holder.id, stranger.crypto, cipher), []);
    const stolen = { ...envelope, sealed: { [stranger.holder.id]: envelope.sealed[first.holder.id]! } };
    assert.deepEqual(await openGrantRequests([stolen], SPACE, stranger.holder.id, stranger.crypto, cipher), []);
    await assert.rejects(sealGrantRequest(asked, [], first.crypto, random, cipher), RangeError);
    for (const wrong of [
      { ...asked, classes: [] },
      { ...asked, inspector: { ...asked.inspector, publicKey: 'ab' } },
    ]) {
      await assert.rejects(sealGrantRequest(wrong, holders, first.crypto, random, cipher), RangeError);
    }
    const bound = `${GRANT_REQUEST}\n${SPACE}\n${asked.id}`;
    for (const inside of [
      { ...asked, id: other.id },
      { ...asked, school: 'another-made-up-space' },
    ]) {
      const content = random(32);
      const forged = {
        format: 'minhajna/grant-envelope/1',
        school: SPACE,
        id: asked.id,
        sealed: {
          [first.holder.id]: toBase64Url(await first.crypto.seal(content, fromHex(first.holder.publicKey), bound)),
        },
        body: toBase64Url(await cipher.seal(content, ascii(asciiJson(inside)), ascii(bound))),
      };
      assert.deepEqual(await openGrantRequests([forged], SPACE, first.holder.id, first.crypto, cipher), []);
    }
  });

  it('names the signed weeks in its range, class by class, and the classes with none', async () => {
    const asked = await request({ classes: ['4M2', '4M1', '4M3'] });
    const [one, two] = [await courseId(SPACE, '4M1', 'arabic', mac), await courseId(SPACE, '4M2', 'arabic', mac)];
    const elsewhere = await courseId(SPACE, '4M1', 'math', mac);
    const signed = [
      { course: one, week: d('2029-10-07') },
      { course: one, week: d('2029-09-30') },
      { course: one, week: d('2029-09-23') },
      { course: one, week: d('2029-10-07') },
      { course: two, week: d('2029-11-11') },
      { course: two, week: d('2029-11-18') },
      { course: elsewhere, week: d('2029-10-07') },
    ];
    assert.deepEqual(await grantWeeksOf(asked, signed, 2, mac), {
      weeks: [
        { course: two, week: d('2029-11-11'), epoch: 2 },
        { course: one, week: d('2029-09-30'), epoch: 2 },
        { course: one, week: d('2029-10-07'), epoch: 2 },
      ],
      missing: ['4M3'],
    });
  });

  it('is kept by the directorate that made it, each once, under its own key', async () => {
    const book = await openBook(cemEvents());
    const asked = await request();
    const bytes = asked.inspector.publicKey.length / 2;
    await book.record(d('2029-10-01'), { kind: 'grant.requested', requested: grantRequested({ ...asked, label: '' }) });
    await book.record(d('2029-10-01'), { kind: 'grant.requested', requested: grantRequested(asked) });
    await book.record(d('2029-10-02'), { kind: 'grant.requested', requested: grantRequested(asked) });
    assert.deepEqual(requestsMade(book.entries, bytes), [asked]);
    const key = recordKey({ kind: 'grant.requested', requested: grantRequested(asked) });
    assert.equal(key, `grant-requested:${asked.id}`);
  });
});
