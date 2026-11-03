// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's notice of an inspector's grant (#593, answer 621): read only
// when every field is of its shape, each week once and the days in order, at
// most 256 weeks, with one use key for each week, in their order (#594); signed
// on the director's device and put on the teacher's channel, refused for
// another code's channel; counted when the world's CA certified its key,
// neither the joined device's subject nor its key, even under another subject,
// the first of each grant, one naming another channel, one not of its shape or
// before any device joined left out without stopping the others. Every school,
// week and device here is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  certificateRequest,
  channelGrantNotices,
  channelSealing,
  channelStream,
  addDays,
  courseId,
  isGrantNotice,
  issueCertificate,
  makeJoinCode,
  newId,
  parseDay,
  sealGrantNotice,
  signGrantNotice,
  startKeyring,
  type Certificate,
  type GrantNotice,
  type KeySigner,
  type SealedBatch,
} from '../src/index.ts';
import { sealRecord } from '../src/sealed-stream.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';
const COURSE = await courseId(SCHOOL, '4م2', 'arabic', mac);

async function certified(ca: KeySigner, signer = keySigner()) {
  const request = await certificateRequest(WORLD, newId(random), signer);
  const certificate: Certificate = await issueCertificate(request, parseDay('2029-09-01'), newId(random), ca);
  return { signer, certificate };
}

async function channel() {
  const director = await device();
  const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const code = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
  const other = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
  const ca = keySigner();
  const [teacher, head] = [await certified(ca), await certified(ca)];
  const joined = { device: teacher.certificate.subject, certificate: teacher.certificate };
  const batches: SealedBatch[] = [];
  const place = { stream: await channelStream(code, mac), sealing: await channelSealing(code, mac) };
  const raw = async (value: object) => batches.push(...(await sealRecord(place, value, batches.length, 64, cipher)));
  const notice = (change: Partial<GrantNotice> = {}): GrantNotice => ({
    world: WORLD,
    school: SCHOOL,
    assignment: code.assignment,
    issue: code.issue,
    grant: '0123456789abcdef0123456789abcdef',
    inspector: 'Made-up inspector of district 3',
    weeks: [
      { course: COURSE, week: parseDay('2029-09-30') },
      { course: COURSE, week: parseDay('2029-10-07') },
    ],
    uses: [
      { course: COURSE, week: parseDay('2029-09-30'), key: 'a'.repeat(64) },
      { course: COURSE, week: parseDay('2029-10-07'), key: 'b'.repeat(64) },
    ],
    from: parseDay('2029-10-15'),
    until: parseDay('2029-11-27'),
    ...change,
  });
  const put = async (one: GrantNotice, by = head) => {
    const signed = await signGrantNotice(one, by.certificate, by.signer);
    batches.push(...(await sealGrantNotice(code, signed, batches.length, cipher, mac)).batches);
    return signed;
  };
  const read = (who: typeof joined | null = joined) =>
    channelGrantNotices(code, batches, { key: ca.publicKey, checker: ca }, who, cipher, mac);
  return { code, other, ca, teacher, head, joined, raw, notice, put, read };
}

describe('a grant notice', () => {
  it('reads only when every field is of its shape', async () => {
    const { notice } = await channel();
    assert.equal(isGrantNotice(notice()), true);
    const week = { course: COURSE, week: parseDay('2029-09-30') };
    const use = (at: number) => notice().uses[at];
    const broken: Partial<Record<keyof GrantNotice | 'note' | 'day', unknown>>[] = [
      { note: 'hello' },
      { grant: 'not-an-id' },
      { inspector: ' padded' },
      { inspector: '' },
      { weeks: [] },
      { weeks: [week, week] },
      { weeks: [{ ...week, teacher: 'A made-up teacher' }] },
      {
        weeks: Array.from({ length: 257 }, (_, at) => ({ course: COURSE, week: addDays(parseDay('2029-01-01'), at) })),
      },
      { weeks: [null] },
      { weeks: [week, null] },
      { weeks: [week, { course: '0'.repeat(32), week: week.week }] },
      { uses: [] },
      { uses: 'keys' },
      { uses: [null, null] },
      { uses: [{ ...use(0), key: 'ab' }, use(1)] },
      { uses: [use(1), use(0)] },
      { uses: [use(0)] },
      { uses: [{ ...use(0), course: '0'.repeat(32) }, use(1)] },
      { uses: [{ ...use(0), note: 'hello' }, use(1)] },
      { from: parseDay('2029-11-28') },
      { day: parseDay('2029-10-15') },
      { issue: 0 },
    ];
    for (const change of broken) assert.equal(isGrantNotice({ ...notice(), ...change }), false, JSON.stringify(change));
  });

  it('counts on the teacher’s channel when the CA certified its key, the first of each grant', async () => {
    const { other, ca, teacher, head, notice, put, read, raw } = await channel();
    const bad = JSON.stringify({ ...notice(), weeks: [null] });
    await raw({ format: 'minhajna/grant-notice/1', text: bad, signature: 'AA', certificate: head.certificate });
    const first = await put(notice());
    await put(notice({ inspector: 'A later made-up label' }));
    await put(notice({ grant: 'fedcba9876543210fedcba9876543210' }), teacher);
    await put(notice({ grant: 'cccccccccccccccccccccccccccccccc' }), await certified(ca, teacher.signer));
    const stranger = await certified(keySigner());
    await put(notice({ grant: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }), stranger);
    const elsewhere = await signGrantNotice(notice({ assignment: other.assignment }), head.certificate, head.signer);
    await raw({
      format: 'minhajna/grant-notice/1',
      text: elsewhere.text,
      signature: elsewhere.signature,
      certificate: elsewhere.certificate,
    });
    const second = await put(notice({ grant: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }));
    assert.deepEqual(
      (await read()).map((one) => one.value),
      [first.value, second.value],
    );
    assert.deepEqual(await read(null), []);
    await assert.rejects(sealGrantNotice(other, first, 0, cipher, mac), RangeError);
  });
});
