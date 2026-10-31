// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The classes' return to their holder and the end of a substitution (#588,
// answer 616): a return names what a handover names and a return day after the
// first day, and one returning on its first day, on a day that is not one,
// without a return day, without classes or with a reason is not one; an end
// names an appointment and a day only; a week counts in the substitution when
// some of its seven days fall from the first day and before the return, a
// return in mid-week keeping the week it falls in. On the holder's channel a
// return keeps the substitute's weeks of its records' class that fall in the
// substitution, each course's week once at its highest version, never the
// holder's own nor the return's subject's, and says which classes arrived
// whole; another subject's record, one naming another return day and a text
// changed under its signature are left out; a class whose records of one
// sending have not all arrived is not whole; nothing counts before joining; the
// holder's own device never puts one; and none is sealed on another code's
// channel. On the substitute's channel the handover's subject's first end after
// it, after its first day, ends it, never one before it, another subject's, the
// substitute's own, one on or before the first day or one of another
// appointment, and no receipt after the end counts. Every school, class and
// teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  certificateRequest,
  channelHandovers,
  channelReturns,
  channelSealing,
  channelStream,
  courseId,
  inSubstitution,
  isClassReturn,
  isHandoverEnd,
  issueCertificate,
  makeJoinCode,
  newId,
  parseDay,
  sealClassReturn,
  sealHandover,
  sealHandoverEnd,
  sealHandoverReceipt,
  signClassReturn,
  signHandover,
  signHandoverEnd,
  signHandoverReceipt,
  signWeek,
  startKeyring,
  weekRecordText,
  type Certificate,
  type ClassReturn,
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

const weekOf = async (of: string, week: string, version = 0): Promise<WeekRecord> => ({
  course: await courseId(SCHOOL, of, 'arabic', mac),
  week: parseDay(week),
  version,
  totals: { subject: 'arabic', items: [], reached: 0, runsLong: false, covered: 0, closed: 0 },
  class: of,
  subject: 'اللغة العربية',
  sessions: [{ day: 0, start: 480, end: 540, group: '', week: 'both', state: 'held' }],
});

async function channel() {
  const director = await device();
  const opened = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const code = await makeJoinCode(opened, WORLD, newId(random), 1, director.crypto);
  const ca = keySigner();
  const [holder, substitute, head] = [await certified(ca), await certified(ca), await certified(ca)];
  const joinedBy = (one: typeof holder) => ({ device: one.certificate.subject, certificate: one.certificate });
  const batches: SealedBatch[] = [];
  const place = { stream: await channelStream(code, mac), sealing: await channelSealing(code, mac) };
  const raw = async (value: object) => batches.push(...(await sealRecord(place, value, batches.length, 64, cipher)));
  const signed = async (one: WeekRecord, by = substitute) => signWeek(weekRecordText(one), by.certificate, by.signer);
  const on = { world: WORLD, school: SCHOOL, assignment: code.assignment, issue: code.issue };
  const named = { holder: 'شريفي نسيم', substitute: 'عمراني ليلى', decision: '2029/117', classes: ['4م2', '4م3'] };
  const passed = { ...on, ...named, appointment: APPOINTMENT, from: parseDay('2026-12-15'), sending: 'a'.repeat(32) };
  const returnOf = (weeks: ClassReturn['weeks'], of = '4م2', part = 0, parts = 1): ClassReturn => ({
    ...passed,
    until: parseDay('2027-01-10'),
    class: of,
    part,
    parts,
    weeks,
  });
  const put = async (one: ClassReturn, by = head) => {
    const made = await signClassReturn(one, by.certificate, by.signer);
    batches.push(...(await sealClassReturn(code, made, batches.length, cipher, mac)).batches);
    return made;
  };
  const handover = async (by = head) => {
    const one = { ...passed, class: '4م2', part: 0, parts: 1, weeks: [] };
    const made = await signHandover(one, by.certificate, by.signer);
    batches.push(...(await sealHandover(code, made, batches.length, cipher, mac)).batches);
  };
  const receipt = async (day: string, by = substitute) => {
    const made = await signHandoverReceipt(
      { ...on, appointment: APPOINTMENT, day: parseDay(day) },
      by.certificate,
      by.signer,
    );
    batches.push(...(await sealHandoverReceipt(code, made, batches.length, cipher, mac)).batches);
  };
  const end = async (day: string, by = head, appointment = APPOINTMENT) => {
    const made = await signHandoverEnd({ ...on, appointment, day: parseDay(day) }, by.certificate, by.signer);
    batches.push(...(await sealHandoverEnd(code, made, batches.length, cipher, mac)).batches);
  };
  const checker = { key: ca.publicKey, checker: ca };
  const returns = (who = joinedBy(holder)) => channelReturns(code, batches, checker, who, cipher, mac);
  const handovers = () => channelHandovers(code, batches, checker, joinedBy(substitute), cipher, mac);
  return { code, ca, holder, substitute, head, raw, signed, returnOf, put, handover, end, receipt, returns, handovers };
}

