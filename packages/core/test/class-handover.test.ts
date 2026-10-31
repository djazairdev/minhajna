// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The handover to a substitute (#587, answer 615): a record names its code's
// channel, the appointment, two names, a decision, a first day, classes, one of
// them and signed weeks, and a reason, a bad ID, an empty or hidden-character
// name, a long decision, a day that is not one, no class, a class with a space,
// a class twice, too many classes, a class not among them, a week of another
// shape, too many weeks or an issue below one is not one; a receipt names an
// appointment and a day only; and a record of the most weeks fits one request.
// On the substitute's channel a handover joins its first record and the later
// ones of the same appointment the same key signed naming the same, keeping
// each course's week once at its highest version, the lower text on a tie, that
// checks under the world's CA, of the channel's school and of its record's
// class, signed by neither the handover's key nor the substitute's subject;
// another key's record, one naming another decision, the substitute's own, and
// a text changed under its signature are left out; the substitute's first
// receipt after the handover counts, never one before it, the director's or one
// under the substitute's subject with another key; nothing counts before
// joining or under another CA; and a handover is never sealed on another code's
// channel nor signed out of shape. Every school, class and teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays,
  certificateRequest,
  channelHandovers,
  channelSealing,
  channelStream,
  courseId,
  HANDOVER_WEEKS,
  isClassHandover,
  isHandoverReceipt,
  issueCertificate,
  makeJoinCode,
  newId,
  parseDay,
  sealHandover,
  sealHandoverReceipt,
  signHandover,
  signHandoverReceipt,
  signWeek,
  startKeyring,
  SUBSTITUTION_CLASSES,
  weekRecordText,
  type Certificate,
  type ClassHandover,
  type KeySigner,
  type SealedBatch,
  type WeekRecord,
} from '../src/index.ts';
import { sealRecord } from '../src/sealed-stream.ts';
import { keySigner } from './key-signers.ts';
import { device, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';
const APPOINTMENT = 'c'.repeat(32);

async function certified(ca: KeySigner, signer = keySigner(), subject = newId(random)) {
  const request = await certificateRequest(WORLD, subject, signer);
  const certificate: Certificate = await issueCertificate(request, parseDay('2026-12-01'), newId(random), ca);
  return { signer, certificate };
}

const weekOf = async (of: string, week = '2026-12-06', version = 0, school = SCHOOL): Promise<WeekRecord> => ({
  course: await courseId(school, of, 'arabic', mac),
  week: parseDay(week),
  version,
  totals: { subject: 'arabic', items: [], reached: 0, runsLong: false, covered: 0, closed: 0 },
  class: of,
  subject: 'اللغة العربية',
  sessions: [{ day: 0, start: 480, end: 540, group: '', week: 'both', state: version === 0 ? 'held' : 'not-held' }],
});

async function channel() {
  const director = await device();
  const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const code = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
  const ca = keySigner();
  const [substitute, holder, head] = [await certified(ca), await certified(ca), await certified(ca)];
  const joined = { device: substitute.certificate.subject, certificate: substitute.certificate };
  const batches: SealedBatch[] = [];
  const place = { stream: await channelStream(code, mac), sealing: await channelSealing(code, mac) };
  const raw = async (value: object) => batches.push(...(await sealRecord(place, value, batches.length, 64, cipher)));
  const signed = async (one: WeekRecord, by = holder) => signWeek(weekRecordText(one), by.certificate, by.signer);
  const on = { world: WORLD, school: SCHOOL, assignment: code.assignment, issue: code.issue };
  const handoverOf = (weeks: ClassHandover['weeks'], of = '4م2', appointment = APPOINTMENT): ClassHandover => ({
    ...on,
    appointment,
    holder: 'شريفي نسيم',
    substitute: 'عمراني ليلى',
    decision: '2029/117',
    from: parseDay('2026-12-13'),
    classes: ['4م2', '4م3'],
    class: of,
    weeks,
  });
  const handover = async (one: ClassHandover, by = head) => {
    const made = await signHandover(one, by.certificate, by.signer);
    batches.push(...(await sealHandover(code, made, batches.length, cipher, mac)).batches);
    return made;
  };
  const receipt = async (day: string, by = substitute, appointment = APPOINTMENT) => {
    const made = await signHandoverReceipt({ ...on, appointment, day: parseDay(day) }, by.certificate, by.signer);
    batches.push(...(await sealHandoverReceipt(code, made, batches.length, cipher, mac)).batches);
  };
  const read = (who = joined, key = ca) =>
    channelHandovers(code, batches, { key: key.publicKey, checker: key }, who, cipher, mac);
  return { code, ca, on, substitute, holder, head, joined, raw, signed, handoverOf, handover, receipt, read };
}

describe('a handover’s shape', () => {
  it('names a channel, an appointment, names, a decision, a day, classes, a class and weeks', async () => {
    const { handoverOf, signed } = await channel();
    const good = handoverOf([await signed(await weekOf('4م2'))]);
    assert.equal(isClassHandover(good), true);
    const broken = [
      { ...good, reason: 'ill' },
      { ...good, appointment: 'not-an-id' },
      { ...good, holder: '' },
      { ...good, substitute: `a${String.fromCharCode(0x200f)}b` },
      { ...good, decision: 'x'.repeat(41) },
      { ...good, from: '2026-13-01' },
      { ...good, classes: [] },
      { ...good, classes: [' 4م2'] },
      { ...good, classes: ['4م2', '4م2'] },
      { ...good, classes: Array.from({ length: SUBSTITUTION_CLASSES + 1 }, (_, at) => `4م${at}`) },
      { ...good, class: '4م4' },
      { ...good, weeks: [{ text: 'week' }] },
      { ...good, weeks: Array.from({ length: HANDOVER_WEEKS + 1 }, () => good.weeks[0]) },
      { ...good, issue: 0 },
    ];
    for (const one of broken) assert.equal(isClassHandover(one), false);
  });

  it('gives a receipt an appointment and a day, nothing else', async () => {
    const { on } = await channel();
    const good = { ...on, appointment: APPOINTMENT, day: parseDay('2026-12-13') };
    assert.equal(isHandoverReceipt(good), true);
    for (const one of [
      { ...good, note: 'reçu' },
      { ...good, day: '13/12/2026' },
      { ...good, appointment: 'x' },
    ])
      assert.equal(isHandoverReceipt(one), false);
  });

  it('fits a record of the most weeks in one request', async () => {
    const { handoverOf, signed, head, code } = await channel();
    const weeks = await Promise.all(
      Array.from({ length: HANDOVER_WEEKS }, async (_, at) =>
        signed(await weekOf('4م2', addDays(parseDay('2026-12-06'), 7 * at))),
      ),
    );
    const made = await signHandover(handoverOf(weeks), head.certificate, head.signer);
    assert.equal((await sealHandover(code, made, 0, cipher, mac)).batches.length <= 128, true);
  });
});

describe('a handover on the substitute’s channel', () => {
  it('joins one appointment’s records from one key, each week once at its highest version, that check', async () => {
    const { ca, head, substitute, raw, signed, handoverOf, handover, read } = await channel();
    const kept = await signed(await weekOf('4م2'));
    const fixed = await signed(await weekOf('4م2', '2026-12-06', 1));
    const later = await signed(await weekOf('4م3', '2026-12-13'));
    const twin = await signed({
      ...(await weekOf('4م3', '2026-12-13')),
      sessions: [{ ...(await weekOf('4م3')).sessions[0]!, state: 'awaiting' }],
    });
    const other = await signed(await weekOf('4م3'));
    const elsewhere = await signed(await weekOf('4م2', '2026-12-06', 0, 'another-made-up-space'));
    const forged = { ...kept, text: kept.text.replace('"held"', '"not-held"') };
    const stranger = await signed(await weekOf('4م2', '2026-12-13'), await certified(keySigner()));
    const byHead = await signed(await weekOf('4م2', '2026-12-20'), head);
    const subjectKey = await certified(ca, keySigner(), substitute.certificate.subject);
    const bySubject = await signed(await weekOf('4م2', '2026-12-27'), subjectKey);
    const first = await handover(handoverOf([kept, other, elsewhere, forged, stranger, byHead, bySubject]));
    await handover(handoverOf([fixed, kept, kept]));
    await handover(handoverOf([later, twin], '4م3'));
    await handover(handoverOf([await signed(await weekOf('4م3', '2026-12-20'))], '4م3'), await certified(ca));
    const renamed = handoverOf([await signed(await weekOf('4م3', '2026-12-27'))], '4م3');
    await handover({ ...renamed, decision: '2029/118' });
    await handover(handoverOf([kept], '4م2', 'd'.repeat(32)), subjectKey);
    const changed = await signHandover(handoverOf([kept], '4م2', 'e'.repeat(32)), head.certificate, head.signer);
    await raw({ format: 'minhajna/class-handover/1', ...changed, text: changed.text.replace('2029/117', '2029/118') });
    const found = await read();
    assert.deepEqual(
      found.map((one) => one.signed.text),
      [first.text],
    );
    assert.deepEqual(
      found[0]!.weeks.map((one) => [one.week.class, one.week.week, one.week.version]),
      [
        ['4م2', '2026-12-06', 1],
        ['4م3', '2026-12-13', 0],
      ],
    );
    assert.equal(found[0]!.weeks[1]!.signed.text, [later.text, twin.text].sort()[0]);
    assert.deepEqual(await read(null as never), []);
    assert.deepEqual(await read(undefined, keySigner()), []);
  });

  it('counts the substitute’s own first receipt after its handover, under both its subject and its key', async () => {
    const { ca, head, substitute, signed, handoverOf, handover, receipt, read } = await channel();
    await receipt('2026-12-10');
    await handover(handoverOf([await signed(await weekOf('4م2'))]));
    await receipt('2026-12-14', head);
    await receipt('2026-12-14', await certified(ca, keySigner(), substitute.certificate.subject));
    await receipt('2026-12-15');
    await receipt('2026-12-16');
    assert.deepEqual(
      (await read()).map((one) => one.received),
      ['2026-12-15'],
    );
  });

  it('is never sealed on another code’s channel, nor signed out of shape', async () => {
    const { handoverOf, head } = await channel();
    const elsewhere = await channel();
    const made = await signHandover(handoverOf([]), head.certificate, head.signer);
    await assert.rejects(sealHandover(elsewhere.code, made, 0, cipher, mac), RangeError);
    await assert.rejects(signHandover({ ...handoverOf([]), classes: [] }, head.certificate, head.signer), RangeError);
  });
});
