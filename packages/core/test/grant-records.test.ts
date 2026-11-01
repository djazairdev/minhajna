// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a holder keeps when it makes an inspector's grant (#593, answer 621):
// each signed week archived under that week's own key with its versions, signed
// by one device, and the visas on them, each once, which the grant's inspector
// opens with the key the grant shares and no other week's key opens, read back
// only whole, every version and visa certified by the world's CA, of that week,
// once each and from one signer, so a stray, repeated or uncertified version or
// visa leaves it unread, and the first record that reads wins; the school's
// record of each grant on its epoch's stream, which only a holder finds, each
// grant once and another school's left out; and the grant relayed to its
// inspector's device, bound to the request it answers, which only that device
// opens and only when the grant names it, the request's ID in clear for the
// directorate. Every school, week and device here is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  certificateRequest,
  correctWeek,
  courseId,
  grantedWeek,
  grantedWeekPlace,
  grantMade,
  grantRecordPlace,
  grantsMade,
  inspectorFingerprint,
  issueCertificate,
  makeGrant,
  newId,
  openGrant,
  openGrantedWeek,
  openRelayed,
  parseDay,
  readWeekRecord,
  relayedRequests,
  relayGrant,
  relayPlace,
  sealGrantedWeek,
  signedWeekKey,
  signVisa,
  signWeek,
  startKeyring,
  useGrant,
  weekRecordText,
  GRANT_RECORD_BATCHES,
  type Certificate,
  type KeySigner,
  type WeekRecord,
  type WeekVisa,
} from '../src/index.ts';
import { openRecords, sealRecord } from '../src/sealed-stream.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';
const COURSE = await courseId(SCHOOL, '4م2', 'arabic', mac);
const REQUEST = '0123456789abcdef0123456789abcdef';

async function certified(ca: KeySigner) {
  const signer = keySigner();
  const request = await certificateRequest(WORLD, newId(random), signer);
  const certificate: Certificate = await issueCertificate(request, parseDay('2029-09-01'), newId(random), ca);
  return { signer, certificate };
}

const WEEK: WeekRecord = {
  course: COURSE,
  week: parseDay('2029-10-07'),
  version: 0,
  totals: { subject: 'arabic', items: [], reached: 0, runsLong: false, covered: 0, closed: 0 },
  class: '4م2',
  subject: 'اللغة العربية',
  sessions: [{ day: 0, start: 480, end: 540, group: '', week: 'both', state: 'awaiting' }],
};

async function school() {
  const director = await device();
  const inspector = await device();
  const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const ca = keySigner();
  const [teacher, head, other] = [await certified(ca), await certified(ca), await certified(ca)];
  const sign = async (week: WeekRecord, by = teacher) => {
    const signed = await signWeek(weekRecordText(week), by.certificate, by.signer);
    return { week: readWeekRecord(signed.text)!, signed };
  };
  const visa = (version: number): WeekVisa => ({
    world: WORLD,
    school: SCHOOL,
    assignment: newId(random),
    issue: 1,
    course: COURSE,
    week: WEEK.week,
    version,
    day: parseDay('2029-10-14'),
  });
  const fingerprint = await inspectorFingerprint(inspector.holder.publicKey, inspector.crypto);
  const terms = {
    id: newId(random),
    inspector: inspector.holder,
    fingerprint,
    weeks: [{ course: COURSE, week: WEEK.week, epoch: 0 }],
    from: parseDay('2029-10-15'),
    until: parseDay('2029-11-27'),
  };
  const grant = await makeGrant(opened, terms, director.holder.id, director.crypto);
  const checks = { key: ca.publicKey, checker: ca };
  return { director, inspector, opened, ca, teacher, head, other, sign, visa, grant, checks };
}

