// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's visa on a signed week (#585, answer 613): a visa names its
// code's channel, a course's week, the version and the world's day, and a note,
// a version out of range, a course that is not an ID, a week or day that is not
// a day or an issue below one, a day before the week, a week that is not text
// or a missing day is not one. On the channel the first visa on each version
// counts once the joined device's week at that version came before it, given by
// a key other than the teacher's, so a visa before its week, a second on the
// same version, the teacher's own, one on a version never signed, one naming
// another issue and a text changed under its signature are left out; nothing
// counts before joining or under another CA; and a visa is never sealed on
// another code's channel nor signed out of shape. Every school, class and
// teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  certificateRequest,
  channelSealing,
  channelStream,
  channelVisas,
  courseId,
  isWeekVisa,
  issueCertificate,
  makeJoinCode,
  newId,
  parseDay,
  sealVisa,
  sealWeek,
  signVisa,
  signWeek,
  startKeyring,
  weekRecordText,
  type Certificate,
  type KeySigner,
  type SealedBatch,
  type WeekRecord,
  type WeekVisa,
} from '../src/index.ts';
import { sealRecord } from '../src/sealed-stream.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';
const COURSE = await courseId(SCHOOL, '4م2', 'arabic', mac);

async function certified(ca: KeySigner, world = WORLD, signer = keySigner(), subject = newId(random)) {
  const request = await certificateRequest(world, subject, signer);
  const certificate: Certificate = await issueCertificate(request, parseDay('2026-12-01'), newId(random), ca);
  return { signer, certificate };
}

const WEEK: WeekRecord = {
  course: COURSE,
  week: parseDay('2026-12-06'),
  version: 0,
  totals: { subject: 'arabic', items: [], reached: 0, runsLong: false, covered: 0, closed: 0 },
  class: '4م2',
  subject: 'اللغة العربية',
  sessions: [{ day: 0, start: 480, end: 540, group: '', week: 'both', state: 'held' }],
};

async function channel() {
  const director = await device();
  const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const code = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
  const ca = keySigner();
  const [teacher, head] = [await certified(ca), await certified(ca)];
  const joined = { device: teacher.certificate.subject, certificate: teacher.certificate };
  const batches: SealedBatch[] = [];
  const place = { stream: await channelStream(code, mac), sealing: await channelSealing(code, mac) };
  const raw = async (value: object) => batches.push(...(await sealRecord(place, value, batches.length, 64, cipher)));
  const week = async (one: WeekRecord) => {
    const signed = await signWeek(weekRecordText(one), teacher.certificate, teacher.signer);
    batches.push(...(await sealWeek(code, signed, batches.length, cipher, mac)).batches);
  };
  const on = { world: WORLD, school: SCHOOL, assignment: code.assignment, issue: code.issue };
  const visaOf = (version: number, day = '2026-12-13'): WeekVisa => ({
    ...on,
    course: COURSE,
    week: WEEK.week,
    version,
    day: parseDay(day),
  });
  const visa = async (one: WeekVisa, by = head) => {
    const signed = await signVisa(one, by.certificate, by.signer);
    batches.push(...(await sealVisa(code, signed, batches.length, cipher, mac)).batches);
    return signed;
  };
  const read = (who = joined, key = ca) =>
    channelVisas(code, batches, { key: key.publicKey, checker: key }, who, cipher, mac);
  return { code, ca, teacher, head, joined, batches, raw, week, visaOf, visa, read };
}

describe('a visa’s shape', () => {
  it('names a channel, a course’s week, a version and a day, and nothing else', async () => {
    const { visaOf } = await channel();
    const good = visaOf(0);
    assert.equal(isWeekVisa(good), true);
    const broken = [
      { ...good, note: 'vu' },
      { ...good, version: -1 },
      { ...good, version: 1.5 },
      { ...good, course: 'not-an-id' },
      { ...good, week: '2026-13-01' },
      { ...good, day: '10:00' },
      { ...good, issue: 0 },
      { ...good, day: '2026-12-05' },
      { ...good, week: 20261206 },
      Object.fromEntries(Object.entries(good).filter(([key]) => key !== 'day')),
    ];
    for (const one of broken) assert.equal(isWeekVisa(one), false);
  });
});

describe('a visa on the teacher’s channel', () => {
  it('counts the first visa on each version, once its week came first, by a key other than the teacher’s', async () => {
    const { teacher, head, joined, week, visaOf, visa, read, raw } = await channel();
    await visa(visaOf(0, '2026-12-10'));
    await week(WEEK);
    const first = await visa(visaOf(0));
    await visa(visaOf(0, '2026-12-14'));
    await visa(visaOf(1), teacher);
    await week({ ...WEEK, version: 1, sessions: [{ ...WEEK.sessions[0]!, state: 'not-held' }], reason: 'other' });
    const stray = await signVisa({ ...visaOf(1, '2026-12-11'), issue: 2 }, head.certificate, head.signer);
    await raw({ format: 'minhajna/week-visa/1', ...stray });
    const lost = await signVisa(visaOf(1, '2026-12-12'), head.certificate, head.signer);
    await raw({ format: 'minhajna/week-visa/1', ...lost, text: lost.text.replace('2026-12-12', '2026-12-11') });
    const fixed = await visa(visaOf(1));
    await visa(visaOf(2));
    await raw({ format: 'minhajna/week-visa/1', ...first, text: first.text.replace('2026-12-13', '2026-12-15') });
    const found = await read();
    assert.deepEqual(
      found.map((one) => [one.value.version, one.value.day]),
      [
        [0, '2026-12-13'],
        [1, '2026-12-13'],
      ],
    );
    assert.deepEqual(
      found.map((one) => one.text),
      [first.text, fixed.text],
    );
    assert.deepEqual(await read(null as never), []);
    assert.deepEqual(await read(joined, keySigner()), []);
  });

  it('never counts a visa from the teacher’s device, under its key or its subject', async () => {
    const { ca, teacher, week, visaOf, visa, read } = await channel();
    await week(WEEK);
    const newKey = await certified(ca, WORLD, keySigner(), teacher.certificate.subject);
    const newCertificate = await certified(ca, WORLD, teacher.signer);
    await visa(visaOf(0), teacher);
    await visa(visaOf(0), newKey);
    await visa(visaOf(0), newCertificate);
    assert.deepEqual(await read(), []);
  });

  it('is never sealed on another code’s channel', async () => {
    const { visaOf, head } = await channel();
    const elsewhere = await channel();
    const signed = await signVisa(visaOf(0), head.certificate, head.signer);
    await assert.rejects(sealVisa(elsewhere.code, signed, 0, cipher, mac), RangeError);
    await assert.rejects(signVisa({ ...visaOf(0), version: -1 }, head.certificate, head.signer), RangeError);
  });
});