describe('a return’s shape', () => {
  it('names what a handover names and a return day after the first day', async () => {
    const { returnOf } = await channel();
    const one = returnOf([]);
    assert.equal(isClassReturn(one), true);
    for (const wrong of [
      { ...one, until: one.from },
      { ...one, until: '2027-02-30' },
      { ...one, until: undefined },
      { ...one, classes: [] },
      { ...one, reason: 'ill' },
    ])
      assert.equal(isClassReturn(wrong), false);
  });

  it('gives an end an appointment and a day, nothing else', async () => {
    const { code } = await channel();
    const on = { world: WORLD, school: SCHOOL, assignment: code.assignment, issue: code.issue };
    assert.equal(isHandoverEnd({ ...on, appointment: APPOINTMENT, day: '2027-01-10' }), true);
    assert.equal(isHandoverEnd({ ...on, appointment: 'x', day: '2027-01-10' }), false);
    assert.equal(isHandoverEnd({ ...on, appointment: APPOINTMENT, day: '2027-01-10', note: 'back' }), false);
  });

  it('counts a week some of whose seven days fall from the first day and before the return', () => {
    const [from, until] = [parseDay('2026-12-15'), parseDay('2027-01-10')];
    assert.deepEqual(
      ['2026-12-08', '2026-12-09', '2027-01-03', '2027-01-10'].map((week) =>
        inSubstitution(parseDay(week), from, until),
      ),
      [false, true, true, false],
    );
    const tuesday = parseDay('2027-01-12');
    assert.deepEqual(
      ['2027-01-10', '2027-01-17'].map((week) => inSubstitution(parseDay(week), from, tuesday)),
      [true, false],
    );
  });
});

describe('a return on the holder’s channel', () => {
  it('keeps the substitute’s weeks of the substitution, each once at its highest version, that check', async () => {
    const { ca, holder, head, raw, signed, returnOf, put, returns } = await channel();
    const kept = await signed(await weekOf('4م2', '2026-12-13'));
    const fixed = await signed(await weekOf('4م2', '2026-12-13', 1));
    const before = await signed(await weekOf('4م2', '2026-12-06'));
    const after = await signed(await weekOf('4م2', '2027-01-10'));
    const own = await signed(await weekOf('4م2', '2026-12-20'), holder);
    const byHead = await signed(await weekOf('4م2', '2026-12-27'), head);
    const otherClass = await signed(await weekOf('4م3', '2027-01-03'));
    const first = await put(returnOf([kept, before, after, own, byHead, otherClass]));
    await put(returnOf([fixed]));
    await put(returnOf([await signed(await weekOf('4م2', '2027-01-03'))]), await certified(ca));
    await put({ ...returnOf([await signed(await weekOf('4م2', '2027-01-03'))]), until: parseDay('2027-01-17') });
    const alone = { ...returnOf([kept]), appointment: 'd'.repeat(32) };
    const changed = await signClassReturn(alone, head.certificate, head.signer);
    await raw({ format: 'minhajna/class-return/1', ...changed, text: changed.text.replace('2029/117', '2029/118') });
    await put(returnOf([], '4م3'));
    const found = await returns();
    assert.deepEqual(
      found.map((one) => one.signed.text),
      [first.text],
    );
    assert.deepEqual(
      found[0]!.weeks.map((one) => [one.week.class, one.week.week, one.week.version]),
      [['4م2', '2026-12-13', 1]],
    );
    assert.deepEqual(found[0]!.complete, ['4م2', '4م3']);
    assert.deepEqual(await returns(null as never), []);
  });

  it('says a class whose records of one sending have not all arrived is not whole', async () => {
    const { signed, returnOf, put, returns } = await channel();
    await put(returnOf([await signed(await weekOf('4م2', '2026-12-20'))], '4م2', 0, 2));
    await put(returnOf([], '4م3'));
    assert.deepEqual((await returns())[0]!.complete, ['4م3']);
  });

  it('is never put by the holder’s own device, nor sealed on another code’s channel', async () => {
    const { holder, returnOf, put, returns, head } = await channel();
    await put(returnOf([]), holder);
    assert.deepEqual(await returns(), []);
    const elsewhere = await channel();
    const made = await signClassReturn(returnOf([]), head.certificate, head.signer);
    await assert.rejects(sealClassReturn(elsewhere.code, made, 0, cipher, mac), RangeError);
  });
});

describe('the end on the substitute’s channel', () => {
  it('ends a handover by its subject’s first end after it, after its first day', async () => {
    const { ca, head, substitute, handover, end, receipt, handovers } = await channel();
    await end('2027-01-03');
    await handover();
    assert.deepEqual(
      (await handovers()).map((one) => one.ended),
      [null],
    );
    await end('2027-01-04', await certified(ca));
    await end('2027-01-05', substitute);
    await end('2026-12-15');
    await end('2026-12-14');
    await end('2027-01-05', head, 'd'.repeat(32));
    await end('2027-01-10', await certified(ca, keySigner(), head.certificate.subject));
    await end('2027-01-17');
    await receipt('2027-01-11');
    assert.deepEqual(
      (await handovers()).map((one) => [one.ended, one.received]),
      [['2027-01-10', null]],
    );
  });
});