describe('a granted week', () => {
  it('opens with the key its grant shares, as the CA certified it, and with no other week’s key', async () => {
    const { director, inspector, opened, head, other, sign, visa, grant, checks } = await school();
    const first = await sign(WEEK);
    const second = await sign(correctWeek(WEEK, WEEK.sessions[0]!, 'held', 'confirmed-later'));
    const given = await signVisa(visa(1), head.certificate, head.signer);
    const visas = [
      given,
      given,
      await signVisa(visa(0), head.certificate, head.signer),
      await signVisa({ ...visa(0), week: parseDay('2029-10-14') }, head.certificate, head.signer),
    ];
    const archived = grantedWeek({ ...second, earlier: [first] }, visas);
    assert.deepEqual([archived.versions.length, archived.visas.length], [2, 2]);
    const key = await signedWeekKey(opened, 0, COURSE, WEEK.week, director.crypto);
    const place = await grantedWeekPlace(key, mac);
    const stray = await sign({ ...WEEK, version: 2, sessions: WEEK.sessions }, other);
    const batches = await sealGrantedWeek(place, archived, 0, cipher);
    const forged = { ...archived.visas[0]!, signature: archived.visas[1]!.signature };
    const spoilt = [
      { ...archived, versions: [...archived.versions, stray.signed] },
      { ...archived, versions: [...archived.versions, { text: 'x', signature: 'y' } as never] },
      { ...archived, visas: [...archived.visas, forged] },
      { ...archived, versions: [...archived.versions, archived.versions[0]!] },
      { ...archived, visas: [...archived.visas, archived.visas[0]!] },
    ];
    for (const one of spoilt) {
      const sealed = await sealGrantedWeek(place, one, 0, cipher);
      assert.equal(await openGrantedWeek(place, sealed, COURSE, WEEK.week, WORLD, checks, cipher), null);
    }
    const today = parseDay('2029-10-20');
    const opening = await openGrant(grant, today, inspector.holder.id, inspector.crypto);
    if (typeof opening === 'string') throw new Error(opening);
    const taken = await useGrant(opening, COURSE, WEEK.week, today, inspector.crypto);
    if (taken === null) throw new Error('No key for the week');
    const theirs = await grantedWeekPlace(taken.key, mac);
    const both = [...(await sealGrantedWeek(place, spoilt[0]!, 0, cipher))];
    both.push(...(await sealGrantedWeek(place, archived, both.length, cipher)));
    const read = await openGrantedWeek(theirs, both, COURSE, WEEK.week, WORLD, checks, cipher);
    assert.deepEqual(
      read?.versions.map((one) => one.week.version),
      [0, 1],
    );
    assert.deepEqual(read?.visas.map((one) => one.value.version).sort(), [0, 1]);
    const otherWeek = await grantedWeekPlace(
      await signedWeekKey(opened, 0, COURSE, parseDay('2029-10-14'), director.crypto),
      mac,
    );
    assert.equal(await openGrantedWeek(otherWeek, batches, COURSE, WEEK.week, WORLD, checks, cipher), null);
    const stranger = keySigner();
    const unchecked = { key: stranger.publicKey, checker: stranger };
    assert.equal(await openGrantedWeek(place, batches, COURSE, WEEK.week, WORLD, unchecked, cipher), null);
    assert.equal(await openGrantedWeek(place, batches, COURSE, parseDay('2029-10-14'), WORLD, checks, cipher), null);
    const elsewhere = { ...first, week: { ...first.week, week: parseDay('2029-10-14') } };
    for (const latest of [
      { ...second, earlier: [elsewhere] },
      { ...stray, earlier: [first, second] },
    ]) {
      assert.throws(() => grantedWeek(latest, []), RangeError);
    }
  });
});

describe('the school’s record of a grant', () => {
  it('goes on its epoch’s stream, which only a holder finds, each grant once', async () => {
    const { director, opened, grant } = await school();
    const place = await grantRecordPlace(opened, 0, director.crypto, mac);
    const bytes = director.crypto.publicKeyBytes;
    const made = grantMade(REQUEST, 'Made-up inspector of district 3', grant, bytes);
    const elsewhere = grantMade(REQUEST, 'Made-up inspector', { ...grant, school: 'another-made-up-school' }, bytes);
    const batches = [];
    for (const one of [made, made, elsewhere, { ...made, label: ' padded' }]) {
      batches.push(...(await sealRecord(place, one, batches.length, GRANT_RECORD_BATCHES, cipher)));
    }
    assert.deepEqual(grantsMade(await openRecords(place, batches, GRANT_RECORD_BATCHES, cipher), SCHOOL, bytes), [
      made,
    ]);
    const stranger = await device();
    const theirs = await startKeyring(SCHOOL, stranger.holder, stranger.crypto, random);
    assert.notDeepEqual(await grantRecordPlace(theirs, 0, stranger.crypto, mac), place);
    assert.throws(() => grantMade('not-an-id', 'Made-up inspector', grant, bytes), RangeError);
    assert.throws(() => grantMade(REQUEST, 'Made-up inspector', grant, bytes + 1), RangeError);
  });
});

describe('a grant relayed to its inspector', () => {
  it('opens only on that inspector’s device, bound to its request, the request’s ID in clear', async () => {
    const { director, inspector, grant } = await school();
    const stranger = await device();
    const relay = await relayGrant(REQUEST, grant, director.crypto);
    const moved = { ...relay, request: 'fedcba9876543210fedcba9876543210' };
    const place = await relayPlace(inspector.holder, mac);
    assert.notDeepEqual(place, await relayPlace(stranger.holder, mac));
    const records = [moved, relay, relay, { format: 'other' }];
    assert.deepEqual(relayedRequests(records), new Set([moved.request, REQUEST]));
    assert.deepEqual(await openRelayed(records, inspector.holder, inspector.crypto), [{ request: REQUEST, grant }]);
    assert.deepEqual(await openRelayed(records, stranger.holder, stranger.crypto), []);
    const misnamed = await relayGrant(
      REQUEST,
      { ...grant, inspector: { ...grant.inspector, id: stranger.holder.id } },
      director.crypto,
    );
    assert.deepEqual(await openRelayed([misnamed], inspector.holder, inspector.crypto), []);
    await assert.rejects(relayGrant('not-an-id', grant, director.crypto), RangeError);
  });
});
